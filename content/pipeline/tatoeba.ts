/*
 * Tatoeba ingest — pure parsing/filtering/dedup helpers (brief §4.1). Kept
 * separate from the streaming orchestrator (ingest.ts) so they're unit-testable
 * without the multi-hundred-MB data files.
 *
 * Tatoeba per-language sentence export line:  id \t lang \t text
 * Tatoeba links export line:                  id1 \t id2
 * Both are CC-BY.
 */

import { countWords } from './difficulty';

export interface RawSentence {
  id: number;
  text: string;
}

/** Parse one `id \t lang \t text` line, or null if malformed. */
export function parseSentenceLine(line: string): RawSentence | null {
  const parts = line.split('\t');
  if (parts.length < 3) return null;
  const id = Number(parts[0]);
  const text = parts[2]?.trim();
  if (!Number.isInteger(id) || id <= 0 || text === undefined || text === '') {
    return null;
  }
  return { id, text };
}

/** Parse one `id1 \t id2` link line, or null if malformed. */
export function parseLinkLine(line: string): [number, number] | null {
  const parts = line.split('\t');
  if (parts.length < 2) return null;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  return [a, b];
}

/** Keep only sentences whose word count is within [min, max] (§4.1: 3–12). */
export function isWordCountInRange(text: string, min: number, max: number): boolean {
  const n = countWords(text);
  return n >= min && n <= max;
}

/**
 * Normalize a French sentence for dedup: lowercase, collapse whitespace, strip
 * surrounding whitespace and trailing sentence punctuation. Two sentences that
 * differ only in casing/punctuation collapse to the same key.
 */
export function normalizeForDedup(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?…]+$/u, '')
    .trim();
}

export const INGEST_CONFIG = {
  minWords: 3,
  maxWords: 12,
} as const;
