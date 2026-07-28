# Lexiq — Build Progress Tracker

Offline-first French (A1→B1 CEFR) learning desktop app. Tauri 2 + Svelte 5 + TS
(strict) + Vite; SQLite via `@tauri-apps/plugin-sql`; `ts-fsrs` scheduling.
Built in phases per the original brief. **Repo:** `raiyan979/lesxiq` (note spelling).

This file is the single source of truth for build state across sessions. Update
it as work lands.

---

## Phase status

- [x] **Phase 0** — plan approved. Decisions: author ALL ~40 units; Windows build
  only (can't cross-compile macOS from Windows); per-phase acceptance checklists;
  **audio deferred** entirely for now (task #13).
- [x] **Phase 1** — scaffold + shell (DONE, pushed).
- [~] **Phase 2** — db + content pipeline (MOSTLY DONE — pipeline proven; curriculum
  authoring 3/40 units). **#9 seed-copy DONE** (below).
- [x] **Phase 3** — scheduler (ts-fsrs wrapper, queue, rating derivation) — DONE.
- [x] **Phase 4** — 6 pure graders + exercise components + focused session UI — DONE.
  Unit-practice loop live. **Review daily-queue loop DONE**: `getReviewItems()` builds
  flashcards from the due+new queue (front=EN/concept, back=FR+IPA+audio, grammar=markdown);
  `src/review/` controller + `Review.svelte` (reveal → 4 FSRS buttons → gradeCard → next,
  autoplay audio on flip, keyboard 1–4/Space, empty + done states). Verified vs seed DB
  (15-card queue resolves, 14/15 with audio).
- [x] **Phase 5** — curriculum map (Learn units list), unit detail + lesson viewer
  (grammar/dialogue lessons via `marked`, vocab table, `/learn/:unitId` → `/practice`),
  and unlock-on-completion (finish practice → unit `completed`, next unit → `available`;
  start practice → `in_progress`). Verified against seed DB. DONE.
- [x] **Phase 6** — **Dashboard DONE**: `getDashboardData()` (queries.ts) composes
  study-status + app_state totals + resume-unit + unit counts in one call; `Dashboard.svelte`
  (was placeholder) shows greeting, a Review hero card (due count / new-today / caught-up
  state → /review), a Continue-learning card (first in-progress else first available unit →
  /learn/:id, or a "all complete" state), and a 5-tile stats strip (streak+best, XP, reviews,
  words learned, units done). Type-check + lint clean.
  **Stats screen DONE**: `getStatsData()` (queries.ts) returns reviews/day (last 14, zero-filled),
  rating distribution + retention %, card-state mix, and a 14-day due forecast (overdue folded
  into day 0, >14d dropped). `Stats.svelte` renders a KPI row + two inline-SVG bar charts
  (reviews/day, forecast) + a stacked card-mix bar with legend — zero chart deps. Empty states
  when no history. Data-shaping logic verified vs synthetic node:sqlite data (zero-fill, overdue
  folding, retention 3/5→60% all correct). Type-check + lint clean.
  **Library DONE**: `Library.svelte` (was a mislabeled placeholder) — Vocabulary/Sentences
  tabs over a search box. Vocab (`getLibraryVocab`) loads all ~400 rows once, filters
  client-side (accent-insensitive) with an A1/A2 level filter, shows IPA + audio + a
  mastery badge (New/Learning/Known from FSRS card state). Sentences (`searchLibrarySentences`)
  is a capped, debounced DB search over the full ~30k Tatoeba pool (empty query → authored
  in-unit sentences; query → LIKE fr/en, audio-backed first), with audio + mastery where a
  card exists. Verified vs seed DB (407 vocab, audio-first ordering, mastery mapping).
  **Phase 6 COMPLETE** (dashboard + stats + library + live streak/XP status bar).
- [~] **Phase 7** — **Settings DONE**: `Settings.svelte` (was placeholder) with Appearance
  (theme dark/light via themeStore, font size small/medium/large via new `src/ui/prefs.svelte.ts`
  → `data-font` on <html>, localStorage-backed like theme, imported in App.svelte for flash-free
  apply), Study (new_cards_per_day number + target_retention select → DB `settings`, read by
  scheduler/status bar; audio on/off toggle gating `playClip` via prefs), a disabled AI "coming
  soon" stub, and Data → Reset progress (`resetProgress()` in queries.ts: clears review_logs,
  all cards→new, zeroes app_state, re-locks all units except the first; two-step confirm).
  Reset SQL verified vs seed-DB copy (all fresh-state assertions pass). Type-check + lint clean.
  **Remaining Phase 7**: nothing required (AI is an intentional disabled stub).
- [ ] **Phase 8** — a11y pass, adversarial review, README, Windows packaging.

---

## Completed in detail

### Phase 1 (all pushed, commit `Phase 1: scaffold...`)
- Tauri 2 host wired into Vite (port 1420); identifier `com.lexiq.app`; window 1180×780.
- SQL plugin registered in Rust (`tauri-plugin-sql`, bundled sqlite) + `sql:default` cap.
- Design tokens `src/ui/theme.css` (both themes, §7 palette verbatim, reduced-motion).
- Self-hosted fonts (Inter + JetBrains Mono via `@fontsource`) — offline.
- App shell: collapsible sidebar, status bar, tiny hash router (`src/ui/router.svelte.ts`
  + pure `src/ui/match.ts`), 6 route stubs.
- Tooling: strict TS, ESLint flat (`no-explicit-any` error), Prettier, Vitest.
- Verified in browser pane (dark+light, routing, collapse). Rust `cargo build` clean.

### Phase 2 (NOT yet committed until this checkpoint)
- **DB module `src/db/`**: `migrations/0001_init.sql` (exact §3 schema + indexes +
  default settings/app_state), `migrations/index.ts`, `types.ts` (all row types),
  `client.ts` (connection singleton + JS migration runner via `PRAGMA user_version`),
  `queries.ts` (settings + app_state, more added per-phase), `index.ts` barrel.
- **Difficulty scorer** `content/pipeline/difficulty.ts` (§4.3): word-count +
  mean-frequency-rank + tense-regex → [0,1]. **22 tests.**
- **Frequency list** `content/pipeline/frequency.ts` — hermitdave fr_50k
  (OpenSubtitles-derived; documented substitute for Lexique).
- **Tatoeba ingest** `content/pipeline/tatoeba.ts` (pure helpers, **11 tests**) +
  `ingest.ts` (streaming FR↔EN join over 28M links). Output:
  `content/.cache/sentence_pool.json` = **30,000 pairs**, uniformly sampled across
  the full difficulty range (0.0→0.77).
- **Exercise generator** `content/pipeline/exercises.ts` (**12 tests**): deterministic
  (mulberry32 seed), makes all 6 exercise types from vocab + sentences.
- **Curriculum model** `content/curriculum/types.ts`; **3 A1 units authored** in
  `content/curriculum/a1.ts` (Greetings, Introductions, Numbers); `index.ts` aggregator.
- **Seed builder** `content/build.ts` (node:sqlite): runs migration → inserts
  units/lessons/vocab/authored-sentences/pool → generates exercises → creates cards.
  Produces `resources/lexiq.db`. **Verified**: 3 units, 45 exercises (all 6 types),
  67 cards, 0 orphan FK refs, 3.3 MB.
- Strict `content/tsconfig.json` wired into `npm run check`.
- **Total: 51 tests passing; check + lint clean.**

---

## Remaining

### Content authoring (#11) — IN PROGRESS
- **A1: COMPLETE — 18/18 units** in `a1.ts`: greetings, introductions, numbers,
  articles, -er verbs, family, food, days/months, questions, colours/adjectives,
  house, time, weather, clothing, body/health, directions, hobbies, shopping.
  Verified: 18/18 have all 6 exercise types, 0 orphans, 238 vocab, 273 exercises.
- **A2: COMPLETE — 14/14 units** in `a2.ts`: passé composé (avoir), passé composé
  (être), imparfait, futur proche, daily routine (reflexive verbs), object pronouns
  (le/la/lui/leur), negation (jamais/rien/personne/plus/que), comparatives/superlatives,
  travel & transport (prepositions), restaurant (partitive du/de la/des), shopping &
  quantities (quantity + de), health & body (avoir mal à), pronouns y & en, connectors
  (parce que/donc/mais/alors). Each: 12 vocab, 2 lessons, 18 exercises (6/6 types),
  +3 hand-authored grammar cloze drills. Verified vs rebuilt seed: 0 orphan FKs.
- **B1 ×~8** — new `b1.ts`. Add each array to `index.ts`. Rebuild seed after each batch.
- Seed rebuild proven: **32 units (18 A1 + 14 A2) → 407 vocab, 525 exercises, 664 cards,
  0 orphans** (`npx tsx content/build.ts`; sentence_pool.json cached, so ingest skipped).
  NOTE: audio for the new A2 vocab/sentences not yet generated — run `npm run build:audio`.

### Gamification / status bar (part of Phase 6) — DONE (initial)
- Status bar is now LIVE (was hardcoded 0s): `src/ui/stats.svelte.ts` reactive store,
  `getStudyStatus()` + `recordReview()` in queries.ts. XP by rating (2/5/10/12),
  daily streak (increment if yesterday, reset on gap, shown 0 if broken), due-count,
  new-today vs `new_cards_per_day`. Refreshes after each grade. Verified vs seed DB.
- **#9 Rust first-launch seed copy** — in `src-tauri/src/lib.rs` `setup()`, copy
  bundled `resources/lexiq.db` (+ later `audio/`) into app data dir if absent, so
  `Database.load('sqlite:lexiq.db')` opens the seeded copy. Bundle `resources/` in
  `tauri.conf.json`. Graceful message if missing.
- **#13 Audio — DONE.** `content/pipeline/audio.ts` synthesizes every vocab word +
  authored sentence via **edge-tts** (`fr-FR-DeniseNeural`) → `src-tauri/resources/audio/
  <sha1>.mp3` (452 clips, 6.2 MB, deterministic + incremental; `npm run build:audio`).
  `build.ts` sets `audio_path` (287 vocab, 176 sentences, 22 listening exercises).
  Bundled via `tauri.conf.json` resources; played through the **asset protocol**
  (`assetProtocol.enable` + scope `$RESOURCE/**`) using `resolveResource` +
  `convertFileSrc` in `src/ui/audio.ts`. UI: `AudioButton.svelte` on vocab rows +
  listening-dictation (real audio now, not the text fallback). Degrades to no-op if
  a clip/path is missing or not under Tauri. Audio files are gitignored (regenerable).

### Then Phases 3–8 (see phase status above).

---

## Errors/gotchas encountered (and fixes) — don't repeat these

1. **ESLint parse errors on `.svelte` / `.svelte.ts`** (`interface reserved`, etc.):
   TS parser wasn't wired. FIX: add a `files: ['**/*.svelte','**/*.svelte.ts',...]`
   block in `eslint.config.js` with `parserOptions.parser: ts.parser` + `svelteConfig`.
2. **`preserve-caught-error` lint** in `client.ts`: rethrew without cause. FIX: use
   `new Error(msg, { cause })`.
3. **Difficulty test fail — "français" flagged as imparfait** (ends `-ais`). FIX:
   require a subject-pronoun immediately before the imparfait-ending word.
4. **Pool sampling bias**: first ingest sorted ascending + kept easiest 20k → ALL
   sentences in difficulty band [0,0.1], nothing for A2/B1. FIX: uniform-by-rank
   sampling across the full sorted pool (`ingest.ts`), cap 30k, + histogram logging.
5. **Browser-pane screenshots time out** in this env (capture subsystem, NOT the
   app — JS/DOM/console calls respond fine). Verify via `read_page`/`javascript_tool`.
6. **GitHub repo is `lesxiq`** (misspelled), not `lexiq`. `gh` CLI not installed;
   pushes work via Git Credential Manager.
7. Node native TS needs `.ts` import extensions; we use **tsx** for pipeline scripts
   to keep extension-less imports. Big joins need
   `NODE_OPTIONS=--max-old-space-size=4096`.
9. **New seed content not visible after rebuild — first-launch copy only.**
   `seed_database` copies `resources/lexiq.db` into the app config dir ONLY if
   absent, so rebuilding the seed does NOT reach an already-installed user. During
   authoring, refresh by deleting `%APPDATA%\com.lexiq.app\lexiq.db` (resets test
   progress) then relaunching. TODO (before ship): content-versioned migration so
   updates land without wiping progress.
8. **SQL writes silently failed (reads worked) — missing capability.**
   `sql:default` grants only `allow-close/allow-load/allow-select` (reads). Writes
   go through the `execute` command, which needs `sql:allow-execute`. Symptom:
   exercises load fine but grading never persists (review_logs stays empty). FIX:
   add `"sql:allow-execute"` to `src-tauri/capabilities/default.json`. Requires a
   Rust rebuild (restart `tauri dev`). Also: the session now surfaces write errors
   on-screen instead of hanging silently.

---

## Key commands
- `npm run check` — svelte-check + tsc (app, node, content).
- `npm run lint` / `npm run format` / `npm test`.
- `npm run build:content` — ingest Tatoeba + build `resources/lexiq.db`.
  (Requires the Tatoeba/frequency downloads in `content/.cache/` — gitignored;
  re-download via the ingest step. `sentence_pool.json` + `lexiq.db` are generated,
  not committed.)
- `npm run tauri dev` — run the desktop app (native window).

## Architecture invariants (keep these)
- Only `src/db/` touches SQLite. Only `content/` code is build-time (never bundled).
- Only `scheduler/` will call ts-fsrs; only `exercises/` graders decide correctness.
- All magic numbers named in a config module. Runtime is 100% offline.
