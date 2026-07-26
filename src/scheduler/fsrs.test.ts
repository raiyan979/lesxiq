import { describe, it, expect } from 'vitest';
import { Rating } from 'ts-fsrs';
import { makeScheduler, deriveRating, formatInterval, GRADES } from './fsrs';
import type { CardRow } from '../db/types';

const NOW = new Date('2026-07-19T12:00:00.000Z');
const DAY = 86_400_000;

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: 1,
    item_type: 'vocab',
    item_id: 1,
    state: 'new',
    due: null,
    stability: null,
    difficulty: null,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    last_review: null,
    ...overrides,
  };
}

/** A card already in review, last seen 10 days ago and now due. */
function reviewCard(overrides: Partial<CardRow> = {}): CardRow {
  return card({
    state: 'review',
    due: new Date(NOW.getTime() - DAY).toISOString(),
    stability: 12,
    difficulty: 5,
    elapsed_days: 10,
    scheduled_days: 10,
    reps: 4,
    lapses: 0,
    last_review: new Date(NOW.getTime() - 10 * DAY).toISOString(),
    ...overrides,
  });
}

describe('deriveRating', () => {
  it('maps a wrong answer to Again', () => {
    expect(deriveRating({ correct: false, usedHint: false, slow: false })).toBe(Rating.Again);
    // a wrong answer with a hint is still Again
    expect(deriveRating({ correct: false, usedHint: true, slow: true })).toBe(Rating.Again);
  });

  it('maps a correct-but-hinted or slow answer to Hard', () => {
    expect(deriveRating({ correct: true, usedHint: true, slow: false })).toBe(Rating.Hard);
    expect(deriveRating({ correct: true, usedHint: false, slow: true })).toBe(Rating.Hard);
  });

  it('maps a clean correct answer to Good, never Easy', () => {
    const r = deriveRating({ correct: true, usedHint: false, slow: false });
    expect(r).toBe(Rating.Good);
    expect(r).not.toBe(Rating.Easy);
  });
});

describe('previewIntervals', () => {
  it('returns the four grades in Again→Easy order with matching labels', () => {
    const rows = makeScheduler().previewIntervals(card(), NOW);
    expect(rows.map((r) => r.rating)).toEqual([...GRADES]);
    expect(rows.map((r) => r.label)).toEqual(['Again', 'Hard', 'Good', 'Easy']);
  });

  it('produces non-decreasing intervals (Again ≤ Hard ≤ Good ≤ Easy)', () => {
    const rows = makeScheduler().previewIntervals(reviewCard(), NOW);
    const days = rows.map((r) => r.days);
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!).toBeGreaterThanOrEqual(days[i - 1]!);
    }
    // Easy on a matured card should schedule meaningfully far out.
    expect(days.at(-1)!).toBeGreaterThan(days[0]!);
  });
});

describe('applyRating', () => {
  it('advances a new card out of "new" and records the first rep', () => {
    const { card: next, log } = makeScheduler().applyRating(card(), Rating.Good, NOW);
    expect(next.state).not.toBe('new');
    expect(next.reps).toBe(1);
    expect(new Date(next.due).getTime()).toBeGreaterThan(NOW.getTime());
    expect(log.rating).toBe(Rating.Good);
    expect(new Date(log.reviewed_at).getTime()).toBe(NOW.getTime());
  });

  it('increments lapses when a review card is failed (Again)', () => {
    const row = reviewCard({ lapses: 2 });
    const { card: next } = makeScheduler().applyRating(row, Rating.Again, NOW);
    expect(next.lapses).toBe(3);
  });

  it('is deterministic — same inputs schedule the same due date', () => {
    const a = makeScheduler().applyRating(reviewCard(), Rating.Good, NOW);
    const b = makeScheduler().applyRating(reviewCard(), Rating.Good, NOW);
    expect(a.card.due).toBe(b.card.due);
  });

  it('records the pre-transition state in the log', () => {
    const { log } = makeScheduler().applyRating(reviewCard(), Rating.Good, NOW);
    expect(log.state).toBe('review');
  });
});

describe('formatInterval', () => {
  it('formats minutes, hours, days, months and years', () => {
    expect(formatInterval(new Date(NOW.getTime() + 10 * 60_000), NOW)).toBe('10m');
    expect(formatInterval(new Date(NOW.getTime() + 5 * 3_600_000), NOW)).toBe('5h');
    expect(formatInterval(new Date(NOW.getTime() + 2 * DAY), NOW)).toBe('2d');
    expect(formatInterval(new Date(NOW.getTime() + 90 * DAY), NOW)).toBe('3mo');
    expect(formatInterval(new Date(NOW.getTime() + 730 * DAY), NOW)).toBe('2.0y');
  });

  it('never shows 0m for a positive interval', () => {
    expect(formatInterval(new Date(NOW.getTime() + 20_000), NOW)).toBe('1m');
  });
});
