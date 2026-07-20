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
import { readFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { curriculum } from './curriculum/index';
import { loadFrequencyList } from './pipeline/frequency';
import { computeDifficulty } from './pipeline/difficulty';
import { extractWordTokens } from './pipeline/difficulty';
import { generateExercisesForUnit } from './pipeline/exercises';
import type { PoolSentence } from './pipeline/ingest';
import type { Level } from '../src/db/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(HERE, '..', 'src', 'db', 'migrations', '0001_init.sql');
const FREQ_FILE = join(HERE, '.cache', 'fr_50k.txt');
const POOL_FILE = join(HERE, '.cache', 'sentence_pool.json');
const RESOURCES = join(HERE, '..', 'resources');
const OUT_DB = join(RESOURCES, 'lexiq.db');

const SCHEMA_VERSION = 1;
const EXERCISE_SEED = 20240501; // fixed → reproducible generated exercises

function jsonOrNull(value: string[] | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

function main(): void {
  const freq = loadFrequencyList(FREQ_FILE);
  const rankOf = freq.rankOf;

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
    `INSERT INTO units (level, order_index, slug, title_en, title_fr, theme, grammar_focus, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insLesson = db.prepare(
    `INSERT INTO lessons (unit_id, order_index, type, title, body_markdown) VALUES (?, ?, ?, ?, ?)`,
  );
  const insVocab = db.prepare(
    `INSERT INTO vocab (unit_id, lemma_fr, translation_en, pos, gender, ipa, frequency_rank, audio_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  );
  const insSentence = db.prepare(
    `INSERT INTO sentences (text_fr, text_en, tatoeba_id, difficulty_score, word_count, unit_id, audio_path, tags)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  );
  const insExercise = db.prepare(
    `INSERT INTO exercises (unit_id, sentence_id, vocab_id, type, direction, prompt, answer, accepted_alternatives, distractors, audio_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
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
  let unitCount = 0;
  let vocabCount = 0;
  let sentenceCount = 0;
  let exerciseCount = 0;
  let cardCount = 0;

  for (const unit of curriculum) {
    const orderIndex = levelOrder[unit.level]++;
    const unitId = Number(
      insUnit.run(
        unit.level,
        orderIndex,
        unit.slug,
        unit.title_en,
        unit.title_fr,
        unit.theme,
        unit.grammar_focus,
        unit.description,
      ).lastInsertRowid,
    );
    unitCount++;

    // First unit of A1 is available; everything else starts locked (unlock
    // logic in the app flips these as the user completes units).
    const status = unitId === 1 ? 'available' : 'locked';
    insProgress.run(unitId, status);

    // Lessons.
    unit.lessons.forEach((lesson, i) => {
      const lessonId = Number(
        insLesson.run(unitId, i, lesson.type, lesson.title, lesson.body_markdown)
          .lastInsertRowid,
      );
      // Grammar lessons become cards.
      if (lesson.type === 'grammar') {
        insCard.run('grammar', lessonId);
        cardCount++;
      }
    });

    // Vocab.
    const vocabIdByLemma = new Map<string, number>();
    for (const v of unit.vocab) {
      const vocabId = Number(
        insVocab.run(
          unitId,
          v.lemma_fr,
          v.translation_en,
          v.pos ?? null,
          v.gender ?? 'na',
          v.ipa ?? null,
          lemmaRank(v.lemma_fr),
        ).lastInsertRowid,
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
      const sentenceId = Number(
        insSentence.run(
          s.text_fr,
          s.text_en,
          null,
          Number(d.score.toFixed(4)),
          d.wordCount,
          unitId,
          s.tags ? JSON.stringify(s.tags) : null,
        ).lastInsertRowid,
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
    insSentence.run(
      s.text_fr,
      s.text_en,
      s.tatoeba_id,
      s.difficulty_score,
      s.word_count,
      null,
      null,
    );
    sentenceCount++;
  }

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
