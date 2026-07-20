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
  authoring 3/40 units).
- [ ] **Phase 3** — scheduler (ts-fsrs wrapper, queue, rating derivation).
- [ ] **Phase 4** — 6 exercise components + pure graders + focused session UI.
- [ ] **Phase 5** — curriculum map, unit detail, lesson viewer, unlock/progress.
- [ ] **Phase 6** — dashboard, stats + charts, streak/XP.
- [ ] **Phase 7** — settings + optional AI module (stub, disabled).
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

### Phase 2 leftovers
- **#11 Author 37 more units** — A1 ×15 (days/months, family, food, gender &
  articles le/la/les/un/une, questions Où est/C'est combien, present tense -er),
  A2 ×14 (start passé composé EARLY per brief), B1 ×8. Append to
  `content/curriculum/a1.ts` + new `a2.ts`, `b1.ts`; add to `index.ts`. Then rebuild.
- **#9 Rust first-launch seed copy** — in `src-tauri/src/lib.rs` `setup()`, copy
  bundled `resources/lexiq.db` (+ later `audio/`) into app data dir if absent, so
  `Database.load('sqlite:lexiq.db')` opens the seeded copy. Bundle `resources/` in
  `tauri.conf.json`. Graceful message if missing.
- **#13 Audio (DEFERRED)** — Piper/edge-tts TTS for every vocab+sentence, write
  files + UPDATE `audio_path`. App already degrades gracefully with NULL audio_path.

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
