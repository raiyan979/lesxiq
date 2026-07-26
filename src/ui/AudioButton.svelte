<script lang="ts">
  import { playClip } from './audio';

  interface Props {
    /** DB audio_path (e.g. "audio/xxx.mp3"), or null when no clip exists. */
    src: string | null;
    label?: string;
    /** 'sm' for inline (vocab rows), 'lg' for the dictation player. */
    size?: 'sm' | 'lg';
  }
  let { src, label = 'Play audio', size = 'sm' }: Props = $props();

  let busy = $state(false);

  async function play(event: MouseEvent): Promise<void> {
    // Don't trigger a parent card/button when the speaker is nested inside one.
    event.stopPropagation();
    event.preventDefault();
    busy = true;
    await playClip(src);
    busy = false;
  }
</script>

{#if src}
  <button
    type="button"
    class="audio {size}"
    class:busy
    onclick={play}
    aria-label={label}
    title={label}
  >
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"
      />
    </svg>
  </button>
{/if}

<style>
  .audio {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-text);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-button);
    cursor: pointer;
    padding: 4px;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .audio:hover {
    background: var(--surface-2);
  }
  .audio.sm {
    font-size: 15px;
  }
  .audio.lg {
    font-size: 40px;
    border-color: var(--border);
    background: var(--surface-2);
    padding: var(--space-4);
    border-radius: 50%;
  }
  .audio.lg:hover {
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
  .audio.busy {
    opacity: 0.6;
  }
</style>
