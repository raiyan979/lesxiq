/*
 * SQLite connection + runtime migration runner. This is the ONLY place the app
 * opens the database; every other module goes through the query functions in
 * db/queries.ts (brief §2/§12: only db/ touches SQLite).
 *
 * The database file itself is placed in the app's data dir by the Rust
 * first-launch copy (src-tauri/src/lib.rs), which seeds it from the bundled
 * resources before the WebView loads. `sqlite:lexiq.db` resolves to that same
 * app-data location on the plugin side.
 */

import Database from '@tauri-apps/plugin-sql';
import { migrations } from './migrations';

const DB_URL = 'sqlite:lexiq.db';

let dbPromise: Promise<Database> | null = null;

/**
 * Get the shared DB connection, loading + migrating it on first call. Callers
 * should always await this rather than caching the resolved Database, so the
 * migration step is guaranteed to have run.
 */
export function getDb(): Promise<Database> {
  if (dbPromise === null) {
    dbPromise = load();
  }
  return dbPromise;
}

async function load(): Promise<Database> {
  let db: Database;
  try {
    db = await Database.load(DB_URL);
  } catch (cause) {
    // A missing/locked DB file is unrecoverable and must be surfaced, not
    // swallowed (§12). The UI shows this message rather than a blank screen.
    throw new Error(
      `Could not open the Lexiq database (${DB_URL}). The app data may be ` +
        `missing or corrupted. Try reinstalling.`,
      { cause },
    );
  }
  await runMigrations(db);
  return db;
}

/**
 * Apply any migrations whose version is newer than PRAGMA user_version. For a
 * shipped, pre-seeded DB this is a no-op (user_version already == LATEST); it
 * exists to upgrade an existing user database on a future app version.
 */
async function runMigrations(db: Database): Promise<void> {
  const rows = await db.select<{ user_version: number }[]>('PRAGMA user_version');
  const current = rows[0]?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    for (const statement of splitStatements(migration.sql)) {
      await db.execute(statement);
    }
    // PRAGMA can't be parameterized; version is an integer from our own code.
    await db.execute(`PRAGMA user_version = ${migration.version}`);
  }
}

/**
 * Split a migration file into individual statements. The SQL plugin executes
 * one statement per call, so multi-statement files must be split. This handles
 * our own controlled migration SQL (no semicolons inside string literals);
 * full-line `--` comments are stripped first.
 */
function splitStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  return withoutLineComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
