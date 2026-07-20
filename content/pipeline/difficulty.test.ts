import { describe, it, expect } from 'vitest';
import {
  countWords,
  extractWordTokens,
  detectComplexTense,
  meanFrequencyRank,
  scoreSentenceDifficulty,
  computeDifficulty,
  DIFFICULTY_CONFIG,
} from './difficulty';

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('Je mange une pomme')).toBe(4);
  });
  it('collapses irregular whitespace and trims', () => {
    expect(countWords('  Bonjour   le    monde  ')).toBe(3);
  });
  it('treats an elided token as one whitespace token', () => {
    // j'ai is one whitespace-delimited token (matches the pipeline's 3–12 filter)
    expect(countWords("J'ai faim")).toBe(2);
  });
});

describe('extractWordTokens', () => {
  it('lowercases and strips punctuation', () => {
    expect(extractWordTokens('Bonjour, le monde!')).toEqual([
      'bonjour',
      'le',
      'monde',
    ]);
  });
  it('splits elisions into separate word tokens', () => {
    expect(extractWordTokens("J'ai mangé qu'une pomme")).toEqual([
      'j',
      'ai',
      'mangé',
      'qu',
      'une',
      'pomme',
    ]);
  });
  it('keeps accented letters intact', () => {
    expect(extractWordTokens('Où être français çà')).toEqual([
      'où',
      'être',
      'français',
      'çà',
    ]);
  });
});

describe('detectComplexTense', () => {
  it('detects passé composé with avoir', () => {
    expect(detectComplexTense("J'ai mangé une pomme")).toBe(true);
    expect(detectComplexTense('Nous avons fini le travail')).toBe(true);
  });
  it('detects passé composé with être', () => {
    expect(detectComplexTense('Elle est allée au marché')).toBe(true);
    expect(detectComplexTense('Ils sont partis hier')).toBe(true);
  });
  it('detects imparfait', () => {
    expect(detectComplexTense('Il mangeait lentement')).toBe(true);
    expect(detectComplexTense('Nous parlions français')).toBe(true);
    expect(detectComplexTense('Elles jouaient dehors')).toBe(true);
  });
  it('returns false for simple present tense', () => {
    expect(detectComplexTense('Je mange une pomme')).toBe(false);
    expect(detectComplexTense('Où est la gare ?')).toBe(false);
    expect(detectComplexTense('Nous parlons français')).toBe(false);
  });
});

describe('meanFrequencyRank', () => {
  // rankOf: common words rank low, rare words rank high; unknown → undefined.
  const ranks: Record<string, number> = { je: 5, mange: 200, une: 10, pomme: 900 };
  const rankOf = (w: string): number | undefined => ranks[w];

  it('averages the ranks of known tokens', () => {
    expect(meanFrequencyRank(['je', 'mange', 'une', 'pomme'], rankOf)).toBe(
      (5 + 200 + 10 + 900) / 4,
    );
  });
  it('treats unknown tokens as maximally rare (list size)', () => {
    const mean = meanFrequencyRank(['je', 'xyzzy'], rankOf);
    expect(mean).toBe((5 + DIFFICULTY_CONFIG.frequencyListSize) / 2);
  });
  it('returns null when there are no tokens', () => {
    expect(meanFrequencyRank([], rankOf)).toBeNull();
  });
});

describe('scoreSentenceDifficulty', () => {
  it('stays within 0..1', () => {
    const min = scoreSentenceDifficulty({
      wordCount: 3,
      meanRank: 1,
      hasComplexTense: false,
    });
    const max = scoreSentenceDifficulty({
      wordCount: 12,
      meanRank: DIFFICULTY_CONFIG.frequencyListSize,
      hasComplexTense: true,
    });
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(min).toBeLessThan(max);
  });

  it('is the floor (0) at the easiest possible inputs', () => {
    expect(
      scoreSentenceDifficulty({ wordCount: 3, meanRank: 1, hasComplexTense: false }),
    ).toBeCloseTo(0, 5);
  });

  it('is the ceiling (1) at the hardest possible inputs', () => {
    expect(
      scoreSentenceDifficulty({
        wordCount: 12,
        meanRank: DIFFICULTY_CONFIG.frequencyListSize,
        hasComplexTense: true,
      }),
    ).toBeCloseTo(1, 5);
  });

  it('increases monotonically with word count', () => {
    const short = scoreSentenceDifficulty({
      wordCount: 4,
      meanRank: 100,
      hasComplexTense: false,
    });
    const long = scoreSentenceDifficulty({
      wordCount: 11,
      meanRank: 100,
      hasComplexTense: false,
    });
    expect(long).toBeGreaterThan(short);
  });

  it('increases with rarer vocabulary (higher mean rank)', () => {
    const common = scoreSentenceDifficulty({
      wordCount: 6,
      meanRank: 50,
      hasComplexTense: false,
    });
    const rare = scoreSentenceDifficulty({
      wordCount: 6,
      meanRank: 3000,
      hasComplexTense: false,
    });
    expect(rare).toBeGreaterThan(common);
  });

  it('adds a bump for complex tense', () => {
    const base = { wordCount: 6, meanRank: 100, hasComplexTense: false } as const;
    const withTense = scoreSentenceDifficulty({ ...base, hasComplexTense: true });
    const withoutTense = scoreSentenceDifficulty(base);
    expect(withTense - withoutTense).toBeCloseTo(DIFFICULTY_CONFIG.weights.tense, 5);
  });

  it('uses a neutral midpoint when mean rank is unknown (null)', () => {
    const known = scoreSentenceDifficulty({
      wordCount: 6,
      meanRank: null,
      hasComplexTense: false,
    });
    // neutral = 0.5 on the frequency axis
    const expectedFreqComponent = DIFFICULTY_CONFIG.weights.frequency * 0.5;
    const wcComponent =
      DIFFICULTY_CONFIG.weights.wordCount *
      ((6 - DIFFICULTY_CONFIG.wordCountMin) /
        (DIFFICULTY_CONFIG.wordCountMax - DIFFICULTY_CONFIG.wordCountMin));
    expect(known).toBeCloseTo(expectedFreqComponent + wcComponent, 5);
  });
});

describe('computeDifficulty (end-to-end from raw text)', () => {
  const ranks: Record<string, number> = {
    je: 5,
    mange: 200,
    une: 10,
    pomme: 900,
    ai: 8,
    mangé: 210,
  };
  const rankOf = (w: string): number | undefined => ranks[w];

  it('scores a simple present sentence lower than a rare passé composé one', () => {
    const easy = computeDifficulty('Je mange une pomme', rankOf);
    const hard = computeDifficulty(
      "J'ai mangé une pomme délicieuse aujourd'hui vraiment",
      rankOf,
    );
    expect(easy.score).toBeLessThan(hard.score);
    expect(easy.wordCount).toBe(4);
    expect(hard.hasComplexTense).toBe(true);
  });

  it('returns a score in 0..1 and the component breakdown', () => {
    const r = computeDifficulty('Je mange une pomme', rankOf);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.hasComplexTense).toBe(false);
    expect(r.meanRank).toBeCloseTo((5 + 200 + 10 + 900) / 4, 5);
  });
});
