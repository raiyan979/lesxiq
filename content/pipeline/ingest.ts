/*
 * Tatoeba FR↔EN ingest orchestrator (brief §4.1). Streams the (large) Tatoeba
 * exports, joins French sentences to an English translation, filters to 3–12
 * French words, dedupes, difficulty-scores, and writes a capped, deterministic
 * sentence pool to content/.cache/sentence_pool.json for the seed builder.
 *
 * Run with:  npx tsx content/pipeline/ingest.ts
 * (Reads the files downloaded into content/.cache/ — see README/build docs.)
 *
 * Memory strategy for the 28M-row links file: we never hold all English text.
 * Pass 1 keeps only in-range French sentences; pass 2 records up to K candidate
 * partner ids per French sentence; pass 3 resolves English text only for those
 * candidates.
 */

import { createReadStream } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadFrequencyList } from './frequency';
import { computeDifficulty } from './difficulty';
import {
  parseSentenceLine,
  parseLinkLine,
  isWordCountInRange,
  normalizeForDedup,
  INGEST_CONFIG,
} from './tatoeba';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');
const FRA_FILE = join(CACHE_DIR, 'fra_sentences.tsv');
const ENG_FILE = join(CACHE_DIR, 'eng_sentences.tsv');
const LINKS_FILE = join(CACHE_DIR, 'links.csv');
const FREQ_FILE = join(CACHE_DIR, 'fr_50k.txt');
const OUT_FILE = join(CACHE_DIR, 'sentence_pool.json');

// Keep at most this many candidate partner ids per French sentence — enough to
// almost always include an English translation without unbounded memory.
const MAX_CANDIDATES = 8;
// Deterministic cap on the final pool, evenly sampled across the difficulty
// range. Plenty for ~40 units of exercises plus a browsable Library.
const POOL_CAP = 30000;

export interface PoolSentence {
  tatoeba_id: number;
  text_fr: string;
  text_en: string;
  word_count: number;
  difficulty_score: number;
}

async function streamLines(
  file: string,
  onLine: (line: string) => void,
): Promise<void> {
  const rl = createInterface({
    input: createReadStream(file, 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) onLine(line);
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const freq = loadFrequencyList(FREQ_FILE);
  console.log(`Loaded frequency list: ${freq.size} words`);

  // Pass 1 — French sentences within the word-count band.
  const fra = new Map<number, string>();
  await streamLines(FRA_FILE, (line) => {
    const s = parseSentenceLine(line);
    if (s && isWordCountInRange(s.text, INGEST_CONFIG.minWords, INGEST_CONFIG.maxWords)) {
      fra.set(s.id, s.text);
    }
  });
  console.log(`Pass 1: ${fra.size} French sentences in [3,12] words`);

  // Pass 2 — collect candidate partner ids for those French sentences.
  const candidates = new Map<number, number[]>();
  const needed = new Set<number>();
  const addCandidate = (fraId: number, partner: number): void => {
    let list = candidates.get(fraId);
    if (list === undefined) {
      list = [];
      candidates.set(fraId, list);
    }
    if (list.length < MAX_CANDIDATES) {
      list.push(partner);
      needed.add(partner);
    }
  };
  await streamLines(LINKS_FILE, (line) => {
    const link = parseLinkLine(line);
    if (!link) return;
    const [a, b] = link;
    if (fra.has(a)) addCandidate(a, b);
    if (fra.has(b)) addCandidate(b, a);
  });
  console.log(`Pass 2: ${candidates.size} French sentences have candidate links`);

  // Pass 3 — resolve English text only for candidate ids.
  const engText = new Map<number, string>();
  await streamLines(ENG_FILE, (line) => {
    const s = parseSentenceLine(line);
    if (s && needed.has(s.id)) engText.set(s.id, s.text);
  });
  console.log(`Pass 3: resolved English text for ${engText.size} candidate ids`);

  // Build pairs: pick the shortest available English translation per French id.
  const seen = new Set<string>();
  const pool: PoolSentence[] = [];
  for (const [fraId, text_fr] of fra) {
    const partners = candidates.get(fraId);
    if (partners === undefined) continue;

    let bestEn: string | undefined;
    for (const partnerId of partners) {
      const en = engText.get(partnerId);
      if (en !== undefined && (bestEn === undefined || en.length < bestEn.length)) {
        bestEn = en;
      }
    }
    if (bestEn === undefined) continue;

    const key = normalizeForDedup(text_fr);
    if (seen.has(key)) continue;
    seen.add(key);

    const d = computeDifficulty(text_fr, freq.rankOf);
    pool.push({
      tatoeba_id: fraId,
      text_fr,
      text_en: bestEn,
      word_count: d.wordCount,
      difficulty_score: Number(d.score.toFixed(4)),
    });
  }

  // Deterministic ordering: easiest first, id as tiebreaker.
  pool.sort(
    (x, y) =>
      x.difficulty_score - y.difficulty_score || x.tatoeba_id - y.tatoeba_id,
  );

  // Full-pool difficulty histogram (before capping) so we can see the real range.
  const hist = new Array(10).fill(0);
  for (const s of pool) hist[Math.min(9, Math.floor(s.difficulty_score * 10))]++;
  console.log('Full difficulty distribution:');
  hist.forEach((c, i) =>
    console.log(`  [${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)}): ${c}`),
  );

  // Downsample by picking POOL_CAP evenly-spaced ranks from the sorted pool.
  // Unlike slicing the easiest N, this preserves the whole easy→hard range so
  // A1/A2/B1 all have material to draw from.
  let capped: PoolSentence[];
  if (pool.length <= POOL_CAP) {
    capped = pool;
  } else {
    capped = [];
    const stride = pool.length / POOL_CAP;
    for (let k = 0; k < POOL_CAP; k++) {
      capped.push(pool[Math.floor(k * stride)]!);
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify(capped), 'utf8');
  console.log(
    `Wrote ${capped.length} sentences (of ${pool.length} unique pairs) to ${OUT_FILE}`,
  );
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
