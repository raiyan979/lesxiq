/*
 * Typed row shapes mirroring the schema (db/migrations/0001_init.sql).
 * These are the raw column types as SQLite returns them: TEXT → string, INTEGER
 * → number, nullable columns → `| null`. JSON-encoded columns (tags,
 * accepted_alternatives, distractors, lessons_done) are stored as TEXT and
 * parsed at the query boundary, so they are typed `string | null` here.
 */

export type Level = 'A1' | 'A2' | 'B1';
export type LessonType = 'grammar' | 'vocab' | 'dialogue' | 'reading';
export type Gender = 'm' | 'f' | 'na';
export type ExerciseType =
  | 'mc'
  | 'cloze'
  | 'typed_translation'
  | 'word_order'
  | 'listening_dictation'
  | 'match';
export type Direction = 'en_fr' | 'fr_en';
export type CardItemType = 'vocab' | 'sentence' | 'grammar';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';
export type UnitStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface UnitRow {
  id: number;
  level: Level;
  order_index: number;
  slug: string;
  title_en: string;
  title_fr: string;
  theme: string;
  grammar_focus: string;
  description: string;
}

export interface LessonRow {
  id: number;
  unit_id: number;
  order_index: number;
  type: LessonType;
  title: string;
  body_markdown: string;
}

export interface VocabRow {
  id: number;
  unit_id: number;
  lemma_fr: string;
  translation_en: string;
  pos: string | null;
  gender: Gender;
  ipa: string | null;
  example_sentence_id: number | null;
  frequency_rank: number | null;
  audio_path: string | null;
}

export interface SentenceRow {
  id: number;
  text_fr: string;
  text_en: string;
  tatoeba_id: number | null;
  difficulty_score: number;
  word_count: number;
  unit_id: number | null;
  audio_path: string | null;
  tags: string | null; // JSON array of strings
}

export interface ExerciseRow {
  id: number;
  unit_id: number;
  sentence_id: number | null;
  vocab_id: number | null;
  type: ExerciseType;
  direction: Direction | null;
  prompt: string;
  answer: string;
  accepted_alternatives: string | null; // JSON array
  distractors: string | null; // JSON array
  audio_path: string | null;
}

export interface CardRow {
  id: number;
  item_type: CardItemType;
  item_id: number;
  state: CardState;
  due: string | null;
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: string | null;
}

export interface ReviewLogRow {
  id: number;
  card_id: number;
  rating: 1 | 2 | 3 | 4;
  state: CardState;
  due: string | null;
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number | null;
  scheduled_days: number | null;
  reviewed_at: string;
  duration_ms: number | null;
}

export interface UnitProgressRow {
  unit_id: number;
  status: UnitStatus;
  lessons_done: string; // JSON array of lesson ids
  completed_at: string | null;
}

export interface AppStateRow {
  id: 1;
  streak_count: number;
  longest_streak: number;
  last_active_date: string | null;
  total_reviews: number;
  total_new_learned: number;
  xp: number;
}

export interface SettingRow {
  key: string;
  value: string;
}
