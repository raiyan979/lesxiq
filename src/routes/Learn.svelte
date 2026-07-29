<script lang="ts">
  import { navigate } from '../ui/router.svelte';
  import { getUnits, type UnitWithProgress } from '../db/queries';
  import type { Level } from '../db/types';
  import { audience } from '../ui/audience.svelte';
  import { unitTitle, copy, type CopyKey } from '../ui/audience-copy';

  let units = $state<UnitWithProgress[] | null>(null);
  let error = $state<string | null>(null);

  void getUnits()
    .then((u) => (units = u))
    .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Failed to load units.'));

  const LEVELS: Level[] = ['A1', 'A2', 'B1'];
  const LEVEL_CAPTION: Record<Level, CopyKey> = {
    A1: 'levelA1',
    A2: 'levelA2',
    B1: 'levelB1',
  };

  function unitsFor(level: Level): UnitWithProgress[] {
    return (units ?? []).filter((u) => u.level === level);
  }

  function isOpen(u: UnitWithProgress): boolean {
    return u.status !== 'locked';
  }

  const STATUS_LABEL: Record<string, string> = {
    locked: 'Locked',
    available: 'Start',
    in_progress: 'Continue',
    completed: 'Review',
  };

  function open(u: UnitWithProgress): void {
    if (isOpen(u)) navigate(`/learn/${u.id}`);
  }
</script>

<section class="view">
  <h1>{copy(audience.current, 'learnHeading')}</h1>
  <p class="sub">{copy(audience.current, 'learnSub')}</p>

  {#if error}
    <p class="note">{error}</p>
  {:else if units === null}
    <p class="note mono">Loading…</p>
  {:else if units.length === 0}
    <p class="note">No units found in the database.</p>
  {:else}
    {#each LEVELS as level (level)}
      {@const list = unitsFor(level)}
      {#if list.length > 0}
        <div class="level-head">
          <span class="level-badge mono">Module {level}</span>
          <span class="level-caption">{copy(audience.current, LEVEL_CAPTION[level])}</span>
        </div>
        <div class="grid">
          {#each list as u (u.id)}
            <button
              type="button"
              class="unit"
              class:locked={!isOpen(u)}
              disabled={!isOpen(u)}
              onclick={() => open(u)}
            >
              <span class="unit-top">
                <span class="unit-chapter mono">Chapter {u.order_index + 1}</span>
                <span class="status {u.status} mono">{STATUS_LABEL[u.status]}</span>
              </span>
              <span class="unit-title">{unitTitle(audience.current, u.slug, u.title_en)}</span>
              <span class="unit-fr">{u.title_fr}</span>
              <span class="unit-meta mono">{u.grammar_focus} · {u.exercise_count} exercises</span>
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  h1 {
    font-size: 28px;
    margin-bottom: var(--space-2);
  }
  .sub {
    color: var(--text-dim);
    margin-bottom: var(--space-6);
  }
  .note {
    color: var(--text-dim);
  }
  .level-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: var(--space-5) 0 var(--space-3);
  }
  .level-badge {
    font-weight: 700;
    color: var(--accent-text);
    font-size: 14px;
  }
  .level-caption {
    color: var(--text-dim);
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-3);
  }
  .unit {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
    padding: var(--space-4);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    cursor: pointer;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .unit:hover:not(:disabled) {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .unit.locked {
    cursor: default;
    background: var(--surface);
    border-style: dashed;
  }
  .unit.locked .unit-title,
  .unit.locked .unit-fr {
    color: var(--text-dim);
  }
  .unit-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }
  .unit-chapter {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent-text);
  }
  .unit.locked .unit-chapter {
    color: var(--text-muted);
  }
  .unit-title {
    font-weight: 600;
    font-size: var(--reading-size);
  }
  .unit-fr {
    color: var(--text-dim);
    font-size: 14px;
  }
  .unit-meta {
    color: var(--text-dim);
    font-size: 11px;
  }
  .status {
    font-size: 11px;
    padding: 2px var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--border);
    white-space: nowrap;
  }
  .status.available,
  .status.in_progress {
    color: var(--accent-text);
    border-color: var(--accent-dim);
  }
  .status.completed {
    color: var(--success);
    border-color: var(--success);
  }
  .status.locked {
    color: var(--text-dim);
  }
</style>
