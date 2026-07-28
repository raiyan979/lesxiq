<script lang="ts">
  import { navItems } from './routes';
  import type { IconName } from './Icon.svelte';
  import Icon from './Icon.svelte';
  import { router, navigate } from './router.svelte';
  import { layout } from './layout.svelte';
  import { APP_NAME } from '../config/constants';

  // Nav labels are lowercased for the terminal aesthetic; the icon name is
  // derived from the label so the two lists can't drift apart.
  const iconFor = (label: string): IconName => label.toLowerCase() as IconName;

  /** A nav item is active on an exact match, or when the current path is nested
   *  under it (e.g. /learn/3 keeps "Learn" active). Root '/' matches exactly. */
  function isActive(path: string, current: string): boolean {
    if (path === '/') return current === '/';
    return current === path || current.startsWith(`${path}/`);
  }

  function go(event: MouseEvent, path: string): void {
    event.preventDefault();
    navigate(path);
  }
</script>

<nav class="sidebar" class:collapsed={layout.sidebarCollapsed} aria-label="Primary">
  <div class="brand mono" aria-hidden={layout.sidebarCollapsed}>
    {layout.sidebarCollapsed ? 'Lx' : APP_NAME}
  </div>

  <ul class="nav">
    {#each navItems as item (item.path)}
      {@const active = isActive(item.path, router.path)}
      <li>
        <a
          href={`#${item.path}`}
          class="nav-item mono"
          class:active
          aria-current={active ? 'page' : undefined}
          title={layout.sidebarCollapsed ? item.label : undefined}
          onclick={(e) => go(e, item.path)}
        >
          <span class="nav-icon"><Icon name={iconFor(item.label)} /></span>
          {#if !layout.sidebarCollapsed}
            <span class="nav-label">{item.label}</span>
          {/if}
        </a>
      </li>
    {/each}
  </ul>

  <button
    class="collapse-toggle mono"
    onclick={() => layout.toggleSidebar()}
    aria-expanded={!layout.sidebarCollapsed}
    aria-label={layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  >
    <Icon name={layout.sidebarCollapsed ? 'chevron-right' : 'chevron-left'} />
    {#if !layout.sidebarCollapsed}<span>Collapse</span>{/if}
  </button>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: var(--sidebar-width);
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    transition: width var(--transition);
    overflow: hidden;
  }
  .sidebar.collapsed {
    width: var(--sidebar-width-collapsed);
  }

  .brand {
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-text);
    padding: var(--space-4) var(--space-4) var(--space-5);
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .nav {
    list-style: none;
    margin: 0;
    padding: 0 var(--space-2);
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-button);
    /* transparent left border reserved so the accent border doesn't shift text */
    border-left: 2px solid transparent;
    color: var(--text-dim);
    white-space: nowrap;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }
  .nav-item:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .nav-item.active {
    color: var(--accent-text);
    border-left-color: var(--accent);
    background: var(--surface-2);
  }

  .nav-icon {
    display: inline-flex;
    flex: 0 0 auto;
  }
  .collapsed .nav-item {
    justify-content: center;
    padding-left: var(--space-2);
    padding-right: var(--space-2);
  }

  .collapse-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    color: var(--text-dim);
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }
  .collapse-toggle:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .collapsed .collapse-toggle {
    justify-content: center;
  }
</style>
