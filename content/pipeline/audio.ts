/*
 * Build-time audio generation (brief §4 audio). Synthesizes an mp3 for every
 * vocab word and authored sentence in the curriculum using edge-tts (offline at
 * runtime — the files are bundled; only generation needs the network).
 *
 * Run:  npx tsx content/pipeline/audio.ts
 * Prereq: python + `pip install edge-tts`.
 *
 * Incremental: existing files are skipped, so reruns only fill gaps. build.ts
 * then sets each row's audio_path when its file exists.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { curriculum } from '../curriculum/index';
import { audioBasename, AUDIO_SUBDIR } from './audio-path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', '..', 'src-tauri', 'resources', AUDIO_SUBDIR);
const VOICE = 'fr-FR-DeniseNeural';
const CONCURRENCY = 6;

function collectTexts(): string[] {
  const set = new Set<string>();
  for (const unit of curriculum) {
    for (const v of unit.vocab) set.add(v.lemma_fr.trim());
    for (const s of unit.sentences) set.add(s.text_fr.trim());
  }
  return [...set];
}

function synth(text: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'python',
      ['-m', 'edge_tts', '--voice', VOICE, '--text', text, '--write-media', outPath],
      { stdio: 'ignore' },
    );
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`edge-tts exited ${code} for "${text}"`)),
    );
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const texts = collectTexts();
  const todo = texts.filter((t) => !existsSync(join(OUT_DIR, audioBasename(t))));
  console.log(
    `${texts.length} clips total — ${todo.length} to generate, ${texts.length - todo.length} cached.`,
  );

  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const text = todo[cursor++]!;
      try {
        await synth(text, join(OUT_DIR, audioBasename(text)));
        done++;
      } catch (e) {
        failed++;
        console.error('  FAIL:', text, '—', (e as Error).message);
      }
      if ((done + failed) % 25 === 0) console.log(`  ${done + failed}/${todo.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`Audio: ${done} generated, ${failed} failed. → ${OUT_DIR}`);
  if (failed > 0) {
    console.log('Re-run to retry the failed clips (existing files are skipped).');
  }
}

void main();
