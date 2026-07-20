/*
 * Sentence difficulty scoring (brief §4.3). Build-time only — this file lives
 * under content/ and is never imported by the app bundle.
 *
 * difficulty_score ∈ [0,1] = weighted blend of three signals:
 *   1. word count (normalized over the 3–12 filter band)
 *   2. mean frequency rank of the sentence's words (rarer words → higher)
 *   3. presence of a "complex tense" (passé composé / imparfait)
 *
 * The tense detection is a deliberately simple regex heuristic: this is a
 * relative ordering signal for sequencing exercises, not a grammar parser, so a
 * few false positives (e.g. "fait") are acceptable and don't warrant a real
 * morphological analyzer (lean-code: don't build an NLP stack for a sort key).
 */

export const DIFFICULTY_CONFIG = {
  // The frequency list is the Lexique-derived top-5000 lemmas (§4.2). Unknown
  // words are treated as this rank, i.e. "as rare as the rarest tracked word".
  frequencyListSize: 5000,
  // The pipeline keeps only 3–12 word French sentences (§4.1); normalize within
  // that band so the full band maps onto [0,1].
  wordCountMin: 3,
  wordCountMax: 12,
  // Weights sum to 1 so the score is bounded [0,1]. Vocabulary rarity is the
  // strongest difficulty driver for a learner, word count next, tense a smaller
  // bump. Values chosen for sensible ordering, not empirically tuned.
  weights: {
    wordCount: 0.35,
    frequency: 0.45,
    tense: 0.2,
  },
} as const;

// French letters (incl. common accented forms + ligatures) for word extraction.
const FRENCH_WORD = /[a-zàâäæçéèêëîïôöœùûüÿ]+/gi;

/** Count whitespace-delimited tokens (matches the pipeline's 3–12 word filter). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Extract lowercased word tokens, splitting elisions (j', qu', l') into separate
 * tokens and dropping punctuation. Used for frequency lookup.
 */
export function extractWordTokens(text: string): string[] {
  return (text.toLowerCase().match(FRENCH_WORD) ?? []).map((w) => w);
}

// Imparfait/conditional endings that distinguish from present tense
// (-ions/-iez vs present -ons/-ez). Two guards keep noise down: a min length
// (avoids "fait") and — critically — requiring a subject pronoun immediately
// before, since many non-verbs end in -ais/-ait (français, mais, portrait) but
// are not preceded by a pronoun the way a conjugated verb is.
const IMPARFAIT_ENDING = /(?:ais|ait|aient|ions|iez)$/;
const IMPARFAIT_MIN_LEN = 5;
const SUBJECT_PRONOUNS = new Set([
  'je',
  'j',
  'tu',
  'il',
  'elle',
  'on',
  'nous',
  'vous',
  'ils',
  'elles',
]);

// Passé composé auxiliaries (avoir + être, present tense).
const AUXILIARIES = new Set([
  'ai',
  'as',
  'a',
  'avons',
  'avez',
  'ont',
  'suis',
  'es',
  'est',
  'sommes',
  'êtes',
  'sont',
]);
// Past-participle shapes. The -é family is a reliable signal; the i/u/it family
// is noisier so it needs a min length to avoid matches like "ici" after "est".
const PARTICIPLE_STRONG = /(?:é|ée|és|ées)$/;
const PARTICIPLE_WEAK = /(?:i|is|ie|ies|u|ue|us|ues|it)$/;
const PARTICIPLE_WEAK_MIN_LEN = 4;

function looksLikeParticiple(token: string): boolean {
  if (PARTICIPLE_STRONG.test(token)) return true;
  return token.length >= PARTICIPLE_WEAK_MIN_LEN && PARTICIPLE_WEAK.test(token);
}

/**
 * Heuristic: does the sentence use passé composé or imparfait?
 * - passé composé: an auxiliary token immediately followed by a participle-shaped
 *   token (e.g. "ai mangé", "est allée").
 * - imparfait: a word with a distinctive imparfait ending (e.g. "mangeait").
 */
export function detectComplexTense(text: string): boolean {
  const tokens = extractWordTokens(text);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    // passé composé: aux + adjacent participle
    if (AUXILIARIES.has(token)) {
      const next = tokens[i + 1];
      if (next !== undefined && looksLikeParticiple(next)) return true;
    }
    // imparfait: distinctive ending on a long-enough word, preceded by a subject
    // pronoun (rejects nouns/adjectives like "français" that share the ending).
    if (token.length >= IMPARFAIT_MIN_LEN && IMPARFAIT_ENDING.test(token)) {
      const prev = tokens[i - 1];
      if (prev !== undefined && SUBJECT_PRONOUNS.has(prev)) return true;
    }
  }
  return false;
}

/**
 * Mean frequency rank of the given tokens; unknown tokens count as the list size
 * (maximally rare). Returns null when there are no tokens.
 */
export function meanFrequencyRank(
  tokens: string[],
  rankOf: (word: string) => number | undefined,
): number | null {
  if (tokens.length === 0) return null;
  let sum = 0;
  for (const token of tokens) {
    sum += rankOf(token) ?? DIFFICULTY_CONFIG.frequencyListSize;
  }
  return sum / tokens.length;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export interface DifficultyInputs {
  wordCount: number;
  /** Mean frequency rank, or null when no ranked tokens (→ neutral midpoint). */
  meanRank: number | null;
  hasComplexTense: boolean;
}

/** Blend the three normalized signals into a difficulty score in [0,1]. */
export function scoreSentenceDifficulty(inputs: DifficultyInputs): number {
  const cfg = DIFFICULTY_CONFIG;

  const wc = clamp01(
    (inputs.wordCount - cfg.wordCountMin) / (cfg.wordCountMax - cfg.wordCountMin),
  );
  const freq =
    inputs.meanRank === null
      ? 0.5 // neutral when we can't measure vocabulary rarity
      : clamp01((inputs.meanRank - 1) / (cfg.frequencyListSize - 1));
  const tense = inputs.hasComplexTense ? 1 : 0;

  const score =
    cfg.weights.wordCount * wc +
    cfg.weights.frequency * freq +
    cfg.weights.tense * tense;

  return clamp01(score);
}

export interface DifficultyResult extends DifficultyInputs {
  score: number;
}

/** Convenience: compute difficulty directly from raw French text. */
export function computeDifficulty(
  textFr: string,
  rankOf: (word: string) => number | undefined,
): DifficultyResult {
  const wordCount = countWords(textFr);
  const meanRank = meanFrequencyRank(extractWordTokens(textFr), rankOf);
  const hasComplexTense = detectComplexTense(textFr);
  const score = scoreSentenceDifficulty({ wordCount, meanRank, hasComplexTense });
  return { score, wordCount, meanRank, hasComplexTense };
}
