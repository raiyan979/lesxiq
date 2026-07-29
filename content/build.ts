/*
 * Seed database builder (build-time, brief §4.6–4.7). Produces
 * resources/lexiq.db from the authored curriculum + the ingested Tatoeba pool.
 * The app copies this file into its data dir on first launch.
 *
 * Run with:  npx tsx content/build.ts
 * Prereq:    content/.cache/sentence_pool.json (npx tsx content/pipeline/ingest.ts)
 *
 * Uses Node's built-in node:sqlite (Node 22.5+/24) so the pipeline has no native
 * dependency. Reproducible: same inputs → same DB (deterministic exercise seed).
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { curriculum } from './curriculum/index';
import { loadFrequencyList } from './pipeline/frequency';
import { computeDifficulty } from './pipeline/difficulty';
import { extractWordTokens } from './pipeline/difficulty';
import { generateExercisesForUnit } from './pipeline/exercises';
import { audioBasename, audioRelPath, AUDIO_SUBDIR } from './pipeline/audio-path';
import type { PoolSentence } from './pipeline/ingest';
import type { Level } from '../src/db/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(HERE, '..', 'src', 'db', 'migrations', '0001_init.sql');
const FREQ_FILE = join(HERE, '.cache', 'fr_50k.txt');
const POOL_FILE = join(HERE, '.cache', 'sentence_pool.json');
const RESOURCES = join(HERE, '..', 'src-tauri', 'resources');
const AUDIO_DIR = join(RESOURCES, AUDIO_SUBDIR);
const OUT_DB = join(RESOURCES, 'lexiq.db');

const SCHEMA_VERSION = 1;
// Content version — bump whenever the curriculum/generated content changes. The
// runtime content-sync (src/db/content-sync.ts) compares this against the value
// in a user's DB and upgrades their content in place when it's newer, preserving
// their FSRS/progress rows. This is written into the seed's `settings`.
const CONTENT_VERSION = 1;
const EXERCISE_SEED = 20240501; // fixed → reproducible generated exercises

function jsonOrNull(value: string[] | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

/**
 * Deterministic 48-bit id derived from a stable natural key. Keeping content ids
 * stable across rebuilds is what lets content-sync upgrade a user's DB without
 * breaking the cards / unit_progress rows that reference these ids by number. 48
 * bits stays well under Number.MAX_SAFE_INTEGER; collisions across a few thousand
 * rows are astronomically unlikely, and `claimId` still fails the build loudly if
 * one ever occurs so it can never ship silently.
 */
function hashId(key: string): number {
  return parseInt(createHash('sha1').update(key).digest('hex').slice(0, 12), 16);
}

function claimId(seen: Set<number>, id: number, what: string): number {
  if (seen.has(id)) {
    throw new Error(`Content id collision (${id}) for ${what} — change its natural key.`);
  }
  seen.add(id);
  return id;
}

