<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import StatusBar from './StatusBar.svelte';
  import { routes } from './routes';
  import { router } from './router.svelte';
  import { matchPath } from './match';

  // Resolve the current route from the hash. Falls back to the first route
  // (Dashboard) for unknown paths so a stray hash never blanks the screen.
  const resolved = $derived.by(() => {
    for (const entry of routes) {
      const params = matchPath(entry.pattern, router.path);
      if (params) return { entry, params };
    }
    return { entry: routes[0]!, params: {} as Record<string, string> };
  });

  // Capitalized alias so the dynamic component can be used as a tag below.
  const RouteComponent = $derived(resolved.entry.component);

  let mainEl: HTMLElement | undefined;
  function skipToContent(event: MouseEvent): void {
    // Focus main directly instead of an href="#main" jump, which would collide
    // with hash-based routing.
    event.preventDefault();
    mainEl?.focus();
  }
</script>

<a class="skip-link mono" href="#/" onclick={skipToContent}>Skip to content</a>

<div class="shell">
  <Sidebar />
  <div class="main-col">
    <StatusBar title={resolved.entry.title} />
    <main class="content" bind:this={mainEl} tabindex="-1">
      {#key router.path}
        <RouteComponent />
      {/key}
    </main>
  </div>
</div>

<style>
  .shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .main-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0; /* let content shrink instead of overflowing the sidebar */
    min-height: 0; /* allow the content child to scroll within the column */
  }
  .content {
    flex: 1;
    min-height: 0; /* REQUIRED for overflow to scroll inside a flex column */
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scroll-behavior: smooth;
    padding-bottom: var(--space-8); /* breathing room so the last item isn't flush */
    outline: none; /* focused only programmatically via skip link */
  }

  .skip-link {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    z-index: 100;
    padding: var(--space-2) var(--space-3);
    background: var(--accent);
    color: var(--on-accent);
    border-radius: var(--radius-button);
    transform: translateY(-200%);
    transition: transform var(--transition);
  }
  .skip-link:focus-visible {
    transform: translateY(0);
  }
</style>
