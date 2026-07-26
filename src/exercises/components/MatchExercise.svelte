<script lang="ts">
  import type { Session } from '../session.svelte';
  import type { MatchView } from '../model';
  import { normalizeText } from '../graders';

  interface Props {
    session: Session;
    view: MatchView;
    disabled: boolean;
  }
  let { session, view, disabled }: Props = $props();

  function expectedEn(fr: string): string {
    return view.pairs.find((p) => p.fr === fr)?.en ?? '';
  }
  function rowClass(fr: string): string {
    if (!disabled) return '';
    const chosen = session.mapping[fr];
    if (chosen === undefined) return 'wrong';
    return normalizeText(chosen) === normalizeText(expectedEn(fr)) ? 'correct' : 'wrong';
  }
</script>

<p class="prompt-label mono">{view.prompt}</p>

<div class="rows">
  {#each view.leftFr as fr (fr)}
    <div class="row {rowClass(fr)}">
      <span class="fr">{fr}</span>
      <select class="pick" {disabled} bind:value={session.mapping[fr]}>
        <option value={undefined} disabled selected>— choose —</option>
        {#each view.rightEn as en (en)}
          <option value={en}>{en}</option>
        {/each}
      </select>
    </div>
  {/each}
</div>

<style>
  .prompt-label {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-4);
  }
  .rows {
    display: grid;
    gap: var(--space-3);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    background: var(--surface-2);
  }
  .row.correct {
    border-color: var(--success);
  }
  .row.wrong {
    border-color: var(--error);
  }
  .fr {
    font-size: var(--reading-size);
    font-weight: 600;
  }
  .pick {
    padding: var(--space-2) var(--space-3);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    cursor: pointer;
  }
  .pick:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
  .pick:disabled {
    cursor: default;
  }
</style>
