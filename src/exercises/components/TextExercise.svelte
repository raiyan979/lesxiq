<script lang="ts">
  import type { Session } from '../session.svelte';
  import type { TextView } from '../model';
  import AudioButton from '../../ui/AudioButton.svelte';

  interface Props {
    session: Session;
    view: TextView;
    disabled: boolean;
    /** Enter in the field triggers a check when allowed. */
    onEnter: () => void;
  }
  let { session, view, disabled, onEnter }: Props = $props();

  // Per-type framing: what to show above the input and what to ask for.
  const label = $derived(
    view.type === 'cloze'
      ? 'Fill in the blank:'
      : view.type === 'listening_dictation'
        ? 'Listen and type what you hear:'
        : view.direction === 'fr_en'
          ? 'Translate to English:'
          : 'Translate to French:',
  );
  const placeholder = $derived(
    view.type === 'cloze' ? 'missing word' : 'type your answer',
  );

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      onEnter();
    }
  }
</script>

<p class="prompt-label mono">{label}</p>

{#if view.type === 'listening_dictation'}
  {#if view.audioPath}
    <div class="listen">
      <AudioButton src={view.audioPath} size="lg" label="Play the sentence" />
    </div>
  {:else}
    <p class="audio-note mono">🔊 Audio unavailable — the sentence is shown below.</p>
    <p class="prompt fr">{view.answer}</p>
  {/if}
{:else}
  <p class="prompt" class:fr={view.type === 'cloze'}>{view.prompt}</p>
{/if}

<input
  class="answer"
  type="text"
  autocomplete="off"
  autocapitalize="off"
  spellcheck="false"
  {placeholder}
  {disabled}
  bind:value={session.text}
  onkeydown={onKey}
/>

<style>
  .prompt-label {
    color: var(--text-dim);
    font-size: 13px;
    margin-bottom: var(--space-2);
  }
  .prompt {
    font-size: var(--reading-size);
    margin-bottom: var(--space-5);
  }
  .prompt.fr {
    font-size: var(--french-display-size);
  }
  .audio-note {
    color: var(--warn);
    font-size: 13px;
    margin-bottom: var(--space-3);
  }
  .listen {
    display: flex;
    justify-content: center;
    margin-bottom: var(--space-5);
  }
  .answer {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    font-size: var(--french-display-size);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    transition: border-color var(--transition-fast);
  }
  .answer:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
</style>
