/*
 * Thin, PURE wrapper over ts-fsrs (brief §5). No database, no I/O, no clock of
 * its own — every function takes an explicit `now` so it is fully deterministic
 * and unit-testable. The DB orchestration (loading the queue, persisting a
 * grade) lives in scheduler/queue.ts; this file only does the FSRS math and the
 * CardRow ⇄ ts-fsrs Card conversion.
 *
 * Design note: we run with `enable_short_term: false`, which disables FSRS
 * (re)learning steps. That means ts-fsrs never needs to persist a
 * `learning_steps` value between reviews — matching our fixed schema (§3), whose
 * `cards` table has no such column. `enable_fuzz: false` keeps scheduling
 * reproducible (same card + rating + now → same interval).
 */

import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';
import type { CardRow, CardState } from '../db/types';

export const SCHEDULER_CONFIG = {
  /** Fallback retention if the `target_retention` setting is missing. */
  defaultRetention: 0.9,
} as const;

/** The four grade buttons, in display order (always all shown, brief §5). */
export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

export type GradeLabel = 'Again' | 'Hard' | 'Good' | 'Easy';

const RATING_LABEL: Record<Grade, GradeLabel> = {
  [Rating.Again]: 'Again',
  [Rating.Hard]: 'Hard',
  [Rating.Good]: 'Good',
  [Rating.Easy]: 'Easy',
};

const STATE_TO_STRING: Record<State, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const STRING_TO_STATE: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

/** What a single grade button would schedule, for the preview row. */
export interface IntervalPreview {
  rating: Grade;
  label: GradeLabel;
  /** Approximate days until the card is next due for this choice. */
  days: number;
  /** Human-readable interval, e.g. "10m", "4h", "3d", "2mo". */
  interval: string;
}

/** The `cards` scheduling columns produced by a review (all non-null). */
export interface CardScheduling {
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string;
}

/** A row to append to `review_logs` for one graded review. */
export interface ReviewLogFields {
  rating: 1 | 2 | 3 | 4;
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reviewed_at: string;
}

/** Signals from an exercise attempt used to derive a suggested rating. */
export interface AttemptOutcome {
  correct: boolean;
  usedHint: boolean;
  slow: boolean;
}

/**
 * Map an exercise outcome to the suggested FSRS grade (brief §5). The UI still
 * shows all four buttons; this is only the pre-highlighted default, and the user
 * can always override (e.g. pick Easy).
 */
export function deriveRating(outcome: AttemptOutcome): Grade {
  if (!outcome.correct) return Rating.Again;
  if (outcome.usedHint || outcome.slow) return Rating.Hard;
  return Rating.Good;
}

/** Format a future due date relative to `now` as a compact interval string. */
export function formatInterval(due: Date, now: Date): string {
  const minutes = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export interface Scheduler {
  /** Reconstruct a ts-fsrs Card from a stored row (exposed for testing). */
  toFsrsCard(row: CardRow, now: Date): Card;
  /** The four button previews for a card, in Again→Easy order. */
  previewIntervals(row: CardRow, now: Date): IntervalPreview[];
  /** Apply a grade, returning the card update + the review-log row to persist. */
  applyRating(
    row: CardRow,
    rating: Grade,
    now: Date,
  ): { card: CardScheduling; log: ReviewLogFields };
}

/**
 * Build a scheduler bound to a target retention. Cheap to construct; callers may
 * make one per grade or reuse one.
 */
export function makeScheduler(
  targetRetention: number = SCHEDULER_CONFIG.defaultRetention,
): Scheduler {
  const f: FSRS = fsrs({
    request_retention: targetRetention,
    enable_short_term: false,
    enable_fuzz: false,
  });

  function toFsrsCard(row: CardRow, now: Date): Card {
    if (row.state === 'new') {
      // A brand-new card: an empty card due now. reps/lapses are 0 in the seed.
      return createEmptyCard(now);
    }
    return {
      due: row.due ? new Date(row.due) : now,
      stability: row.stability ?? 0,
      difficulty: row.difficulty ?? 0,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      learning_steps: 0,
      reps: row.reps,
      lapses: row.lapses,
      state: STRING_TO_STATE[row.state],
      last_review: row.last_review ? new Date(row.last_review) : undefined,
    };
  }

  function previewIntervals(row: CardRow, now: Date): IntervalPreview[] {
    const card = toFsrsCard(row, now);
    const preview = f.repeat(card, now);
    return GRADES.map((rating) => {
      const due = preview[rating].card.due;
      return {
        rating,
        label: RATING_LABEL[rating],
        days: Math.round((due.getTime() - now.getTime()) / 86_400_000),
        interval: formatInterval(due, now),
      };
    });
  }

  function applyRating(
    row: CardRow,
    rating: Grade,
    now: Date,
  ): { card: CardScheduling; log: ReviewLogFields } {
    const { card: next, log } = f.next(toFsrsCard(row, now), now, rating);
    return {
      card: {
        state: STATE_TO_STRING[next.state],
        due: next.due.toISOString(),
        stability: next.stability,
        difficulty: next.difficulty,
        elapsed_days: next.elapsed_days,
        scheduled_days: next.scheduled_days,
        reps: next.reps,
        lapses: next.lapses,
        last_review: (next.last_review ?? now).toISOString(),
      },
      log: {
        rating,
        // log.state is the card's state *at review time* (pre-transition).
        state: STATE_TO_STRING[log.state],
        due: log.due.toISOString(),
        stability: log.stability,
        difficulty: log.difficulty,
        elapsed_days: log.elapsed_days,
        scheduled_days: log.scheduled_days,
        reviewed_at: log.review.toISOString(),
      },
    };
  }

  return { toFsrsCard, previewIntervals, applyRating };
}
