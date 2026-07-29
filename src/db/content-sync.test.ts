import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { syncContent, type SqlExecutor } from './content-sync';

/*
 * Content-sync tests. We build two throwaway in-memory DBs from the real schema
 * — a "user" DB (with progress) and a "seed" DB (newer content) — run the sync,
 * and assert progress survives while content moves forward. Foreign keys are ON
 * so a wrong delete/insert order fails loudly (matching the runtime plugin).
 */

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'migrations', '0001_init.sql'),
  'utf8',
);

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/** Adapt node:sqlite to the SqlExecutor interface, translating `$n` → `?`. */
function adapt(db: DatabaseSync): SqlExecutor {
  const tr = (q: string): string => q.replace(/\$\d+/g, '?');
  return {
    select: async <T>(q: string, v: unknown[] = []): Promise<T> =>
      db.prepare(tr(q)).all(...(v as never[])) as T,
    execute: async (q: string, v: unknown[] = []): Promise<unknown> =>
      db.prepare(tr(q)).run(...(v as never[])),
  };
}

function setVersion(db: DatabaseSync, v: number): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('content_version', ?) " +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(String(v));
}

function getVersion(db: DatabaseSync): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'content_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

function addUnit(db: DatabaseSync, id: number, slug: string, order = 0): void {
  db.prepare(
    'INSERT INTO units (id, level, order_index, slug, title_en, title_fr, theme, grammar_focus, description) ' +
      "VALUES (?, 'A1', ?, ?, ?, ?, 'theme', 'grammar', 'desc')",
  ).run(id, order, slug, slug, slug);
  db.prepare('INSERT INTO unit_progress (unit_id, status) VALUES (?, ?)').run(
    id,
    order === 0 ? 'available' : 'locked',
  );
}

function addVocab(db: DatabaseSync, id: number, unitId: number, lemma: string): void {
  db.prepare(
    "INSERT INTO vocab (id, unit_id, lemma_fr, translation_en, gender) VALUES (?, ?, ?, 'x', 'na')",
  ).run(id, unitId, lemma);
  db.prepare("INSERT OR IGNORE INTO cards (item_type, item_id, state) VALUES ('vocab', ?, 'new')").run(id);
}

function addGrammar(db: DatabaseSync, id: number, unitId: number, body: string, order = 0): void {
  db.prepare(
    "INSERT INTO lessons (id, unit_id, order_index, type, title, body_markdown) VALUES (?, ?, ?, 'grammar', 'T', ?)",
  ).run(id, unitId, order, body);
  db.prepare("INSERT OR IGNORE INTO cards (item_type, item_id, state) VALUES ('grammar', ?, 'new')").run(id);
}

function cardId(db: DatabaseSync, type: string, item: number): number {
  const row = db.prepare('SELECT id FROM cards WHERE item_type = ? AND item_id = ?').get(type, item) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`no card for ${type}:${item}`);
  return row.id;
}

/** Mark a card as studied so we can prove its FSRS state survives a sync. */
function studyCard(db: DatabaseSync, type: string, item: number): void {
  db.prepare(
    "UPDATE cards SET state = 'review', stability = 12.5, difficulty = 6.0, reps = 4 " +
      'WHERE item_type = ? AND item_id = ?',
  ).run(type, item);
}

function count(db: DatabaseSync, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...(params as never[])) as { c: number };
  return row.c;
}

