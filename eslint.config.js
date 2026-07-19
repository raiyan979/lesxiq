import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

// Flat config (ESLint 9+). Order matters: base rules first, then the prettier
// config near the end so it turns off stylistic rules that fight Prettier.
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // The brief forbids `any` without a written justification. Enforce it;
      // genuine escape hatches use an inline eslint-disable + comment.
      '@typescript-eslint/no-explicit-any': 'error',
      // Unused vars are errors, but allow the `_`-prefix convention for
      // deliberately-ignored args (e.g. handlers that ignore the event).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Hand <script lang="ts"> blocks and .svelte.ts rune modules to the TS
    // parser. Without this, svelte-eslint-parser falls back to plain JS and
    // chokes on TS syntax (interfaces, type annotations).
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
      },
    },
  },
  {
    ignores: ['dist/', 'src-tauri/', 'node_modules/', 'resources/'],
  },
);
