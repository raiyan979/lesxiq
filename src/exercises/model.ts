/*
 * Parse raw ExerciseRow records into render-ready view models (brief §8). Pure:
 * the only nondeterminism is a one-time shuffle of options/tokens/columns, done
 * once when an exercise is loaded so it stays stable across reactive re-renders.
 * Correctness never depends on this order — that lives in graders.ts.
 */

import type { ExerciseRow, Direction } from '../db/types';
import type { MatchPair } from './graders';

/** Which stored card an exercise drives (for FSRS after grading), if any. */
export interface CardLink {
  vocabId: number | null;
  sentenceId: number | null;
}

interface Base extends CardLink {
  id: number;
  prompt: string;
  direction: Direction | null;
  audioPath: string | null;
}

export type ExerciseView =
  | (Base & { type: 'mc'; answer: string; options: string[] })
  | (Base & { type: 'cloze'; answer: string; accepted: string[] | null })
  | (Base & { type: 'typed_translation'; answer: string; accepted: string[] | null })
  | (Base & { type: 'listening_dictation'; answer: string; accepted: string[] | null })
  | (Base & { type: 'word_order'; answer: string; accepted: string[] | null; bank: string[] })
  | (Base & { type: 'match'; pairs: MatchPair[]; leftFr: string[]; rightEn: string[] });

export type McView = Extract<ExerciseView, { type: 'mc' }>;
export type TextView = Extract<
  ExerciseView,
  { type: 'cloze' | 'typed_translation' | 'listening_dictation' }
>;
export type WordOrderView = Extract<ExerciseView, { type: 'word_order' }>;
export type MatchView = Extract<ExerciseView, { type: 'match' }>;

function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function parseStringArray(json: string | null): string[] | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      return value as string[];
    }
  } catch {
    // fall through to null on malformed JSON
  }
  return null;
}

function parseMatchPairs(json: string): MatchPair[] {
  try {
    const value: unknown = JSON.parse(json);
    if (
      Array.isArray(value) &&
      value.every(
        (v): v is MatchPair =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as MatchPair).fr === 'string' &&
          typeof (v as MatchPair).en === 'string',
      )
    ) {
      return value;
    }
  } catch {
    // fall through
  }
  return [];
}

/** Convert a stored exercise into its view model. */
export function parseExercise(row: ExerciseRow): ExerciseView {
  const base: Base = {
    id: row.id,
    prompt: row.prompt,
    direction: row.direction,
    audioPath: row.audio_path,
    vocabId: row.vocab_id,
    sentenceId: row.sentence_id,
  };
  const accepted = parseStringArray(row.accepted_alternatives);

  switch (row.type) {
    case 'mc': {
      const distractors = parseStringArray(row.distractors) ?? [];
      return { ...base, type: 'mc', answer: row.answer, options: shuffle([row.answer, ...distractors]) };
    }
    case 'cloze':
      return { ...base, type: 'cloze', answer: row.answer, accepted };
    case 'typed_translation':
      return { ...base, type: 'typed_translation', answer: row.answer, accepted };
    case 'listening_dictation':
      return { ...base, type: 'listening_dictation', answer: row.answer, accepted };
    case 'word_order':
      return {
        ...base,
        type: 'word_order',
        answer: row.answer,
        accepted,
        bank: shuffle(row.answer.split(/\s+/).filter(Boolean)),
      };
    case 'match': {
      const pairs = parseMatchPairs(row.answer);
      return {
        ...base,
        type: 'match',
        pairs,
        leftFr: pairs.map((p) => p.fr),
        rightEn: shuffle(pairs.map((p) => p.en)),
      };
    }
  }
}