describe('syncContent', () => {
  it('is a no-op when the user is already current', async () => {
    const user = makeDb();
    const seed = makeDb();
    addUnit(user, 10, 'a1-x');
    addUnit(seed, 10, 'a1-x');
    setVersion(user, 3);
    setVersion(seed, 3);

    const result = await syncContent(adapt(user), adapt(seed));
    expect(result).toEqual({ from: 3, to: 3, changed: false });
  });

  it('updates edited content in place while preserving a studied card', async () => {
    const user = makeDb();
    const seed = makeDb();
    addUnit(user, 10, 'a1-x');
    addGrammar(user, 100, 10, 'old body');
    studyCard(user, 'grammar', 100);
    setVersion(user, 1);

    addUnit(seed, 10, 'a1-x');
    addGrammar(seed, 100, 10, 'new body');
    setVersion(seed, 2);

    const result = await syncContent(adapt(user), adapt(seed));

    expect(result.changed).toBe(true);
    expect(getVersion(user)).toBe(2);
    // Content moved forward…
    const lesson = user.prepare('SELECT body_markdown FROM lessons WHERE id = 100').get() as {
      body_markdown: string;
    };
    expect(lesson.body_markdown).toBe('new body');
    // …but the studied card kept its FSRS state (same id, not reset to 'new').
    const card = user
      .prepare("SELECT state, stability, reps FROM cards WHERE item_type = 'grammar' AND item_id = 100")
      .get() as { state: string; stability: number; reps: number };
    expect(card).toEqual({ state: 'review', stability: 12.5, reps: 4 });
  });

  it('adds cards for new content without touching existing progress', async () => {
    const user = makeDb();
    const seed = makeDb();
    addUnit(user, 10, 'a1-x');
    addVocab(user, 100, 10, 'bonjour');
    studyCard(user, 'vocab', 100);
    setVersion(user, 1);

    addUnit(seed, 10, 'a1-x');
    addVocab(seed, 100, 10, 'bonjour');
    addUnit(seed, 20, 'a1-y', 1);
    addVocab(seed, 200, 20, 'merci');
    setVersion(seed, 2);

    await syncContent(adapt(user), adapt(seed));

    // New unit + vocab present; new card is fresh; unit_progress row created.
    expect(count(user, 'SELECT COUNT(*) c FROM units')).toBe(2);
    const newCard = user
      .prepare("SELECT state FROM cards WHERE item_type = 'vocab' AND item_id = 200")
      .get() as { state: string };
    expect(newCard.state).toBe('new');
    expect(count(user, 'SELECT COUNT(*) c FROM unit_progress WHERE unit_id = 20')).toBe(1);
    // Existing studied card untouched.
    const old = user
      .prepare("SELECT state FROM cards WHERE item_type = 'vocab' AND item_id = 100")
      .get() as { state: string };
    expect(old.state).toBe('review');
  });

  it('prunes removed content along with its cards and review logs', async () => {
    const user = makeDb();
    const seed = makeDb();
    addUnit(user, 10, 'a1-x');
    addVocab(user, 100, 10, 'keep');
    addVocab(user, 101, 10, 'drop');
    // Give the doomed card a review log to prove logs are cleaned too.
    const doomed = cardId(user, 'vocab', 101);
    user
      .prepare(
        "INSERT INTO review_logs (card_id, rating, state, reviewed_at) VALUES (?, 3, 'review', '2026-01-01')",
      )
      .run(doomed);
    setVersion(user, 1);

    addUnit(seed, 10, 'a1-x');
    addVocab(seed, 100, 10, 'keep');
    setVersion(seed, 2);

    await syncContent(adapt(user), adapt(seed));

    expect(count(user, 'SELECT COUNT(*) c FROM vocab WHERE id = 101')).toBe(0);
    expect(count(user, "SELECT COUNT(*) c FROM cards WHERE item_type = 'vocab' AND item_id = 101")).toBe(0);
    expect(count(user, 'SELECT COUNT(*) c FROM review_logs WHERE card_id = ?', doomed)).toBe(0);
    // The kept vocab and its card remain.
    expect(count(user, "SELECT COUNT(*) c FROM cards WHERE item_type = 'vocab' AND item_id = 100")).toBe(1);
  });

  it('leaves the Tatoeba pool (unit_id IS NULL) untouched', async () => {
    const user = makeDb();
    const seed = makeDb();
    addUnit(user, 10, 'a1-x');
    // A pool sentence with no unit — not part of content-sync.
    user
      .prepare(
        "INSERT INTO sentences (id, text_fr, text_en, difficulty_score, word_count, unit_id) VALUES (999, 'salut', 'hi', 1.0, 1, NULL)",
      )
      .run();
    setVersion(user, 1);
    addUnit(seed, 10, 'a1-x');
    setVersion(seed, 2);

    await syncContent(adapt(user), adapt(seed));

    expect(count(user, 'SELECT COUNT(*) c FROM sentences WHERE id = 999')).toBe(1);
  });

  it('resets stale ids on the version-0 transition but keeps streak/XP', async () => {
    const user = makeDb();
    const seed = makeDb();
    // Old autoincrement-style content the user studied, with version 0 (no key).
    addUnit(user, 1, 'a1-x');
    addVocab(user, 1, 1, 'bonjour');
    studyCard(user, 'vocab', 1);
    user
      .prepare('UPDATE app_state SET streak_count = 7, longest_streak = 9, xp = 420 WHERE id = 1')
      .run();
    // note: no content_version key → reads as 0.

    // New hash-id content.
    const U = 281474976710001;
    const V = 281474976710002;
    addUnit(seed, U, 'a1-x');
    addVocab(seed, V, U, 'bonjour');
    setVersion(seed, 1);

    const result = await syncContent(adapt(user), adapt(seed));

    expect(result).toEqual({ from: 0, to: 1, changed: true });
    // Stale autoincrement rows are gone; new hash content is in.
    expect(count(user, 'SELECT COUNT(*) c FROM units WHERE id = 1')).toBe(0);
    expect(count(user, 'SELECT COUNT(*) c FROM units WHERE id = ?', U)).toBe(1);
    // The card set is reset to the new content (fresh 'new' state).
    const card = user
      .prepare('SELECT state FROM cards WHERE item_type = ? AND item_id = ?')
      .get('vocab', V) as { state: string };
    expect(card.state).toBe('new');
    expect(count(user, "SELECT COUNT(*) c FROM cards WHERE state = 'review'")).toBe(0);
    // …but id-independent progress (streak / XP) is preserved.
    const app = user.prepare('SELECT streak_count, longest_streak, xp FROM app_state WHERE id = 1').get() as {
      streak_count: number;
      longest_streak: number;
      xp: number;
    };
    expect(app).toEqual({ streak_count: 7, longest_streak: 9, xp: 420 });
  });
});
