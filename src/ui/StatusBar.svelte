<script lang="ts">
  /*
   * Top status bar (§6): left = current view title, right = live status line.
   * The status values are placeholders in Phase 1 (no DB yet) and get wired to
   * app_state / the review queue in Phase 6. Format is fixed here:
   *   streak 7d · due 42 · new 12/15 · 320 XP
   */
  interface Props {
    title: string;
  }
  let { title }: Props = $props();

  // TODO(phase6): replace with reactive values from app_state + scheduler.
  const status = {
    streakDays: 0,
    due: 0,
    newDone: 0,
    newTarget: 15,
    xp: 0,
  };
</script>

<header class="statusbar">
  <div class="view-title">{title}</div>
  <div class="status mono" aria-label="Study status">
    <span>streak {status.streakDays}d</span>
    <span class="sep">·</span>
    <span>due {status.due}</span>
    <span class="sep">·</span>
    <span>new {status.newDone}/{status.newTarget}</span>
    <span class="sep">·</span>
    <span class="xp">{status.xp} XP</span>
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
