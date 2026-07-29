<script lang="ts">
  /*
   * First-launch chooser. Lets the user pick a wording register (adult vs child)
   * once; the choice is stored and this never shows again. Adult is the default,
   * and it can be changed later in Settings.
   */
  import { audience, type Audience } from './audience.svelte';
  import Mascot from './Mascot.svelte';
  import { APP_NAME } from '../config/constants';

  const OPTIONS: { value: Audience; title: string; blurb: string }[] = [
    { value: 'adult', title: "I'm 12 or older", blurb: 'Full grammar terms and chapter names.' },
    { value: 'child', title: "I'm under 12", blurb: 'Simpler names for each chapter.' },
  ];

  function pick(value: Audience): void {
    audience.choose(value);
  }
</script>

<main class="onboard">
  <div class="inner">
    <Mascot size={72} title="Lexiq mascot" />
    <h1 class="title">Welcome to {APP_NAME}</h1>
    <p class="lead">Who's learning French today?</p>

    <div class="options">
      {#each OPTIONS as opt (opt.value)}
        <button type="button" class="option" class:recommended={opt.value === 'adult'} onclick={() => pick(opt.value)}>
          <span class="opt-title">{opt.title}</span>
          <span class="opt-blurb">{opt.blurb}</span>
        </button>
      {/each}
    </div>

    <p class="foot">You can change this anytime in Settings.</p>
  </div>
</main>

<style>
  .onboard {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
    background: var(--bg);
  }
  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 440px;
    width: 100%;
  }
  .title {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--text);
    margin: var(--space-4) 0 var(--space-2);
  }
  .lead {
    color: var(--text-dim);
    font-size: 16px;
    margin-bottom: var(--space-6);
  }
  .options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    width: 100%;
  }
  .option {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-4);
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      transform var(--transition-fast);
  }
  .option:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .option.recommended {
    border-color: var(--accent-dim);
  }
  .opt-title {
    font-weight: 700;
    font-size: var(--reading-size);
    color: var(--text);
  }
  .opt-blurb {
    font-size: 13px;
    color: var(--text-dim);
    line-height: 1.4;
  }
  .foot {
    margin-top: var(--space-6);
    font-size: 13px;
    color: var(--text-muted);
  }
  @media (max-width: 420px) {
    .options {
      grid-template-columns: 1fr;
    }
  }
</style>
