/*
 * Curriculum authoring model (build-time). These are the shapes I hand-author
 * the ~40-unit CEFR curriculum in; content/build.ts transforms them into the
 * db rows (units/lessons/vocab/sentences/exercises/cards).
 *
 * Design choice: I author each unit's teaching content + vocabulary + a set of
 * example sentences, and author the "interesting" exercises (grammar-specific
 * cloze, dialogue-based) directly. Mechanical exercises (vocab MC/match, simple
 * cloze) are GENERATED from the authored vocab + sentences by a pure, tested
 * generator (content/pipeline/exercises.ts) rather than typed out 600 times —
 * this keeps quality high where it matters and avoids error-prone bulk copy.
 */

import type { Level, LessonType, Gender, ExerciseType, Direction } from '../../src/db/types';

export interface VocabDef {
  lemma_fr: string;
  translation_en: string;
  pos?: string;
  gender?: Gender; // defaults to 'na'
  ipa?: string;
  /** Optional example sentence (French) shown with the word; also seeded. */
  example_fr?: string;
  example_en?: string;
}

/** A sentence authored for a unit (used for exercises / reading). */
export interface SentenceDef {
  text_fr: string;
  text_en: string;
  tags?: string[];
}

export interface LessonDef {
  type: LessonType;
  title: string;
  /** Markdown teaching content (grammar/dialogue/reading). Empty for pure vocab lists. */
  body_markdown: string;
}

/**
 * An explicitly authored exercise. `type`-specific fields:
 *  - mc/match: `distractors` (and for match, multiple prompt/answer pairs live
 *    in separate exercises or a grouped structure — see generator).
 *  - cloze: `prompt` holds the sentence with the blank marker; `answer` the word.
 *  - typed_translation: `prompt` = source text, `answer` = target text.
 *  - word_order / listening_dictation: `answer` = the full French sentence.
 */
export interface ExerciseDef {
  type: ExerciseType;
  direction?: Direction;
  prompt: string;
  answer: string;
  accepted_alternatives?: string[];
  distractors?: string[];
  /** Link the exercise to one of the unit's sentences by its French text. */
  sentence_fr?: string;
}

export interface UnitDef {
  level: Level;
  slug: string;
  title_en: string;
  title_fr: string;
  theme: string;
  grammar_focus: string;
  description: string;
  lessons: LessonDef[];
  vocab: VocabDef[];
  sentences: SentenceDef[];
  /** Hand-authored exercises; mechanical ones are generated to reach ~15/unit. */
  exercises?: ExerciseDef[];
}
