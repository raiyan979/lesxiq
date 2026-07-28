/*
 * Typed query functions. Every read/write of the database goes through a named
 * function here so SQL stays in db/ and callers get typed results. More queries
 * are added here as later phases need them (scheduler, curriculum, stats);
 * this file starts with the settings + app_state access the shell needs.
 */

import { getDb } from './client';
import type {
  AppStateRow,
  CardRow,
  CardItemType,
  CardState,
  ExerciseRow,
  Gender,
  LessonRow,
  Level,
  SentenceRow,
  UnitRow,
  UnitStatus,
  VocabRow,
  SettingRow,
} from './types';
import type { CardScheduling, ReviewLogFields } from '../scheduler/fsrs';

// --- settings (key/value) ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<SettingRow[]>(
    'SELECT key, value FROM settings WHERE key = $1',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<SettingRow[]>('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  // Upsert so callers don't need to know whether the key already exists.
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// --- app_state (single row, id = 1) ---

export async function getAppState(): Promise<AppStateRow> {
  const db = await getDb();
  const rows = await db.select<AppStateRow[]>(
    'SELECT * FROM app_state WHERE id = 1',
  );
  const state = rows[0];
  if (state === undefined) {
    // The migration seeds this row; its absence means a corrupt DB.
    throw new Error('app_state row (id=1) is missing — database is corrupt.');
  }
  return state;
}

// --- scheduler (cards + review_logs) ---
// All SQL for the review loop lives here; the scheduler module orchestrates
// these but never issues SQL itself (keeps db/ the sole SQLite boundary).

export async function getCardById(id: number): Promise<CardRow | null> {
  const db = await getDb();
  const rows = await db.select<CardRow[]>('SELECT * FROM cards WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** Cards past their due date (already introduced), most overdue first. */
export async function getDueCards(nowIso: string, limit = 500): Promise<CardRow[]> {
  const db = await getDb();
  return db.select<CardRow[]>(
    `SELECT * FROM cards
      WHERE state != 'new' AND due IS NOT NULL AND due <= $1
      ORDER BY due ASC
      LIMIT $2`,
    [nowIso, limit],
  );
}

/** Not-yet-introduced cards, in stable insertion order. */
export async function getNewCards(limit: number): Promise<CardRow[]> {
  const db = await getDb();
  if (limit <= 0) return [];
  return db.select<CardRow[]>(
    `SELECT * FROM cards WHERE state = 'new' ORDER BY id ASC LIMIT $1`,
    [limit],
  );
}

/** How many new cards have been introduced since `sinceIso` (a day boundary). */
export async function countNewIntroducedToday(sinceIso: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM review_logs WHERE state = 'new' AND reviewed_at >= $1`,
    [sinceIso],
  );
  return rows[0]?.n ?? 0;
}

export async function updateCardScheduling(
  id: number,
  s: CardScheduling,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE cards SET
        state = $1, due = $2, stability = $3, difficulty = $4,
        elapsed_days = $5, scheduled_days = $6, reps = $7, lapses = $8,
        last_review = $9
      WHERE id = $10`,
    [
      s.state,
      s.due,
      s.stability,
      s.difficulty,
      s.elapsed_days,
      s.scheduled_days,
      s.reps,
      s.lapses,
      s.last_review,
      id,
    ],
  );
}

export async function insertReviewLog(
  cardId: number,
  log: ReviewLogFields,
  durationMs: number | null,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO review_logs
        (card_id, rating, state, due, stability, difficulty,
         elapsed_days, scheduled_days, reviewed_at, duration_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      cardId,
      log.rating,
      log.state,
      log.due,
      log.stability,
      log.difficulty,
      log.elapsed_days,
      log.scheduled_days,
      log.reviewed_at,
      durationMs,
    ],
  );
}

/** XP awarded per review, by FSRS rating (again/hard/good/easy). */
const XP_BY_RATING: Record<number, number> = { 1: 2, 2: 5, 3: 10, 4: 12 };

/** Local calendar date as YYYY-MM-DD (streak days are local, not UTC). */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function previousDateStr(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return localDateStr(x);
}

function startOfDayIso(now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Record one graded review against app_state: bump counters, award XP by rating,
 * and advance the daily streak (increment if yesterday, reset to 1 on a gap).
 */
export async function recordReview(
  wasNew: boolean,
  rating: number,
  now: Date = new Date(),
): Promise<void> {
  const db = await getDb();
  const state = await getAppState();

  const today = localDateStr(now);
  let streak = state.streak_count;
  if (state.last_active_date === today) {
    // already counted today — streak unchanged
  } else if (state.last_active_date === previousDateStr(now)) {
    streak += 1;
  } else {
    streak = 1;
  }
  const longest = Math.max(state.longest_streak, streak);
  const xp = XP_BY_RATING[rating] ?? 5;

  await db.execute(
    `UPDATE app_state SET
        total_reviews = total_reviews + 1,
        total_new_learned = total_new_learned + $1,
        xp = xp + $2,
        streak_count = $3,
        longest_streak = $4,
        last_active_date = $5
      WHERE id = 1`,
    [wasNew ? 1 : 0, xp, streak, longest, today],
  );
}

export interface StudyStatus {
  streakDays: number;
  due: number;
  newDone: number;
  newTarget: number;
  xp: number;
}

/** The live status-bar figures: streak, cards due now, new-today, XP. */
export async function getStudyStatus(now: Date = new Date()): Promise<StudyStatus> {
  const db = await getDb();
  const state = await getAppState();
  const settings = await getAllSettings();
  const newTarget = Number(settings.new_cards_per_day ?? 15);

  const dueRows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM cards WHERE state != 'new' AND due IS NOT NULL AND due <= $1",
    [now.toISOString()],
  );
  const newDone = await countNewIntroducedToday(startOfDayIso(now));

  // A streak only "counts" if the last active day was today or yesterday.
  const alive =
    state.last_active_date === localDateStr(now) ||
    state.last_active_date === previousDateStr(now);

  return {
    streakDays: alive ? state.streak_count : 0,
    due: dueRows[0]?.n ?? 0,
    newDone,
    newTarget,
    xp: state.xp,
  };
}

export interface DashboardData {
  status: StudyStatus;
  /** Lifetime figures for the stats strip. */
  totals: { reviews: number; wordsLearned: number; longestStreak: number };
  /** The unit to resume: first in-progress, else first available, else null. */
  continueUnit: UnitWithProgress | null;
  unitsCompleted: number;
  unitsTotal: number;
}

/**
 * Everything the Dashboard shows, in one call: today's status, lifetime totals,
 * the unit to resume, and unit completion counts. Composes the existing typed
 * queries so all SQL stays in db/.
 */
export async function getDashboardData(now: Date = new Date()): Promise<DashboardData> {
  const [status, state, units] = await Promise.all([
    getStudyStatus(now),
    getAppState(),
    getUnits(),
  ]);

  const continueUnit =
    units.find((u) => u.status === 'in_progress') ??
    units.find((u) => u.status === 'available') ??
    null;
  const unitsCompleted = units.filter((u) => u.status === 'completed').length;

  return {
    status,
    totals: {
      reviews: state.total_reviews,
      wordsLearned: state.total_new_learned,
      longestStreak: state.longest_streak,
    },
    continueUnit,
    unitsCompleted,
    unitsTotal: units.length,
  };
}

export interface DayCount {
  /** Local date YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface StatsData {
  /** Reviews done on each of the last 14 local days (oldest first, zero-filled). */
  reviewsByDay: DayCount[];
  /** How many reviews landed on each FSRS rating. */
  ratingCounts: { again: number; hard: number; good: number; easy: number };
  totalReviews: number;
  /** Share of reviews rated Good or Easy, or null when there are no reviews yet. */
  retentionPct: number | null;
  /** Live card population by scheduler state. */
  cardStates: { new: number; learning: number; review: number; relearning: number };
  /** Cards coming due over the next 14 local days (overdue folded into day 0). */
  forecast: DayCount[];
}

/** Build the last `n` local dates ending today, oldest first (YYYY-MM-DD). */
function lastLocalDates(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}

/** Build the next `n` local dates starting today, soonest first (YYYY-MM-DD). */
function nextLocalDates(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(localDateStr(d));
  }
  return out;
}

