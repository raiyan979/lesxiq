/*
 * Exercise graders (brief §8). PURE correctness logic — the single source of
 * truth for whether an answer is right. No DB, no DOM, no randomness, so every
 * grader is exhaustively unit-testable. Components collect the user's response
 * and call these; the session then derives an FSRS rating from the result.
 *
 * Row conventions consumed here mirror the generator (content/pipeline/
 * exercises.ts): mc answer=correct option; cloze answer=blanked word (+ lowercase
 * accepted alt); typed/word_order/listening answer=full French sentence; match
 * answer=JSON array of {fr,en} pairs.
 */

export interface GradeResult {
  correct: boolean;
  /** The canonical expected answer, for feedback after a miss. */
  expected: string;
  /** match only: how many pairs the user got right, and the total. */
  correctCount?: number;
  total?: number;
}

/**
 * Normalize a free-text answer for comparison: trim, lowercase, unify
 * apostrophes, collapse inner whitespace, drop terminal sentence punctuation.
 * Accents are preserved deliberately — they are meaningful in French, and the
 * curriculum teaches them.
 */
export function normalizeText(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[’ʼ`]/g, "'") // curly/modifier apostrophes → straight
    .replace(/\s+/g, ' ')
    .replace(/[.!?;:]+$/u, '')
    .trim();
}

/** Like normalizeText but also strips surrounding punctuation (single words). */
export function normalizeWord(input: string): string {
  return normalizeText(input)
    .replace(/^[«"¿¡(]+/u, '')
    .replace(/[,…»)]+$/u, '')
    .trim();
}

function matchesAny(input: string, targets: readonly string[]): boolean {
  const u = input;
  return u.length > 0 && targets.includes(u);
}

/** Multiple-choice: the chosen option must equal the correct option. */
export function gradeMc(answer: string, choice: string): GradeResult {
  return { correct: normalizeText(choice) === normalizeText(answer), expected: answer };
}

/** Cloze: the typed word must match the blanked word (or an accepted variant). */
export function gradeCloze(
  answer: string,
  accepted: readonly string[] | null,
  input: string,
): GradeResult {
  const targets = [answer, ...(accepted ?? [])].map(normalizeWord);
  return { correct: matchesAny(normalizeWord(input), targets), expected: answer };
}

/** Typed translation: the typed sentence must match the target (or a variant). */
export function gradeTypedTranslation(
  answer: string,
  accepted: readonly string[] | null,
  input: string,
): GradeResult {
  const targets = [answer, ...(accepted ?? [])].map(normalizeText);
  return { correct: matchesAny(normalizeText(input), targets), expected: answer };
}

/** Listening dictation: same comparison as typed translation. */
export function gradeListeningDictation(
  answer: string,
  accepted: readonly string[] | null,
  input: string,
): GradeResult {
  return gradeTypedTranslation(answer, accepted, input);
}

/** Word order: the assembled token sequence must reconstruct the sentence. */
export function gradeWordOrder(
  answer: string,
  accepted: readonly string[] | null,
  tokens: readonly string[],
): GradeResult {
  const assembled = normalizeText(tokens.join(' '));
  const targets = [answer, ...(accepted ?? [])].map(normalizeText);
  return { correct: matchesAny(assembled, targets), expected: answer };
}

export interface MatchPair {
  fr: string;
  en: string;
}

/**
 * Match: `mapping` is the user's chosen English for each French word. Correct
 * only when every pair is right; also reports the partial count for feedback.
 */
export function gradeMatch(
  pairs: readonly MatchPair[],
  mapping: Readonly<Record<string, string>>,
): GradeResult {
  let correctCount = 0;
  for (const pair of pairs) {
    const chosen = mapping[pair.fr];
    if (chosen !== undefined && normalizeText(chosen) === normalizeText(pair.en)) {
      correctCount++;
    }
  }
  const total = pairs.length;
  return {
    correct: total > 0 && correctCount === total,
    expected: pairs.map((p) => `${p.fr} = ${p.en}`).join(', '),
    correctCount,
    total,
  };
}
