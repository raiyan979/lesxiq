<script lang="ts">
  import type { Session } from '../session.svelte';
  import type { WordOrderView } from '../model';

  interface Props {
    session: Session;
    view: WordOrderView;
    disabled: boolean;
  }
  let { session, view, disabled }: Props = $props();

  // Bank chips still available (not yet placed).
  const available = $derived(
    view.bank.map((word, i) => ({ word, i })).filter((b) => !session.tokens.includes(b.i)),
  );
</script>

<p class="prompt-label mono">Arrange the words to translate:</p>
<p class="prompt">{view.prompt}</p>

<div class="assembled" class:empty={session.tokens.length === 0}>
  {#if session.tokens.length === 0}
    <span class="hint mono">Tap words below to build the sentence</span>
  {:else}
    {#each session.tokens as bankIndex, slot (slot)}
      <button
        type="button"
        class="chip placed"
        {disabled}
        onclick={() => session.removeToken(slot)}
      >
        {view.bank[bankIndex]}
      </button>
    {/each}
  {/if}
</div>

<div class="bank">
  {#each available as chip (chip.i)}
    <button type="button" class="chip" {disabled} onclick={() => session.addToken(chip.i)}>
      {chip.word}
    </button>
  {/each}
</div>

<style>
  .prompt-label {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-2);
  }
  .prompt {
    font-size: var(--reading-size);
    margin-bottom: var(--space-4);
  }
  .assembled {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-height: 52px;
    padding: var(--space-3);
    margin-bottom: var(--space-4);
    background: var(--surface-2);
    border: 1px dashed var(--border);
    border-radius: var(--radius-input);
    align-items: center;
  }
  .hint {
    color: var(--text-dim);
    font-size: 13px;
  }
  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chip {
    padding: var(--space-2) var(--space-3);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }
  .chip:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .chip.placed {
    background: var(--surface-2);
    border-color: var(--accent-dim);
  }
  .chip:disabled {
    cursor: default;
  }
</style>
