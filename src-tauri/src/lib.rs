use std::fs;

use tauri::path::BaseDirectory;
use tauri::{App, Manager};

/// First-launch seed. The app ships a pre-built `lexiq.db` (curriculum + cards)
/// as a bundled resource. The SQL plugin opens `sqlite:lexiq.db` from the app's
/// config dir, so on the very first run we copy the bundled seed there. On every
/// later run the user's own database is left untouched.
fn seed_database(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = app.path().app_config_dir()?;
    let target = config_dir.join("lexiq.db");
    if target.exists() {
        return Ok(());
    }

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
    fs::copy(&bundled, &target)?;
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