/** Everything the Stats screen charts: history, retention, card mix, forecast. */
export async function getStatsData(now: Date = new Date()): Promise<StatsData> {
  const db = await getDb();

  const [reviewRows, ratingRows, stateRows, dueRows] = await Promise.all([
    db.select<{ d: string; n: number }[]>(
      "SELECT date(reviewed_at, 'localtime') AS d, COUNT(*) AS n FROM review_logs GROUP BY d",
    ),
    db.select<{ rating: number; n: number }[]>(
      'SELECT rating, COUNT(*) AS n FROM review_logs GROUP BY rating',
    ),
    db.select<{ state: string; n: number }[]>(
      'SELECT state, COUNT(*) AS n FROM cards GROUP BY state',
    ),
    db.select<{ d: string; n: number }[]>(
      `SELECT date(due, 'localtime') AS d, COUNT(*) AS n FROM cards
        WHERE state != 'new' AND due IS NOT NULL GROUP BY d`,
    ),
  ]);

  // Reviews per day: zero-fill the last 14 local days.
  const reviewMap = new Map(reviewRows.map((r) => [r.d, r.n]));
  const reviewsByDay = lastLocalDates(now, 14).map((date) => ({
    date,
    count: reviewMap.get(date) ?? 0,
  }));

  // Rating distribution + retention (good+easy share of all reviews).
  const rc = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of ratingRows) {
    if (r.rating === 1) rc.again = r.n;
    else if (r.rating === 2) rc.hard = r.n;
    else if (r.rating === 3) rc.good = r.n;
    else if (r.rating === 4) rc.easy = r.n;
  }
  const totalReviews = rc.again + rc.hard + rc.good + rc.easy;
  const retentionPct =
    totalReviews === 0 ? null : Math.round(((rc.good + rc.easy) / totalReviews) * 100);

  // Card-state mix.
  const stateMap = new Map(stateRows.map((r) => [r.state, r.n]));
  const cardStates = {
    new: stateMap.get('new') ?? 0,
    learning: stateMap.get('learning') ?? 0,
    review: stateMap.get('review') ?? 0,
    relearning: stateMap.get('relearning') ?? 0,
  };

  // Forecast: bucket due-dates into the next 14 days; anything overdue → today.
  const dates = nextLocalDates(now, 14);
  const dateIndex = new Map(dates.map((d, i) => [d, i]));
  const forecastCounts = new Array<number>(14).fill(0);
  const today = dates[0]!;
  for (const row of dueRows) {
    if (row.d <= today) {
      forecastCounts[0]! += row.n; // overdue + due today
    } else {
      const idx = dateIndex.get(row.d);
      if (idx !== undefined) forecastCounts[idx]! += row.n;
    }
  }
  const forecast = dates.map((date, i) => ({ date, count: forecastCounts[i]! }));

  return { reviewsByDay, ratingCounts: rc, totalReviews, retentionPct, cardStates, forecast };
}

