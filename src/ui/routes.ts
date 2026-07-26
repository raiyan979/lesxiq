/*
 * The route table (pattern → component) and the sidebar nav definition.
 * Kept separate from router.svelte.ts so the router stays component-agnostic.
 * Nested routes (/learn/:unitId, .../lesson/:lessonId) are added in Phase 5.
 */

import type { Component } from 'svelte';
import Dashboard from '../routes/Dashboard.svelte';
import Learn from '../routes/Learn.svelte';
import UnitDetail from '../routes/UnitDetail.svelte';
import Session from '../routes/Session.svelte';
import Review from '../routes/Review.svelte';
import Library from '../routes/Library.svelte';
import Stats from '../routes/Stats.svelte';
import Settings from '../routes/Settings.svelte';

export interface RouteEntry {
  pattern: string;
  component: Component<Record<string, never>>;
  /** Shown on the left of the status bar as the current view title. */
  title: string;
}

export const routes: RouteEntry[] = [
  { pattern: '/', component: Dashboard, title: 'Dashboard' },
  { pattern: '/learn', component: Learn, title: 'Learn' },
  { pattern: '/learn/:unitId', component: UnitDetail, title: 'Unit' },
  { pattern: '/learn/:unitId/practice', component: Session, title: 'Practice' },
  { pattern: '/review', component: Review, title: 'Review' },
  { pattern: '/library', component: Library, title: 'Library' },
  { pattern: '/stats', component: Stats, title: 'Stats' },
  { pattern: '/settings', component: Settings, title: 'Settings' },
];

export interface NavItem {
  path: string;
  label: string;
}

/** Sidebar nav — the six top-level destinations, in display order (§6). */
export const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/learn', label: 'Learn' },
  { path: '/review', label: 'Review' },
  { path: '/library', label: 'Library' },
  { path: '/stats', label: 'Stats' },
  { path: '/settings', label: 'Settings' },
];