function main(): void {
  const freq = loadFrequencyList(FREQ_FILE);
  const rankOf = freq.rankOf;

  // Which audio clips were generated (content/pipeline/audio.ts). A row gets an
  // audio_path only if its file exists, so a partial/absent audio run just means
  // NULL paths and the app degrades gracefully.
  const audioFiles = existsSync(AUDIO_DIR) ? new Set(readdirSync(AUDIO_DIR)) : new Set<string>();
  const audioPathFor = (text: string): string | null =>
    audioFiles.has(audioBasename(text)) ? audioRelPath(text) : null;

  // frequency_rank for a (possibly multi-word) lemma: the best (lowest) rank
  // among its tokens, or null if none are in the list.
  const lemmaRank = (lemma: string): number | null => {
    let best: number | null = null;
    for (const tok of extractWordTokens(lemma)) {
      const r = rankOf(tok);
      if (r !== undefined && (best === null || r < best)) best = r;
    }
    return best;
  };

  // Fresh output dir + DB.
  mkdirSync(RESOURCES, { recursive: true });
  if (existsSync(OUT_DB)) rmSync(OUT_DB);
  const db = new DatabaseSync(OUT_DB);

  // Apply the schema (node:sqlite exec runs multiple statements).
  db.exec(readFileSync(MIGRATION, 'utf8'));

  // Prepared statements.
  const insUnit = db.prepare(
    `INSERT INTO units (id, level, order_index, slug, title_en, title_fr, theme, grammar_focus, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insLesson = db.prepare(
    `INSERT INTO lessons (id, unit_id, order_index, type, title, body_markdown) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insVocab = db.prepare(
    `INSERT INTO vocab (id, unit_id, lemma_fr, translation_en, pos, gender, ipa, frequency_rank, audio_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insSentence = db.prepare(
    `INSERT INTO sentences (id, text_fr, text_en, tatoeba_id, difficulty_score, word_count, unit_id, audio_path, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insExercise = db.prepare(
    `INSERT INTO exercises (unit_id, sentence_id, vocab_id, type, direction, prompt, answer, accepted_alternatives, distractors, audio_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insCard = db.prepare(
    `INSERT OR IGNORE INTO cards (item_type, item_id, state) VALUES (?, ?, 'new')`,
  );
  const insProgress = db.prepare(
    `INSERT INTO unit_progress (unit_id, status) VALUES (?, ?)`,
  );

  db.exec('BEGIN');

  // order_index per level.
  const levelOrder: Record<Level, number> = { A1: 0, A2: 0, B1: 0 };
  // Stable-id collision guards (one namespace per table via the key prefix).
  const unitIds = new Set<number>();
  const lessonIds = new Set<number>();
  const vocabIds = new Set<number>();
  const sentenceIds = new Set<number>();
  let unitCount = 0;
  let vocabCount = 0;
  let sentenceCount = 0;
  let exerciseCount = 0;
  let cardCount = 0;

  for (const unit of curriculum) {
    const orderIndex = levelOrder[unit.level]++;
    const unitId = claimId(unitIds, hashId(`unit:${unit.slug}`), `unit ${unit.slug}`);
    insUnit.run(
      unitId,
      unit.level,
      orderIndex,
      unit.slug,
      unit.title_en,
      unit.title_fr,
      unit.theme,
      unit.grammar_focus,
      unit.description,
    );
    unitCount++;

    // First unit of A1 is available; everything else starts locked (unlock
    // logic in the app flips these as the user completes units).
    const status = unitId === 1 ? 'available' : 'locked';
    insProgress.run(unitId, status);

    // Lessons.
    unit.lessons.forEach((lesson, i) => {
      const lessonId = claimId(
        lessonIds,
        hashId(`lesson:${unit.slug}:${i}`),
        `lesson ${unit.slug}#${i}`,
      );
      insLesson.run(lessonId, unitId, i, lesson.type, lesson.title, lesson.body_markdown);
      // Grammar lessons become cards.
      if (lesson.type === 'grammar') {
        insCard.run('grammar', lessonId);
        cardCount++;
      }
    });

    // Vocab.
    const vocabIdByLemma = new Map<string, number>();
    for (const v of unit.vocab) {
      const vocabId = claimId(
        vocabIds,
        hashId(`vocab:${unit.slug}:${v.lemma_fr}`),
        `vocab ${unit.slug}:${v.lemma_fr}`,
      );
      insVocab.run(
        vocabId,
        unitId,
        v.lemma_fr,
        v.translation_en,
        v.pos ?? null,
        v.gender ?? 'na',
        v.ipa ?? null,
        lemmaRank(v.lemma_fr),
        audioPathFor(v.lemma_fr),
      );
      vocabIdByLemma.set(v.lemma_fr, vocabId);
      insCard.run('vocab', vocabId);
      vocabCount++;
      cardCount++;
    }

    // Authored sentences (unit-linked).
    const sentenceIdByText = new Map<string, number>();
    for (const s of unit.sentences) {
      const d = computeDifficulty(s.text_fr, rankOf);
      // Scoped by unit: the same French sentence can legitimately appear in more
      // than one unit as its own row, so the natural key must include the unit.
      const sentenceId = claimId(
        sentenceIds,
        hashId(`sent:${unit.slug}:${s.text_fr}`),
        `sentence ${unit.slug}:${s.text_fr}`,
      );
      insSentence.run(
        sentenceId,
        s.text_fr,
        s.text_en,
        null,
        Number(d.score.toFixed(4)),
        d.wordCount,
        unitId,
        audioPathFor(s.text_fr),
        s.tags ? JSON.stringify(s.tags) : null,
      );
      sentenceIdByText.set(s.text_fr, sentenceId);
      sentenceCount++;
    }

    // Exercises (generated + authored), resolving sentence/vocab links.
    const exercises = generateExercisesForUnit(unit, EXERCISE_SEED + unitId);
    for (const ex of exercises) {
      const sentenceId =
        ex.sentence_fr !== null ? (sentenceIdByText.get(ex.sentence_fr) ?? null) : null;
      const vocabId =
        ex.vocab_lemma !== null ? (vocabIdByLemma.get(ex.vocab_lemma) ?? null) : null;
      // Listening-dictation plays the linked sentence's clip; others silent.
      const exAudio =
        ex.type === 'listening_dictation' && ex.sentence_fr !== null
          ? audioPathFor(ex.sentence_fr)
          : null;
      insExercise.run(
        unitId,
        sentenceId,
        vocabId,
        ex.type,
        ex.direction,
        ex.prompt,
        ex.answer,
        jsonOrNull(ex.accepted_alternatives),
        jsonOrNull(ex.distractors),
        exAudio,
      );
      exerciseCount++;
      // A sentence used in an exercise becomes a card.
      if (sentenceId !== null) {
        insCard.run('sentence', sentenceId);
        cardCount++;
      }
    }
  }

  // Library pool: the ingested Tatoeba sentences (unit_id NULL). These power the
  // Library search and extra practice. TODO: assign a themed subset to units.
  const pool = JSON.parse(readFileSync(POOL_FILE, 'utf8')) as PoolSentence[];
  for (const s of pool) {
    const poolId = claimId(sentenceIds, hashId(`pool:${s.tatoeba_id}`), `pool ${s.tatoeba_id}`);
    insSentence.run(
      poolId,
      s.text_fr,
      s.text_en,
      s.tatoeba_id,
      s.difficulty_score,
      s.word_count,
      null,
      null,
      null,
    );
    sentenceCount++;
  }

  // Content version → settings, so the runtime content-sync can compare it.
  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('content_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(CONTENT_VERSION));

  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  db.exec('COMMIT');
  db.close();

  console.log(`Built ${OUT_DB}`);
  console.log(
    `  units=${unitCount} vocab=${vocabCount} sentences=${sentenceCount} ` +
      `exercises=${exerciseCount} cards=${cardCount} (pool=${pool.length})`,
  );
  const sizeMb = (readdirSync(RESOURCES).includes('lexiq.db')
    ? readFileSync(OUT_DB).byteLength / 1e6
    : 0
  ).toFixed(1);
  console.log(`  db size: ${sizeMb} MB`);
}

main();
