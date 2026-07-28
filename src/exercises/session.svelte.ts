/*
 * Practice-session state machine (brief §7/§8). Drives one focused loop over a
 * unit's exercises: answer → check (pure grader) → feedback + FSRS rating →
 * next. DB and scheduler live behind db/queries + scheduler/*; this class holds
 * the reactive UI state and the flow, so Session.svelte stays presentational.
 */

import {
  getExercisesForUnit,
  getCardByItem,
  getSetting,
  markUnitStarted,
  markUnitCompleted,
} from '../db/queries';
import { parseExercise, type ExerciseView } from './model';
import {
  gradeMc,
  gradeCloze,
  gradeTypedTranslation,
  gradeListeningDictation,
  gradeWordOrder,
  gradeMatch,
  type GradeResult,
} from './graders';
import {
  makeScheduler,
  deriveRating,
  GRADES,
  SCHEDULER_CONFIG,
  type IntervalPreview,
} from '../scheduler/fsrs';
import { gradeCard } from '../scheduler/queue';
import { stats } from '../ui/stats.svelte';
import type { CardRow } from '../db/types';
import type { Grade } from 'ts-fsrs';

export type Phase = 'loading' | 'answering' | 'feedback' | 'done' | 'empty';

/** Above this, a correct answer is treated as slow → suggests Hard (brief §5). */
const SLOW_MS = 25_000;

export class Session {
  phase = $state<Phase>('loading');
  index = $state(0);
  total = $state(0);
  correctCount = $state(0);

  /** Response holders, one per input style; reset between exercises. */
  mcChoice = $state<string | null>(null);
  text = $state('');
  /** word_order: the bank indices the user has placed, in order. */
  tokens = $state<number[]>([]);
  mapping = $state<Record<string, string>>({});

  /** Feedback state, populated by check(). */
  result = $state<GradeResult | null>(null);
  preview = $state<IntervalPreview[]>([]);
  suggested = $state<Grade | null>(null);

  /** Non-fatal error surfaced to the UI (e.g. a failed DB write on grading). */
  error = $state<string | null>(null);

  /** Set on completion if finishing this unit unlocked the next one. */
  unlockedUnitId = $state<number | null>(null);
  unlockedTitle = $state<string | null>(null);

  #views: ExerciseView[] = [];
  #card: CardRow | null = null;
  #retention: number = SCHEDULER_CONFIG.defaultRetention;
  #startedAt = 0;
  #unitId = 0;

  get current(): ExerciseView | null {
    return this.#views[this.index] ?? null;
  }

  get hasCard(): boolean {
    return this.#card !== null;
  }

  async load(unitId: number): Promise<void> {
    this.phase = 'loading';
    this.#unitId = unitId;
    this.unlockedUnitId = null;
    this.unlockedTitle = null;
    const rows = await getExercisesForUnit(unitId);
    this.#views = rows.map(parseExercise);
    this.total = this.#views.length;
    const retentionSetting = await getSetting('target_retention');
    if (retentionSetting !== null) this.#retention = Number(retentionSetting);

    this.index = 0;
    this.correctCount = 0;
    if (this.total === 0) {
      this.phase = 'empty';
      return;
    }
    // Best-effort: mark the unit started (available → in_progress).
    void markUnitStarted(unitId).catch(() => {});
    this.#beginExercise();
  }

