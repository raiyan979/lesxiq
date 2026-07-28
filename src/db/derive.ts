/*
 * Pure derivations for the DB layer: date bucketing, streak logic, mastery
 * mapping, and the stats-screen shaping. These take already-fetched rows (or
 * plain values) and return shaped results with no I/O, so they are unit-tested
 * directly (derive.test.ts) instead of only through the live database.
 *
 * queries.ts fetches the rows and calls into here; keeping the logic pure means
 * the tricky bits — zero-filling days, folding overdue cards, streak resets —
 * are guarded by tests rather than throwaway scripts.
 */

import type { CardState } from './types';

// --- local-date helpers (streaks and day buckets are local, not UTC) ---

/** Local calendar date as YYYY-MM-DD. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function previousDateStr(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return localDateStr(x);
}

/** Start-of-local-day as an ISO instant (for "since midnight" comparisons). */
export function startOfDayIso(now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** The last `n` local dates ending today, oldest first. */
export function lastLocalDates(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}

/** The next `n` local dates starting today, soonest first. */
export function nextLocalDates(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    out.push(localDateStr(d));
  }
  return out;
}

// --- streak logic ---

/**
 * The streak count after activity on `now`, given the previous last-active date
 * and count: unchanged if already active today, +1 if the last active day was
 * yesterday, otherwise reset to 1.
 */
export function nextStreak(
  lastActiveDate: string | null,
  current: number,
  now: Date,
): number {
  if (lastActiveDate === localDateStr(now)) return current;
  if (lastActiveDate === previousDateStr(now)) return current + 1;
  return 1;
}

/** A streak only "counts" if the last active day was today or yesterday. */
export function isStreakAlive(lastActiveDate: string | null, now: Date): boolean {
  return (
    lastActiveDate === localDateStr(now) || lastActiveDate === previousDateStr(now)
  );
}

// --- mastery (for the library badges) ---

export type Mastery = 'new' | 'learning' | 'known';

/** Map an FSRS card state to a coarse mastery level. */
export function masteryFromState(state: CardState | null): Mastery {
  if (state === 'review') return 'known';
  if (state === 'learning' || state === 'relearning') return 'learning';
  return 'new'; // 'new' or (defensively) no card
}

// --- stats-screen shaping ---

export interface DayCount {
  /** Local date YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface RatingCounts {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface CardStateCounts {
  new: number;
  learning: number;
  review: number;
  relearning: number;
}

/** Zero-fill reviews-per-day over the last `days` local days from grouped rows. */
export function zeroFillReviews(
  rows: { d: string; n: number }[],
  now: Date,
  days = 14,
): DayCount[] {
  const map = new Map(rows.map((r) => [r.d, r.n]));
  return lastLocalDates(now, days).map((date) => ({ date, count: map.get(date) ?? 0 }));
}

/** Tally review_logs rating rows (1..4) into named buckets. */
export function tallyRatings(rows: { rating: number; n: number }[]): RatingCounts {
  const rc: RatingCounts = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const r of rows) {
    if (r.rating === 1) rc.again = r.n;
    else if (r.rating === 2) rc.hard = r.n;
    else if (r.rating === 3) rc.good = r.n;
    else if (r.rating === 4) rc.easy = r.n;
  }
  return rc;
}

/** Share of reviews rated Good or Easy, or null when there are none. */
export function retentionPct(rc: RatingCounts): number | null {
  const total = rc.again + rc.hard + rc.good + rc.easy;
  if (total === 0) return null;
  return Math.round(((rc.good + rc.easy) / total) * 100);
}

/** Tally card-state rows into fixed buckets. */
export function tallyCardStates(rows: { state: string; n: number }[]): CardStateCounts {
  const map = new Map(rows.map((r) => [r.state, r.n]));
  return {
    new: map.get('new') ?? 0,
    learning: map.get('learning') ?? 0,
    review: map.get('review') ?? 0,
    relearning: map.get('relearning') ?? 0,
  };
}

/**
 * Bucket due-date rows into the next `days` local days, oldest first. Anything
 * due today or overdue folds into day 0; anything beyond the window is dropped.
 */
export function bucketForecast(
  rows: { d: string; n: number }[],
  now: Date,
  days = 14,
): DayCount[] {
  const dates = nextLocalDates(now, days);
  const index = new Map(dates.map((d, i) => [d, i]));
  const counts = new Array<number>(days).fill(0);
  const today = dates[0]!;
  for (const row of rows) {
    if (row.d <= today) {
      counts[0]! += row.n; // overdue + due today
    } else {
      const idx = index.get(row.d);
      if (idx !== undefined) counts[idx]! += row.n;
    }
  }
  return dates.map((date, i) => ({ date, count: counts[i]! }));
}

// --- dashboard ---

/** Integer percentage `part`/`whole`, clamped 0..100 (0 when whole is 0). */
export function progressPct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** The unit to resume: first in-progress, else first available, else null. */
export function pickContinueUnit<T extends { status: string }>(units: readonly T[]): T | null {
  return (
    units.find((u) => u.status === 'in_progress') ??
    units.find((u) => u.status === 'available') ??
    null
  );
}
