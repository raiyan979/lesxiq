import { defineConfig } from 'vitest/config';

// Vitest config. Phase 1 tests are pure TS (no DOM), so the default node
// environment is enough. When component/DOM tests arrive we'll add the svelte
// plugin + a jsdom environment. `passWithNoTests` keeps CI green if a run
// happens to match no files.
export default defineConfig({
  test: {
    include: [
      'src/**/*.{test,spec}.ts',
      'content/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
    passWithNoTests: true,
  },
});