  #beginExercise(): void {
    this.mcChoice = null;
    this.text = '';
    this.tokens = [];
    this.mapping = {};
    this.result = null;
    this.preview = [];
    this.suggested = null;
    this.#card = null;
    this.#startedAt = Date.now();
    this.phase = 'answering';
  }

  /** Whether the current response is complete enough to check. */
  get canCheck(): boolean {
    const c = this.current;
    if (c === null) return false;
    switch (c.type) {
      case 'mc':
        return this.mcChoice !== null;
      case 'cloze':
      case 'typed_translation':
      case 'listening_dictation':
        return this.text.trim().length > 0;
      case 'word_order':
        return this.tokens.length > 0;
      case 'match':
        return c.pairs.every((p) => this.mapping[p.fr] !== undefined);
    }
  }

  async check(): Promise<void> {
    const c = this.current;
    if (c === null || this.phase !== 'answering') return;

    let result: GradeResult;
    switch (c.type) {
      case 'mc':
        result = gradeMc(c.answer, this.mcChoice ?? '');
        break;
      case 'cloze':
        result = gradeCloze(c.answer, c.accepted, this.text);
        break;
      case 'typed_translation':
        result = gradeTypedTranslation(c.answer, c.accepted, this.text);
        break;
      case 'listening_dictation':
        result = gradeListeningDictation(c.answer, c.accepted, this.text);
        break;
      case 'word_order':
        result = gradeWordOrder(
          c.answer,
          c.accepted,
          this.tokens.map((i) => c.bank[i] ?? ''),
        );
        break;
      case 'match':
        result = gradeMatch(c.pairs, this.mapping);
        break;
    }

    this.result = result;
    if (result.correct) this.correctCount++;

    try {
      // Load the linked card (if any) to schedule + preview intervals.
      this.#card =
        c.vocabId !== null
          ? await getCardByItem('vocab', c.vocabId)
          : c.sentenceId !== null
            ? await getCardByItem('sentence', c.sentenceId)
            : null;

      if (this.#card !== null) {
        const elapsed = Date.now() - this.#startedAt;
        const scheduler = makeScheduler(this.#retention);
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient clock value passed to a pure fn, not stored reactive state
        this.preview = scheduler.previewIntervals(this.#card, new Date());
        this.suggested = deriveRating({
          correct: result.correct,
          usedHint: false,
          slow: result.correct && elapsed > SLOW_MS,
        });
      }
    } catch (e) {
      // Card lookup/preview failed — still show feedback, just without ratings.
      this.error = e instanceof Error ? e.message : String(e);
      this.#card = null;
    }
    this.phase = 'feedback';
  }

  /** Apply an FSRS grade to the linked card, then advance. */
  async rate(grade: Grade): Promise<void> {
    if (this.#card !== null) {
      try {
        await gradeCard(this.#card.id, grade, Date.now() - this.#startedAt);
        void stats.refresh(); // update the live status bar (XP, due, streak)
      } catch (e) {
        // Never hang silently: show what failed and let the user retry/skip.
        this.error = e instanceof Error ? e.message : String(e);
        return;
      }
    }
    this.error = null;
    this.#advance();
  }

  /**
   * Practice flow: apply the auto-derived rating (from correctness + speed) and
   * advance. Keeps FSRS scheduling working without asking the learner to
   * self-rate — the single "Next" button in practice calls this. Falls back to
   * Good when there's no linked card (rate() then just advances).
   */
  async next(): Promise<void> {
    await this.rate(this.suggested ?? GRADES[2]!);
  }

  /** Advance without scheduling (used to skip past a failed grade write). */
  skip(): void {
    this.error = null;
    this.#advance();
  }

  /** Advance past an exercise that has no card to schedule. */
  continue(): void {
    this.#advance();
  }

  #advance(): void {
    if (this.index + 1 >= this.total) {
      this.phase = 'done';
      void this.#complete();
      return;
    }
    this.index++;
    this.#beginExercise();
  }

  /** On finishing: mark the unit complete and unlock the next (best-effort). */
  async #complete(): Promise<void> {
    try {
      const result = await markUnitCompleted(this.#unitId);
      this.unlockedUnitId = result.unlockedUnitId;
      this.unlockedTitle = result.unlockedTitle;
    } catch {
      // Progress writeback is non-critical to showing the summary.
    }
  }

  // --- word_order helpers (track used bank indices, in placement order) ---
  addToken(bankIndex: number): void {
    if (!this.tokens.includes(bankIndex)) this.tokens = [...this.tokens, bankIndex];
  }
  removeToken(slot: number): void {
    this.tokens = this.tokens.filter((_, i) => i !== slot);
  }
}
