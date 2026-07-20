/*
 * Typed query functions. Every read/write of the database goes through a named
 * function here so SQL stays in db/ and callers get typed results. More queries
 * are added here as later phases need them (scheduler, curriculum, stats);
 * this file starts with the settings + app_state access the shell needs.
 */

import { getDb } from './client';
import type { AppStateRow, SettingRow } from './types';

// --- settings (key/value) ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<SettingRow[]>(
    'SELECT key, value FROM settings WHERE key = $1',
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<SettingRow[]>('SELECT key, value FROM settings');
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  // Upsert so callers don't need to know whether the key already exists.
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

// --- app_state (single row, id = 1) ---

export async function getAppState(): Promise<AppStateRow> {
  const db = await getDb();
  const rows = await db.select<AppStateRow[]>(
    'SELECT * FROM app_state WHERE id = 1',
  );
  const state = rows[0];
  if (state === undefined) {
    // The migration seeds this row; its absence means a corrupt DB.
    throw new Error('app_state row (id=1) is missing — database is corrupt.');
  }
  return state;
}
