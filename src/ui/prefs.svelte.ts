/*
 * UI preference store for the DOM-affecting, instant-apply settings: reading
 * font size (stamped as data-font on <html>; see ui/theme.css) and whether clip
 * audio plays. Kept in localStorage — like the theme store — so they apply
 * before first paint without waiting on the DB. Study settings the scheduler
 * reads (new_cards_per_day, target_retention) live in the DB `settings` table.
 */

import { STORAGE_KEYS } from '../config/constants';

export type FontSize = 'small' | 'medium' | 'large';

function applyFont(size: FontSize): void {
  const root = document.documentElement;
  // 'medium' is the default (no attribute); small/large override --reading-size.
  if (size === 'medium') root.removeAttribute('data-font');
  else root.setAttribute('data-font', size);
}

function createPrefs() {
  const storedFont = localStorage.getItem(STORAGE_KEYS.fontSize);
  let fontSize = $state<FontSize>(
    storedFont === 'small' || storedFont === 'large' ? storedFont : 'medium',
  );
  // Audio on unless explicitly turned off.
  let audioEnabled = $state<boolean>(
    localStorage.getItem(STORAGE_KEYS.audioEnabled) !== 'false',
  );
  applyFont(fontSize);

  return {
    get fontSize(): FontSize {
      return fontSize;
    },
    setFontSize(next: FontSize): void {
      fontSize = next;
      localStorage.setItem(STORAGE_KEYS.fontSize, next);
      applyFont(next);
    },
    get audioEnabled(): boolean {
      return audioEnabled;
    },
    setAudioEnabled(next: boolean): void {
      audioEnabled = next;
      localStorage.setItem(STORAGE_KEYS.audioEnabled, String(next));
    },
  };
}

export const prefs = createPrefs();
