/*
 * Theme store. Applies `data-theme` to <html> (see ui/theme.css) and persists
 * the choice. Dark is the default per the brief. In Phase 7 the source of truth
 * moves to the `settings` table; localStorage keeps the shell themable before
 * the DB exists and avoids a flash of the wrong theme on load.
 */

import { STORAGE_KEYS } from '../config/constants';

export type Theme = 'dark' | 'light';

function applyToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function createTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  let theme = $state<Theme>(stored === 'light' ? 'light' : 'dark');
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
      set(theme === 'dark' ? 'light' : 'dark');
    },
  };
}

export const themeStore = createTheme();
