# Lexiq

An offline-first desktop app for learning French (CEFR **A1 → A2**, with B1 in
progress). Structured lessons, spaced-repetition review (FSRS), six exercise
types, pronunciation audio, and progress tracking — all running locally with no
account and no internet required after install.

Built with [Tauri 2](https://tauri.app) (Rust host + system WebView),
Svelte 5 + TypeScript, and SQLite.

---

## 🧪 For testers — installing on Windows

You do **not** need to install Node, Rust, or anything technical. Just run the
installer.

1. **Download** the installer you were sent:
   - `Lexiq_0.1.0_x64-setup.exe` (recommended — simple, installs for the current
     user, no admin needed), **or**
   - `Lexiq_0.1.0_x64_en-US.msi`.
2. **Double-click it.**
3. **Windows will probably show a blue "Windows protected your PC" warning.**
   This is expected — the app isn't code-signed yet (code signing costs money and
   isn't set up for this test build). It is **not** a virus warning. To continue:
   - Click **More info**
   - Click **Run anyway**

   > This is the single most common reason a test build "won't open" — Windows
   > SmartScreen silently blocks unsigned apps until you do this.
4. Follow the installer, then launch **Lexiq** from the Start menu.

**Requirements:** Windows 10 or 11 (64-bit). The app uses Microsoft WebView2,
which is built into Windows 11 and most Windows 10 machines; if it's missing, the
installer fetches it automatically (needs internet **once**, during install).

**Your data:** progress is stored locally at
`%APPDATA%\com.lexiq.app\lexiq.db`. Uninstalling via *Add or Remove Programs*
removes the app; delete that file to reset progress.

### If it still won't start
- Make sure you ran the `.exe`/`.msi`, not the source code.
- If nothing happens on launch, install the WebView2 runtime manually from
  Microsoft ("Evergreen Standalone Installer"), then relaunch.
- Send the exact wording of any error dialog.

---

## 🛠️ For developers — building from source

Prerequisites: [Node.js](https://nodejs.org) 18+, the
[Rust toolchain](https://www.rust-lang.org/tools/install), and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for Windows
(Microsoft C++ Build Tools + WebView2).

```bash
npm install

# Run the app in development (hot-reloading native window)
npm run tauri dev

# Produce distributable installers (.exe + .msi) in
# src-tauri/target/release/bundle/
npm run tauri build
```

### Quality gates

```bash
npm run check    # svelte-check + tsc (app, node, content)
npm run lint     # ESLint
npm test         # Vitest (unit tests)
```

### Content pipeline

The seed database (`src-tauri/resources/lexiq.db`) and audio clips are
**generated**, not committed. To regenerate:

```bash
npm run build:content   # ingest Tatoeba sentences + build the seed DB
npm run build:audio     # synthesize pronunciation via edge-tts (needs Python)
```

`build:content` needs the Tatoeba/frequency source files in `content/.cache/`
(also gitignored). See `PROGRESS.md` for the full build state and architecture
notes.

---

## Status

Feature-complete for **A1–A2**: all six screens (Dashboard, Learn, Review,
Library, Stats, Settings), the full learning + review loop, 32 units (407 words,
525 exercises) with audio. Remaining before a 1.0: B1 content, a content-update
migration that preserves progress, an accessibility pass, and code signing.
