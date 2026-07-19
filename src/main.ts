import { mount } from 'svelte';

// Self-hosted fonts (bundled by Vite → no runtime CDN, works fully offline).
// Only the weights the design system uses (§7): Inter 400/500/600/700,
// JetBrains Mono 400/500.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './ui/theme.css';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Root #app element not found in index.html');
}

const app = mount(App, { target });

export default app;
