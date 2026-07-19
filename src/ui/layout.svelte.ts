/*
 * Shared chrome/layout state. Currently just sidebar collapse, persisted to
 * localStorage so the choice survives reloads. Exposed as a store (not props)
 * because Phase 4's focused exercise session needs to auto-collapse the sidebar
 * from far down the tree without threading props through every layer.
 */

import { STORAGE_KEYS } from '../config/constants';

function createLayout() {
  let sidebarCollapsed = $state(
    localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true',
  );

  function persist(): void {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(sidebarCollapsed));
  }

  return {
    get sidebarCollapsed(): boolean {
      return sidebarCollapsed;
    },
    toggleSidebar(): void {
      sidebarCollapsed = !sidebarCollapsed;
      persist();
    },
    setSidebarCollapsed(value: boolean): void {
      sidebarCollapsed = value;
      persist();
    },
  };
}

export const layout = createLayout();
