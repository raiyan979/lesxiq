use std::fs;

use tauri::path::BaseDirectory;
use tauri::{App, Manager};

/// Seed + content-sync setup. The app ships a pre-built `lexiq.db` (curriculum +
/// cards) as a bundled resource.
///
/// * `lexiq.db` — the user's working database. Copied from the bundled seed on
///   the *first* run only; left untouched afterwards so progress is preserved.
/// * `lexiq.seed.db` — a pristine copy of the bundled seed, refreshed on *every*
///   run. The frontend opens it read-only and diffs its `content_version`
///   against the working DB to upgrade content in place (src/db/content-sync.ts).
///
/// Both live in the app config dir, where the SQL plugin resolves
/// `sqlite:<name>` and can open them read-write.
fn seed_database(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = app.path().app_config_dir()?;

    let bundled = app
        .path()
        .resolve("resources/lexiq.db", BaseDirectory::Resource)?;
    if !bundled.exists() {
        return Err(format!(
            "Seed database missing from the app bundle (expected at {}). \
             Run `npm run build:content` before building the app.",
            bundled.display()
        )
        .into());
    }

    fs::create_dir_all(&config_dir)?;

    // First launch only: seed the user's working DB.
    let target = config_dir.join("lexiq.db");
    if !target.exists() {
        fs::copy(&bundled, &target)?;
    }

    // Every launch: refresh the read-only seed sidecar the content-sync diffs
    // against, clearing any stale WAL/SHM so the fresh copy opens cleanly.
    let seed_side = config_dir.join("lexiq.seed.db");
    fs::copy(&bundled, &seed_side)?;
    for suffix in ["-wal", "-shm"] {
        let stale = config_dir.join(format!("lexiq.seed.db{suffix}"));
        if stale.exists() {
            let _ = fs::remove_file(stale);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // The SQL plugin owns all DB access from the JS side (@tauri-apps/plugin-sql).
    // The frontend opens `sqlite:lexiq.db`, which resolves to the app config dir
    // where `seed_database` (below) placed the pre-built seed on first launch.
    .plugin(tauri_plugin_sql::Builder::default().build())
    .setup(|app| {
      // Seed the DB before the WebView calls Database.load().
      seed_database(app)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
