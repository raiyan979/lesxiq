/*
 * Audio playback. Clips are shipped as bundled resources (resources/audio/*.mp3)
 * and served to the WebView through Tauri's asset protocol. A DB `audio_path`
 * like "audio/<hash>.mp3" resolves to <resourceDir>/resources/audio/<hash>.mp3.
 *
 * Everything degrades gracefully: a null path, a missing file, or a non-Tauri
 * context (e.g. a browser dev preview) simply plays nothing.
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
import { prefs } from './prefs.svelte';

const srcCache = new Map<string, string>();
let current: HTMLAudioElement | null = null;

async function resolveSrc(audioPath: string): Promise<string | null> {
  const cached = srcCache.get(audioPath);
  if (cached !== undefined) return cached;
  try {
    const abs = await resolveResource(`resources/${audioPath}`);
    const src = convertFileSrc(abs);
    srcCache.set(audioPath, src);
    return src;
  } catch {
    return null; // not running under Tauri, or path unavailable
  }
}

/** Play a clip by its DB audio_path. No-op on null/missing/unavailable. */
export async function playClip(audioPath: string | null): Promise<void> {
  if (audioPath === null || !prefs.audioEnabled) return;
  const src = await resolveSrc(audioPath);
  if (src === null) return;
  current?.pause();
  current = new Audio(src);
  try {
    await current.play();
  } catch {
    // ignore autoplay/interruption rejections
  }
}
