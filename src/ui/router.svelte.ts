/*
 * Minimal hash-based router. Chosen over a routing library deliberately (see
 * Phase 0 notes): the Svelte 5 router ecosystem is still stabilizing, and a
 * hash router for a fixed set of desktop routes is ~40 lines with zero deps and
 * no SSR concerns. Hash routing (not history) also avoids the file:// / custom
 * scheme path issues Tauri's WebView can hit with the History API.
 *
 * This module knows nothing about components — it only tracks the current path.
 * Pattern matching lives in ui/match.ts; the route→component table in routes.ts.
 */

/** Read the current path from the URL hash, normalized to a leading '/'. */
function readHashPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  if (raw === '' || raw === '/') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function createRouter() {
  let path = $state(readHashPath());

  window.addEventListener('hashchange', () => {
    path = readHashPath();
  });

  return {
    /** Current normalized path, e.g. '/' or '/learn/3'. Reactive. */
    get path(): string {
      return path;
    },
  };
}

export const router = createRouter();

/** Navigate to a path. Updating the hash triggers the reactive update above. */
export function navigate(path: string): void {
  const target = path.startsWith('/') ? path : `/${path}`;
  window.location.hash = target;
}
