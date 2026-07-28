import { describe, it, expect } from 'vitest';
import {
  localDateStr,
  previousDateStr,
  lastLocalDates,
  nextLocalDates,
  nextStreak,
  isStreakAlive,
  masteryFromState,
  zeroFillReviews,
  tallyRatings,
  retentionPct,
  tallyCardStates,
  bucketForecast,
  pickContinueUnit,
  progressPct,
} from './derive';

// A fixed local reference day (months are 0-indexed → July 26 2026, a Sunday).
const NOW = new Date(2026, 6, 26);
/** Local date string offset by `days` from NOW. */
const ds = (days: number): string => localDateStr(new Date(2026, 6, 26 + days));

describe('local-date helpers', () => {
  it('zero-pads month and day', () => {
    expect(localDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('previousDateStr crosses month and year boundaries', () => {
    expect(previousDateStr(new Date(2026, 0, 1))).toBe('2025-12-31');
    expect(previousDateStr(new Date(2026, 6, 1))).toBe('2026-06-30');
  });

  it('lastLocalDates ends today, oldest first', () => {
    const d = lastLocalDates(NOW, 14);
    expect(d).toHaveLength(14);
    expect(d[13]).toBe(ds(0)); // today is last
    expect(d[0]).toBe(ds(-13)); // 13 days ago is first
  });

  it('nextLocalDates starts today, soonest first', () => {
    const d = nextLocalDates(NOW, 14);
    expect(d).toHaveLength(14);
    expect(d[0]).toBe(ds(0));
    expect(d[13]).toBe(ds(13));
  });
});

describe('nextStreak', () => {
  it('is unchanged when already active today', () => {
    expect(nextStreak(ds(0), 5, NOW)).toBe(5);
  });
  it('increments when last active yesterday', () => {
    expect(nextStreak(ds(-1), 5, NOW)).toBe(6);
  });
  it('resets to 1 after a gap', () => {
    expect(nextStreak(ds(-3), 5, NOW)).toBe(1);
  });
  it('resets to 1 from a null history', () => {
    expect(nextStreak(null, 0, NOW)).toBe(1);
  });
});

describe('isStreakAlive', () => {
  it('is alive today or yesterday, dead otherwise', () => {
    expect(isStreakAlive(ds(0), NOW)).toBe(true);
    expect(isStreakAlive(ds(-1), NOW)).toBe(true);
    expect(isStreakAlive(ds(-2), NOW)).toBe(false);
    expect(isStreakAlive(null, NOW)).toBe(false);
  });
});

describe('masteryFromState', () => {
  it('maps FSRS states to mastery levels', () => {
    expect(masteryFromState('review')).toBe('known');
    expect(masteryFromState('learning')).toBe('learning');
    expect(masteryFromState('relearning')).toBe('learning');
    expect(masteryFromState('new')).toBe('new');
    expect(masteryFromState(null)).toBe('new');
  });
});

describe('zeroFillReviews', () => {
  it('produces 14 days oldest-first, filling gaps with 0', () => {
    const rows = [
      { d: ds(0), n: 3 },
      { d: ds(-1), n: 2 },
      { d: ds(-13), n: 1 },
    ];
    const out = zeroFillReviews(rows, NOW, 14);
    expect(out).toHaveLength(14);
    expect(out[13]).toEqual({ date: ds(0), count: 3 });
    expect(out[12]).toEqual({ date: ds(-1), count: 2 });
    expect(out[0]).toEqual({ date: ds(-13), count: 1 });
    expect(out[5]!.count).toBe(0); // an untouched day
  });
});

describe('tallyRatings + retentionPct', () => {
  it('tallies ratings by bucket', () => {
    const rc = tallyRatings([
      { rating: 1, n: 1 },
      { rating: 2, n: 1 },
      { rating: 3, n: 2 },
      { rating: 4, n: 1 },
    ]);
    expect(rc).toEqual({ again: 1, hard: 1, good: 2, easy: 1 });
  });
  it('computes retention as good+easy share, rounded', () => {
    // good+easy = 3 of 5 → 60%
    expect(retentionPct({ again: 1, hard: 1, good: 2, easy: 1 })).toBe(60);
  });
  it('returns null retention with no reviews', () => {
    expect(retentionPct({ again: 0, hard: 0, good: 0, easy: 0 })).toBeNull();
  });
});

describe('tallyCardStates', () => {
  it('maps rows into fixed buckets, defaulting missing to 0', () => {
    expect(tallyCardStates([{ state: 'new', n: 10 }, { state: 'review', n: 4 }])).toEqual({
      new: 10,
      learning: 0,
      review: 4,
      relearning: 0,
    });
  });
});

describe('bucketForecast', () => {
  it('folds overdue into day 0, buckets the window, drops beyond it', () => {
    const rows = [
      { d: ds(-5), n: 2 }, // overdue
      { d: ds(0), n: 1 }, // today
      { d: ds(3), n: 2 },
      { d: ds(10), n: 1 },
      { d: ds(30), n: 5 }, // beyond 14-day window → dropped
    ];
    const out = bucketForecast(rows, NOW, 14);
    expect(out).toHaveLength(14);
    expect(out[0]!.count).toBe(3); // 2 overdue + 1 today
    expect(out[3]!.count).toBe(2);
    expect(out[10]!.count).toBe(1);
    expect(out.reduce((a, b) => a + b.count, 0)).toBe(6); // +30d dropped
  });
});

describe('progressPct', () => {
  it('rounds part/whole to an integer percent, clamped 0..100', () => {
    expect(progressPct(1, 14)).toBe(7);
    expect(progressPct(0, 14)).toBe(0);
    expect(progressPct(14, 14)).toBe(100);
    expect(progressPct(0, 0)).toBe(0); // no division by zero
    expect(progressPct(20, 10)).toBe(100); // clamped
  });
});

describe('pickContinueUnit', () => {
  it('prefers in_progress, then available, else null', () => {
    expect(pickContinueUnit([{ status: 'completed' }, { status: 'available' }, { status: 'in_progress' }]))
      .toEqual({ status: 'in_progress' });
    expect(pickContinueUnit([{ status: 'completed' }, { status: 'available' }, { status: 'locked' }]))
      .toEqual({ status: 'available' });
    expect(pickContinueUnit([{ status: 'completed' }, { status: 'locked' }])).toBeNull();
    expect(pickContinueUnit([])).toBeNull();
  });
});
