/*
 * Single source of truth for magic numbers. The brief (§12) forbids unnamed
 * constants scattered through the code: caps, thresholds, XP values, and chrome
 * dimensions all live here with a note on where each value comes from.
 *
 * UI dimensions are duplicated as CSS variables in ui/theme.css because CSS
 * can't import from TS; keep the two in sync (they're annotated on both sides).
 */

export const APP_NAME = 'Lexiq';

/** Chrome dimensions (px). Mirror of the --sidebar/--statusbar vars in theme.css. */
export const CHROME = {
  sidebarWidth: 240, // §6/§7: expanded sidebar
  sidebarWidthCollapsed: 64, // §6: collapsed sidebar
  statusBarHeight: 44, // §6: top status bar
  contentMaxWidth: 720, // §7: reading column
  exerciseMaxWidth: 640, // §7: focused exercise column
} as const;

/** localStorage keys for UI state that must survive reloads before the DB is wired. */
export const STORAGE_KEYS = {
  sidebarCollapsed: 'lexiq.sidebarCollapsed',
  theme: 'lexiq.theme',
  fontSize: 'lexiq.fontSize',
  audioEnabled: 'lexiq.audioEnabled',
} as const;
