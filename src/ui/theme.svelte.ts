/*
 * Theme store. Applies `data-theme` to <html> (see ui/theme.css) and persists
 * the choice. Dark is the default per the brief. In Phase 7 the source of truth
 * moves to the `settings` table; localStorage keeps the shell themable before
 * the DB exists and avoids a flash of the wrong theme on load.
 */

import { STORAGE_KEYS } from '../config/constants';

export type Theme = 'amber' | 'dark' | 'light';

/** Cycle order for the toggle; amber (the signature default) comes first. */
const THEME_ORDER: Theme[] = ['amber', 'dark', 'light'];

function applyToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function createTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  // Amber is the default signature theme; fall back to it for new users.
  let theme = $state<Theme>(
    stored === 'light' || stored === 'dark' || stored === 'amber' ? stored : 'amber',
  );
  applyToDocument(theme);

  function set(next: Theme): void {
    theme = next;
    localStorage.setItem(STORAGE_KEYS.theme, next);
    applyToDocument(next);
  }

  return {
    get theme(): Theme {
      return theme;
    },
    set,
    toggle(): void {
      const i = THEME_ORDER.indexOf(theme);
      set(THEME_ORDER[(i + 1) % THEME_ORDER.length]!);
    },
  };
}

export const themeStore = createTheme();
