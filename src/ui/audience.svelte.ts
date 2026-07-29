/*
 * Audience store — chooses the wording register for English labels: 'adult'
 * (full CEFR grammar terms) or 'child' (simpler chapter names for under-12s).
 * Default is 'adult'. Persisted in localStorage like the theme/prefs stores so
 * it applies before first paint without waiting on the DB. This only swaps
 * English UI labels — the French learning content is never affected.
 *
 * `onboarded` tracks whether the first-launch chooser has been answered, so it
 * shows once and never again (App.svelte gates on it).
 */

import { STORAGE_KEYS } from '../config/constants';
import type { Audience } from './audience-copy';

// Re-exported so components can keep importing the type from the store module.
export type { Audience };

function createAudience() {
  const stored = localStorage.getItem(STORAGE_KEYS.audience);
  let audience = $state<Audience>(stored === 'child' ? 'child' : 'adult');
  let onboarded = $state<boolean>(localStorage.getItem(STORAGE_KEYS.onboarded) === 'true');

  function set(next: Audience): void {
    audience = next;
    localStorage.setItem(STORAGE_KEYS.audience, next);
  }

  return {
    get current(): Audience {
      return audience;
    },
    get onboarded(): boolean {
      return onboarded;
    },
    set,
    /** Record the first-launch choice and dismiss the chooser for good. */
    choose(next: Audience): void {
      set(next);
      onboarded = true;
      localStorage.setItem(STORAGE_KEYS.onboarded, 'true');
    },
  };
}

export const audience = createAudience();
