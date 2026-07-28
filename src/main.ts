import { mount } from 'svelte';

// Self-hosted fonts (bundled by Vite → no runtime CDN, works fully offline).
// UI: Plus Jakarta Sans 400/500/600/700/800 (redesign). Numbers/labels:
// JetBrains Mono 400/500/600/700.
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';

import './ui/theme.css';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Root #app element not found in index.html');
}

const app = mount(App, { target });

export default app;
