/*
 * Shared, PURE audio-path helper used by both the generator (audio.ts) and the
 * seed builder (build.ts). Kept dependency-free so build.ts doesn't pull in the
 * edge-tts generation code.
 */

import { createHash } from 'node:crypto';

/** Sub-directory (under resources/ and app-data/) that holds the mp3 clips. */
export const AUDIO_SUBDIR = 'audio';

/**
 * Deterministic mp3 filename for a French text. Identical strings map to the
 * same file (dedupe), and filenames are stable across rebuilds.
 */
export function audioBasename(text: string): string {
  const hash = createHash('sha1').update(text.trim()).digest('hex').slice(0, 16);
  return `${hash}.mp3`;
}

/** DB-relative audio path, e.g. "audio/1a2b….mp3". */
export function audioRelPath(text: string): string {
  return `${AUDIO_SUBDIR}/${audioBasename(text)}`;
}
