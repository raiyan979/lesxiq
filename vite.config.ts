import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri expects the dev server on a fixed port (matching `devUrl` in
// tauri.conf.json). `strictPort` makes a port collision fail loudly instead of
// silently hopping to another port that Tauri won't be pointing at.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // Vite prints its own screen clears; keep Tauri's Rust errors visible.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Rust source changes are handled by Tauri, not Vite.
      ignored: ['**/src-tauri/**'],
    },
  },
});
