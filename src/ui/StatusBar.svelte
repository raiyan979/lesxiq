<script lang="ts">
  /*
   * Top status bar (§6): left = current view title, right = live status line.
   * Values come from the reactive `stats` store (app_state + review queue) and
   * refresh whenever progress changes. Format:
   *   streak 7d · due 42 · new 12/15 · 320 XP
   */
  import { stats } from './stats.svelte';

  interface Props {
    title: string;
  }
  let { title }: Props = $props();

  // Load the real figures once the shell mounts; grading refreshes them after.
  $effect(() => {
    void stats.refresh();
  });
</script>

<header class="statusbar">
  <div class="view-title">{title}</div>
  <div class="status mono" aria-label="Study status">
    <span>streak {stats.streakDays}d</span>
    <span class="sep">·</span>
    <span>due {stats.due}</span>
    <span class="sep">·</span>
    <span>new {stats.newDone}/{stats.newTarget}</span>
    <span class="sep">·</span>
    <span class="xp">{stats.xp} XP</span>
  </div>
</header>

<style>
  .statusbar {
    height: var(--statusbar-height);
    flex: 0 0 var(--statusbar-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-5);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .view-title {
    font-weight: 600;
    font-size: 15px;
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-dim);
  }
  /* Accent only on the values, sparingly (§7). */
  .status .xp {
    color: var(--accent-text);
  }
  .sep {
    opacity: 0.5;
  }
</style>
