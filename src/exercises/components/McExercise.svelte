<script lang="ts">
  import type { Session } from '../session.svelte';
  import type { McView } from '../model';
  import { normalizeText } from '../graders';

  interface Props {
    session: Session;
    view: McView;
    disabled: boolean;
  }
  let { session, view, disabled }: Props = $props();

  function optionClass(option: string): string {
    if (!disabled) return session.mcChoice === option ? 'selected' : '';
    // After checking: mark the correct one, and a wrong pick.
    if (normalizeText(option) === normalizeText(view.answer)) return 'correct';
    if (session.mcChoice === option) return 'wrong';
    return 'muted';
  }
</script>

<p class="prompt-label mono">Choose the French for:</p>
<p class="prompt">{view.prompt}</p>

<div class="options">
  {#each view.options as option (option)}
    <button
      type="button"
      class="option {optionClass(option)}"
      {disabled}
      onclick={() => (session.mcChoice = option)}
    >
      {option}
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
    font-size: var(--french-display-size);
    margin-bottom: var(--space-5);
  }
  .options {
    display: grid;
    gap: var(--space-3);
  }
  .option {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }
  .option:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .option.selected {
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
  .option.correct {
    border-color: var(--success);
    color: var(--success);
  }
  .option.wrong {
    border-color: var(--error);
    color: var(--error);
  }
  .option.muted {
    opacity: 0.55;
  }
  .option:disabled {
    cursor: default;
  }
</style>
