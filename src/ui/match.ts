/*
 * Pure path-matching for the hash router. Kept separate from router.svelte.ts
 * (which holds reactive state + window listeners) so this logic is unit-testable
 * without Svelte or a DOM.
 */

/**
 * Match a concrete path against a pattern such as '/learn/:unitId'.
 * Returns the captured params (empty object for static patterns), or null when
 * the pattern does not match. Root '/' matches only '/'.
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternSegs = pattern.split('/').filter(Boolean);
  const pathSegs = path.split('/').filter(Boolean);
  if (patternSegs.length !== pathSegs.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const seg = patternSegs[i]!;
    const value = pathSegs[i]!;
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(value);
    } else if (seg !== value) {
      return null;
    }
  }
  return params;
}
