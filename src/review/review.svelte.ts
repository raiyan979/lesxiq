/*
 * Daily-review state machine (brief §5). Walks the due + new queue as flashcards:
 * show front → reveal back (+ audio) → self-rate with the 4 FSRS buttons → next.
 * Scheduling and queue-building live in scheduler/*; this holds the reactive UI
 * state so Review.svelte stays presentational.
 */

import {
  getReviewItems,
  makeScheduler,
  SCHEDULER_CONFIG,
  gradeCard,
  type ReviewItem,
  type IntervalPreview,
} from '../scheduler';
import { getSetting } from '../db/queries';
import { stats } from '../ui/stats.svelte';
import type { Grade } from 'ts-fsrs';

export type ReviewPhase = 'loading' | 'front' | 'back' | 'done' | 'empty';

export class Review {
  phase = $state<ReviewPhase>('loading');
  index = $state(0);
  total = $state(0);
  reviewed = $state(0);
  error = $state<string | null>(null);
  /** Interval each rating would schedule, shown on the buttons after reveal. */
  preview = $state<IntervalPreview[]>([]);

  #items: ReviewItem[] = [];
  #retention: number = SCHEDULER_CONFIG.defaultRetention;
  #startedAt = 0;

  get current(): ReviewItem | null {
    return this.#items[this.index] ?? null;
  }

  async load(): Promise<void> {
    this.phase = 'loading';
    this.error = null;
    try {
      this.#items = await getReviewItems();
      const retention = await getSetting('target_retention');
      if (retention !== null) this.#retention = Number(retention);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.phase = 'empty';
      return;
    }
    this.total = this.#items.length;
    this.index = 0;
    this.reviewed = 0;
    if (this.total === 0) {
      this.phase = 'empty';
      return;
    }
    this.#beginCard();
  }

  #beginCard(): void {
    this.preview = [];
    this.#startedAt = Date.now();
    this.phase = 'front';
  }

  /** Flip the card: compute the interval preview and show the answer. */
  reveal(): void {
    const item = this.current;
    if (item === null || this.phase !== 'front') return;
    const scheduler = makeScheduler(this.#retention);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient clock value passed to a pure fn
    this.preview = scheduler.previewIntervals(item.card, new Date());
    this.phase = 'back';
  }

  /** Record the self-rating, advance the schedule, and move on. */
  async rate(grade: Grade): Promise<void> {
    const item = this.current;
    if (item === null || this.phase !== 'back') return;
    try {
      await gradeCard(item.card.id, grade, Date.now() - this.#startedAt);
      this.reviewed++;
      void stats.refresh();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return;
    }
    if (this.index + 1 >= this.total) {
      this.phase = 'done';
      return;
    }
    this.index++;
    this.#beginCard();
  }
}
