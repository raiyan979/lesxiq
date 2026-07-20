/*
 * French frequency list loader (brief §4.2). Provides frequency_rank for words
 * (lower rank = more common), used by the difficulty scorer.
 *
 * Source: hermitdave/FrequencyWords fr_50k.txt (OpenSubtitles-derived, ranked by
 * frequency). The brief suggests a Lexique-derived list "e.g."; this is a
 * reachable, CC-licensed substitute that serves the same purpose (a frequency
 * ordering). Documented substitution — see also lexiq-project notes.
 */

import { readFileSync } from 'node:fs';

export interface FrequencyList {
  /** 1-based rank of a word (1 = most common), or undefined if not in the list. */
  rankOf(word: string): number | undefined;
  /** Number of words kept (== the rank ceiling used for unknown words). */
  size: number;
}

/**
 * Parse a `word count` (space-separated, frequency-ordered) list into a rank
 * lookup, keeping the top `limit` distinct words. Rank is assigned by first
 * appearance order.
 */
export function parseFrequencyList(content: string, limit = 5000): FrequencyList {
  const ranks = new Map<string, number>();
  for (const line of content.split('\n')) {
    const word = line.split(' ')[0]?.trim().toLowerCase();
    if (word === undefined || word === '') continue;
    if (!ranks.has(word)) {
      ranks.set(word, ranks.size + 1);
      if (ranks.size >= limit) break;
    }
  }
  return {
    rankOf: (word: string) => ranks.get(word.toLowerCase()),
    size: ranks.size,
  };
}

/** Load and parse a frequency list file from disk. */
export function loadFrequencyList(path: string, limit = 5000): FrequencyList {
  return parseFrequencyList(readFileSync(path, 'utf8'), limit);
}
