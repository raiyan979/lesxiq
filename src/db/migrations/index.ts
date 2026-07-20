/*
 * Migration registry. The .sql files are the canonical schema; both the
 * build-time pipeline (content/build.ts, via fs) and the runtime migration
 * runner (db/client.ts, via Vite's ?raw import) read the same text so they can
 * never drift.
 *
 * Runtime migrations are driven by PRAGMA user_version (see client.ts), NOT by
 * the SQL plugin's Rust-side migrations — that keeps all DB logic in the db/
 * module and avoids a mismatch with the pre-seeded database, which is created
 * by the Node pipeline rather than by sqlx.
 */

import init0001 from './0001_init.sql?raw';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  { version: 1, name: 'init', sql: init0001 },
];

export const LATEST_VERSION = migrations.reduce(
  (max, m) => Math.max(max, m.version),
  0,
);
