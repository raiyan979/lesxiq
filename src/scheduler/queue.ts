/*
 * Review-loop orchestration (brief §5). Bridges the pure FSRS wrapper
 * (scheduler/fsrs.ts) and the database (db/queries.ts): builds the day's review
 * queue and persists a graded review. No SQL here — every read/write goes
 * through db/queries.
 */

import type { CardRow } from '../db/types';
import type { Grade } from 'ts-fsrs';
import { makeScheduler, SCHEDULER_CONFIG } from './fsrs';
import {
  getAllSettings,
  getCardById,
  getDueCards,
  getNewCards,
  countNewIntroducedToday,
  updateCardScheduling,
  insertReviewLog,
  recordReview,
  getVocabByIds,
  getSentencesByIds,
  getLessonsByIds,
} from '../db/queries';

const DEFAULT_NEW_PER_DAY = 15;

export interface ReviewQueue {
  /** Cards due for review (already introduced), most overdue first. */
  due: CardRow[];
  /** New cards to introduce today, within the daily cap. */
  fresh: CardRow[];
}

/** Local midnight for `now`, as an ISO string (matches stored UTC ISO times). */
function startOfDayIso(now: Date): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Build today's review queue: all due cards plus new cards up to the remaining
 * daily allowance (`new_cards_per_day` minus those already introduced today).
 */
export async function getReviewQueue(now: Date = new Date()): Promise<ReviewQueue> {
  const settings = await getAllSettings();
  const perDay = Number(settings.new_cards_per_day ?? DEFAULT_NEW_PER_DAY);

  const introducedToday = await countNewIntroducedToday(startOfDayIso(now));
  const remaining = Math.max(0, perDay - introducedToday);

  const [due, fresh] = await Promise.all([
    getDueCards(now.toISOString()),
    getNewCards(remaining),
  ]);
  return { due, fresh };
}

/** A due/new card rendered as a review flashcard. */
export interface ReviewItem {
  card: CardRow;
  kind: 'vocab' | 'sentence' | 'grammar';
  /** Prompt shown first (English, or a grammar concept title). */
  front: string;
  /** Answer revealed after (French, or the grammar explanation). */
  back: string;
  ipa: string | null;
  audioPath: string | null;
  /** Grammar backs are markdown; vocab/sentence backs are plain text. */
  backIsMarkdown: boolean;
}

/**
 * Build today's review as an ordered list of flashcards: due cards first, then
 * new ones. Each card's face content is batch-fetched from its source table;
 * any card whose item no longer exists is skipped.
 */
export async function getReviewItems(now: Date = new Date()): Promise<ReviewItem[]> {
  const { due, fresh } = await getReviewQueue(now);
  const cards = [...due, ...fresh];

  const vocabIds = cards.filter((c) => c.item_type === 'vocab').map((c) => c.item_id);
  const sentenceIds = cards.filter((c) => c.item_type === 'sentence').map((c) => c.item_id);
  const grammarIds = cards.filter((c) => c.item_type === 'grammar').map((c) => c.item_id);

  const [vocab, sentences, lessons] = await Promise.all([
    getVocabByIds(vocabIds),
    getSentencesByIds(sentenceIds),
    getLessonsByIds(grammarIds),
  ]);
  const vocabById = new Map(vocab.map((v) => [v.id, v]));
  const sentenceById = new Map(sentences.map((s) => [s.id, s]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const items: ReviewItem[] = [];
  for (const card of cards) {
    if (card.item_type === 'vocab') {
      const v = vocabById.get(card.item_id);
      if (v === undefined) continue;
      items.push({
        card,
        kind: 'vocab',
        front: v.translation_en,
        back: v.lemma_fr,
        ipa: v.ipa,
        audioPath: v.audio_path,
        backIsMarkdown: false,
      });
    } else if (card.item_type === 'sentence') {
      const s = sentenceById.get(card.item_id);
      if (s === undefined) continue;
      items.push({
        card,
        kind: 'sentence',
        front: s.text_en,
        back: s.text_fr,
        ipa: null,
        audioPath: s.audio_path,
        backIsMarkdown: false,
      });
    } else {
      const l = lessonById.get(card.item_id);
      if (l === undefined) continue;
      items.push({
        card,
        kind: 'grammar',
        front: l.title,
        back: l.body_markdown,
        ipa: null,
        audioPath: null,
        backIsMarkdown: true,
      });
    }
  }
  return items;
}

/**
 * Grade one card: schedule its next review, append a review log, and bump the
 * running counters. `durationMs` is how long the user took (nullable).
 */
export async function gradeCard(
  cardId: number,
  rating: Grade,
  durationMs: number | null = null,
  now: Date = new Date(),
): Promise<void> {
  const row = await getCardById(cardId);
  if (row === null) {
    throw new Error(`Cannot grade card ${cardId}: it does not exist.`);
  }

  const settings = await getAllSettings();
  const retention = Number(
    settings.target_retention ?? SCHEDULER_CONFIG.defaultRetention,
  );

  const { card, log } = makeScheduler(retention).applyRating(row, rating, now);

  await updateCardScheduling(cardId, card);
  await insertReviewLog(cardId, log, durationMs);
  await recordReview(row.state === 'new', rating, now);
}