/**
 * Wipe all study progress back to a fresh install, keeping the curriculum
 * content intact: clears review history, resets every card to 'new', zeroes
 * app_state (streak/XP/counters), and re-locks all units except the first.
 */
export async function resetProgress(): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM review_logs');
  await db.execute(
    `UPDATE cards SET
        state = 'new', due = NULL, stability = NULL, difficulty = NULL,
        elapsed_days = 0, scheduled_days = 0, reps = 0, lapses = 0, last_review = NULL`,
  );
  await db.execute(
    `UPDATE app_state SET
        streak_count = 0, longest_streak = 0, last_active_date = NULL,
        total_reviews = 0, total_new_learned = 0, xp = 0
      WHERE id = 1`,
  );
  // Mirror the seed: the first unit is available, everything else locked.
  await db.execute(
    `UPDATE unit_progress SET
        status = CASE WHEN unit_id = (SELECT MIN(id) FROM units)
                      THEN 'available' ELSE 'locked' END,
        lessons_done = '[]', completed_at = NULL`,
  );
}

// --- library (browsable/searchable vocab + sentences) ---

/** How well an item is known, derived from its FSRS card state. */
export type Mastery = 'new' | 'learning' | 'known';

/** Map an FSRS card state to a coarse mastery level for the library badge. */
function masteryFromState(state: CardState | null): Mastery {
  if (state === 'review') return 'known';
  if (state === 'learning' || state === 'relearning') return 'learning';
  return 'new'; // 'new' or (defensively) no card
}

