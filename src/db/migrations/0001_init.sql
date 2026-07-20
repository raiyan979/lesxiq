-- Migration 0001 — initial schema.
--
-- Tables are transcribed verbatim from the build brief §3 (single target
-- language = French, base = English; no `languages` table by design). This
-- file is the canonical schema: the build-time pipeline (content/build.ts) runs
-- it to create the seed DB, and the runtime migration runner (db/migrate.ts)
-- runs any pending migrations against the user's copy. Keep it pure DDL + the
-- default settings/app_state seed so a fresh (unseeded) DB is still usable.

CREATE TABLE units (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL CHECK(level IN ('A1','A2','B1')),
  order_index INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_fr TEXT NOT NULL,
  theme TEXT NOT NULL,             -- e.g. 'greetings','food','travel'
  grammar_focus TEXT NOT NULL,     -- e.g. 'present tense -er verbs'
  description TEXT NOT NULL
);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id),
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('grammar','vocab','dialogue','reading')),
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL      -- teaching content, rendered as sanitized markdown
);

CREATE TABLE vocab (
  id INTEGER PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id),
  lemma_fr TEXT NOT NULL,
  translation_en TEXT NOT NULL,
  pos TEXT,                        -- part of speech
  gender TEXT CHECK(gender IN ('m','f','na')) DEFAULT 'na',
  ipa TEXT,
  example_sentence_id INTEGER REFERENCES sentences(id),
  frequency_rank INTEGER,          -- lower = more common
  audio_path TEXT
);

CREATE TABLE sentences (
  id INTEGER PRIMARY KEY,
  text_fr TEXT NOT NULL,
  text_en TEXT NOT NULL,
  tatoeba_id INTEGER,
  difficulty_score REAL NOT NULL,  -- computed in pipeline, see §4
  word_count INTEGER NOT NULL,
  unit_id INTEGER REFERENCES units(id),
  audio_path TEXT,
  tags TEXT                        -- JSON array of strings
);

CREATE TABLE exercises (
  id INTEGER PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES units(id),
  sentence_id INTEGER REFERENCES sentences(id),
  vocab_id INTEGER REFERENCES vocab(id),
  type TEXT NOT NULL CHECK(type IN ('mc','cloze','typed_translation','word_order','listening_dictation','match')),
  direction TEXT CHECK(direction IN ('en_fr','fr_en')) DEFAULT 'en_fr',
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  accepted_alternatives TEXT,      -- JSON array
  distractors TEXT,                -- JSON array (for mc/match)
  audio_path TEXT
);

-- One card per learnable item. FSRS state lives here.
CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  item_type TEXT NOT NULL CHECK(item_type IN ('vocab','sentence','grammar')),
  item_id INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'new' CHECK(state IN ('new','learning','review','relearning')),
  due TEXT,                        -- ISO datetime
  stability REAL,
  difficulty REAL,
  elapsed_days REAL DEFAULT 0,
  scheduled_days REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review TEXT,
  UNIQUE(item_type, item_id)
);

CREATE TABLE review_logs (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  rating INTEGER NOT NULL CHECK(rating IN (1,2,3,4)),  -- again/hard/good/easy
  state TEXT NOT NULL,
  due TEXT,
  stability REAL,
  difficulty REAL,
  elapsed_days REAL,
  scheduled_days REAL,
  reviewed_at TEXT NOT NULL,       -- ISO datetime
  duration_ms INTEGER
);

CREATE TABLE unit_progress (
  unit_id INTEGER PRIMARY KEY REFERENCES units(id),
  status TEXT NOT NULL DEFAULT 'locked' CHECK(status IN ('locked','available','in_progress','completed')),
  lessons_done TEXT DEFAULT '[]',  -- JSON array of lesson ids
  completed_at TEXT
);

-- Single-row app state (id always = 1).
CREATE TABLE app_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  streak_count INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date TEXT,           -- ISO date
  total_reviews INTEGER DEFAULT 0,
  total_new_learned INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0
);

-- Key-value settings.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- --- Indexes for the known query patterns (not speculative; each maps to a
-- --- query in §5/§6). ---
-- Review queue: filter by state, order by due (scheduler.getReviewQueue).
CREATE INDEX idx_cards_due ON cards(due);
CREATE INDEX idx_cards_state ON cards(state);
-- Stats: reviews-per-day, retention over time, new-cards-introduced-today.
CREATE INDEX idx_review_logs_reviewed_at ON review_logs(reviewed_at);
-- Per-card review history.
CREATE INDEX idx_review_logs_card_id ON review_logs(card_id);
-- Content lookups by unit (unit detail, practice session, forecasts).
CREATE INDEX idx_exercises_unit_id ON exercises(unit_id);
CREATE INDEX idx_vocab_unit_id ON vocab(unit_id);
CREATE INDEX idx_sentences_unit_id ON sentences(unit_id);

-- --- App defaults (structural, not content). INSERT OR IGNORE so re-running or
-- --- seeding on top is harmless. Values per brief §3. ---
INSERT OR IGNORE INTO app_state (id) VALUES (1);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', 'dark'),
  ('daily_goal', '30'),
  ('new_cards_per_day', '15'),
  ('target_retention', '0.9'),
  ('audio_enabled', 'true'),
  ('font_size', 'medium'),
  ('ai_enabled', 'false'),
  ('ai_api_key', '');