export interface LibraryVocabItem {
  id: number;
  fr: string;
  en: string;
  ipa: string | null;
  gender: Gender;
  audioPath: string | null;
  unitTitle: string;
  level: Level;
  mastery: Mastery;
}

/** All authored vocabulary with its unit, audio, and mastery (small: ~400 rows,
 *  so the screen filters/searches this client-side). */
export async function getLibraryVocab(): Promise<LibraryVocabItem[]> {
  const db = await getDb();
  const rows = await db.select<
    (VocabRow & { title_en: string; level: Level; state: CardState | null })[]
  >(
    `SELECT v.*, u.title_en, u.level, c.state
       FROM vocab v
       JOIN units u ON u.id = v.unit_id
       LEFT JOIN cards c ON c.item_type = 'vocab' AND c.item_id = v.id
      ORDER BY
        CASE u.level WHEN 'A1' THEN 0 WHEN 'A2' THEN 1 ELSE 2 END,
        u.order_index ASC, v.id ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    fr: r.lemma_fr,
    en: r.translation_en,
    ipa: r.ipa,
    gender: r.gender,
    audioPath: r.audio_path,
    unitTitle: r.title_en,
    level: r.level,
    mastery: masteryFromState(r.state),
  }));
}

export interface LibrarySentenceItem {
  id: number;
  fr: string;
  en: string;
  audioPath: string | null;
  /** null when the sentence is reference-only (a pool sentence with no card). */
  mastery: Mastery | null;
}

function toSentenceItem(r: {
  id: number;
  fr: string;
  en: string;
  audio_path: string | null;
  state: CardState | null;
}): LibrarySentenceItem {
  return {
    id: r.id,
    fr: r.fr,
    en: r.en,
    audioPath: r.audio_path,
    mastery: r.state === null ? null : masteryFromState(r.state),
  };
}

/**
 * Search sentences for the library. Empty query returns the authored (in-unit)
 * sentences; a query does a LIKE over the full pool (French or English), with
 * audio-backed results first. Capped by `limit` since the pool is ~30k rows.
 */
export async function searchLibrarySentences(
  query: string,
  limit = 40,
): Promise<LibrarySentenceItem[]> {
  const db = await getDb();
  const q = query.trim();
  type Row = { id: number; fr: string; en: string; audio_path: string | null; state: CardState | null };

  if (q === '') {
    const rows = await db.select<Row[]>(
      `SELECT s.id, s.text_fr AS fr, s.text_en AS en, s.audio_path, c.state
         FROM sentences s
         LEFT JOIN cards c ON c.item_type = 'sentence' AND c.item_id = s.id
        WHERE s.unit_id IS NOT NULL
        ORDER BY s.id ASC
        LIMIT $1`,
      [limit],
    );
    return rows.map(toSentenceItem);
  }

  const like = `%${q}%`;
  const rows = await db.select<Row[]>(
    `SELECT s.id, s.text_fr AS fr, s.text_en AS en, s.audio_path, c.state
       FROM sentences s
       LEFT JOIN cards c ON c.item_type = 'sentence' AND c.item_id = s.id
      WHERE s.text_fr LIKE $1 OR s.text_en LIKE $1
      ORDER BY (s.audio_path IS NOT NULL) DESC, s.difficulty_score ASC
      LIMIT $2`,
    [like, limit],
  );
  return rows.map(toSentenceItem);
}

/** Find the card for a given content item, if one exists. */
export async function getCardByItem(
  itemType: CardItemType,
  itemId: number,
): Promise<CardRow | null> {
  const db = await getDb();
  const rows = await db.select<CardRow[]>(
    'SELECT * FROM cards WHERE item_type = $1 AND item_id = $2',
    [itemType, itemId],
  );
  return rows[0] ?? null;
}

// --- curriculum (units, lessons, exercises) ---

export interface UnitWithProgress extends UnitRow {
  status: UnitStatus;
  exercise_count: number;
}

/** All units in curriculum order, each with its unlock status + exercise count. */
export async function getUnits(): Promise<UnitWithProgress[]> {
  const db = await getDb();
  return db.select<UnitWithProgress[]>(
    `SELECT u.*,
            COALESCE(p.status, 'locked') AS status,
            (SELECT COUNT(*) FROM exercises e WHERE e.unit_id = u.id) AS exercise_count
       FROM units u
       LEFT JOIN unit_progress p ON p.unit_id = u.id
      ORDER BY
        CASE u.level WHEN 'A1' THEN 0 WHEN 'A2' THEN 1 ELSE 2 END,
        u.order_index ASC`,
  );
}

export async function getUnitById(id: number): Promise<UnitWithProgress | null> {
  const db = await getDb();
  const rows = await db.select<UnitWithProgress[]>(
    `SELECT u.*,
            COALESCE(p.status, 'locked') AS status,
            (SELECT COUNT(*) FROM exercises e WHERE e.unit_id = u.id) AS exercise_count
       FROM units u
       LEFT JOIN unit_progress p ON p.unit_id = u.id
      WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

function idPlaceholders(ids: readonly number[]): string {
  return ids.map((_, i) => `$${i + 1}`).join(',');
}

/** Batch-fetch vocab rows by id (for building review flashcards). */
export async function getVocabByIds(ids: readonly number[]): Promise<VocabRow[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select<VocabRow[]>(
    `SELECT * FROM vocab WHERE id IN (${idPlaceholders(ids)})`,
    ids as number[],
  );
}

/** Batch-fetch sentence rows by id. */
export async function getSentencesByIds(ids: readonly number[]): Promise<SentenceRow[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select<SentenceRow[]>(
    `SELECT * FROM sentences WHERE id IN (${idPlaceholders(ids)})`,
    ids as number[],
  );
}

/** Batch-fetch lesson rows by id. */
export async function getLessonsByIds(ids: readonly number[]): Promise<LessonRow[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  return db.select<LessonRow[]>(
    `SELECT * FROM lessons WHERE id IN (${idPlaceholders(ids)})`,
    ids as number[],
  );
}

/** Every exercise for a unit, in stored order. */
export async function getExercisesForUnit(unitId: number): Promise<ExerciseRow[]> {
  const db = await getDb();
  return db.select<ExerciseRow[]>(
    'SELECT * FROM exercises WHERE unit_id = $1 ORDER BY id ASC',
    [unitId],
  );
}

/** Lessons for a unit (grammar, vocab, dialogue, reading), in teaching order. */
export async function getLessonsForUnit(unitId: number): Promise<LessonRow[]> {
  const db = await getDb();
  return db.select<LessonRow[]>(
    'SELECT * FROM lessons WHERE unit_id = $1 ORDER BY order_index ASC',
    [unitId],
  );
}

/** Vocabulary for a unit, in stored order. */
export async function getVocabForUnit(unitId: number): Promise<VocabRow[]> {
  const db = await getDb();
  return db.select<VocabRow[]>('SELECT * FROM vocab WHERE unit_id = $1 ORDER BY id ASC', [
    unitId,
  ]);
}

/** Mark a unit as started (available → in_progress). No-op otherwise. */
export async function markUnitStarted(unitId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE unit_progress SET status = 'in_progress' WHERE unit_id = $1 AND status = 'available'",
    [unitId],
  );
}

export interface UnlockResult {
  /** The next unit that was just unlocked, or null if none/already open. */
  unlockedUnitId: number | null;
  unlockedTitle: string | null;
}

/**
 * Mark a unit completed and unlock the next unit in curriculum order if it is
 * still locked. Returns which unit (if any) was newly unlocked, for the UI.
 */
export async function markUnitCompleted(unitId: number): Promise<UnlockResult> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    "UPDATE unit_progress SET status = 'completed', completed_at = COALESCE(completed_at, $1) WHERE unit_id = $2",
    [now, unitId],
  );

  const units = await getUnits(); // already in curriculum order
  const idx = units.findIndex((u) => u.id === unitId);
  const next = idx >= 0 ? units[idx + 1] : undefined;
  if (next !== undefined && next.status === 'locked') {
    await db.execute("UPDATE unit_progress SET status = 'available' WHERE unit_id = $1", [
      next.id,
    ]);
    return { unlockedUnitId: next.id, unlockedTitle: next.title_en };
  }
  return { unlockedUnitId: null, unlockedTitle: null };
}
