<script lang="ts">
  import { navigate } from '../ui/router.svelte';
  import { Review } from '../review/review.svelte';
  import { GRADES } from '../scheduler';
  import { playClip } from '../ui/audio';
  import AudioButton from '../ui/AudioButton.svelte';
  import Markdown from '../ui/Markdown.svelte';

  const review = new Review();
  void review.load();

  const item = $derived(review.current);

  const RATING_TONE: Record<string, string> = {
    Again: 'again',
    Hard: 'hard',
    Good: 'good',
    Easy: 'easy',
  };

  const KIND_LABEL: Record<string, string> = {
    vocab: 'Vocabulary',
    sentence: 'Sentence',
    grammar: 'Grammar',
  };

  function doReveal(): void {
    const item = review.current;
    review.reveal();
    // Hearing the answer is part of the review; autoplay the clip on flip.
    if (item?.audioPath) void playClip(item.audioPath);
  }

  function onKey(event: KeyboardEvent): void {
    if (review.phase === 'front' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      doReveal();
    } else if (review.phase === 'back') {
      const n = Number(event.key);
      if (n >= 1 && n <= 4) {
        event.preventDefault();
        void review.rate(GRADES[n - 1]!);
      }
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="review">
  {#if review.error}
    <div class="card note">{review.error}</div>
  {:else if review.phase === 'loading'}
    <div class="card note mono">Loading…</div>
  {:else if review.phase === 'empty'}
    <div class="card empty">
      <span class="big">✓</span>
      <h1>All caught up</h1>
      <p>No cards are due for review right now. Learn a new unit to add more.</p>
      <button type="button" class="btn primary" onclick={() => navigate('/learn')}>
        Go to Learn
      </button>
    </div>
  {:else if review.phase === 'done'}
    <div class="card done">
      <h1>Review complete</h1>
      <p class="score"><span class="big mono">{review.reviewed}</span> cards reviewed</p>
      <div class="actions">
        <button type="button" class="btn primary" onclick={() => review.load()}>Review more</button>
        <button type="button" class="btn" onclick={() => navigate('/')}>Dashboard</button>
      </div>
    </div>
  {:else if item}
    <div class="bar">
      <div class="track">
        <div class="fill" style:width="{(review.index / review.total) * 100}%"></div>
      </div>
      <span class="count mono">{review.index + 1} / {review.total}</span>
    </div>

    <div class="card flash">
      <span class="kind mono">{KIND_LABEL[item.kind]}</span>
      <p class="front">{item.front}</p>

      {#if review.phase === 'back'}
        <hr />
        {#if item.backIsMarkdown}
          <div class="back-md"><Markdown source={item.back} /></div>
        {:else}
          <p class="back fr">
            {item.back}
            {#if item.audioPath}<AudioButton src={item.audioPath} label="Replay" />{/if}
          </p>
          {#if item.ipa}<p class="ipa mono">/{item.ipa}/</p>{/if}
        {/if}
      {/if}
    </div>

    <footer class="footer">
      {#if review.phase === 'front'}
        <button type="button" class="btn primary show" onclick={doReveal}>
          Show answer <span class="hint mono">Space</span>
        </button>
      {:else}
        <div class="ratings">
          {#each review.preview as p, i (p.rating)}
            <button
              type="button"
              class="rating {RATING_TONE[p.label]}"
              onclick={() => review.rate(p.rating)}
            >
              <span class="rlabel">{p.label}</span>
              <span class="rint mono">{p.interval}</span>
              <span class="rkey mono">{i + 1}</span>
            </button>
          {/each}
        </div>
      {/if}
    </footer>
  {/if}
</section>

<style>
  .review {
    padding: var(--space-5) var(--space-6);
    max-width: var(--exercise-max-width);
    margin: 0 auto;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-6);
  }
  .note {
    color: var(--text-dim);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .track {
    flex: 1;
    height: 6px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--transition);
  }
  .count {
    color: var(--text-dim);
    font-size: 12px;
  }
  .flash {
    text-align: center;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
  }
  .kind {
    color: var(--text-dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .front {
    font-size: 22px;
    color: var(--text);
  }
  hr {
    width: 60%;
    margin: var(--space-3) auto;
    border: none;
    border-top: 1px solid var(--border);
  }
  .back {
    font-size: var(--french-display-size);
    font-weight: 600;
    color: var(--accent-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .ipa {
    color: var(--text-dim);
    font-size: 14px;
  }
  .back-md {
    text-align: left;
  }
  .footer {
    margin-top: var(--space-5);
  }
  .btn {
    padding: var(--space-3) var(--space-5);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }
  .btn:hover {
    border-color: var(--accent);
  }
  .btn.primary {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 600;
  }
  .show {
    display: block;
    width: 100%;
  }
  .show .hint {
    opacity: 0.7;
    font-size: 12px;
    margin-left: var(--space-2);
  }
  .ratings {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }
  .rating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-3) var(--space-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    cursor: pointer;
    color: var(--text);
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .rating:hover {
    transform: translateY(-1px);
    border-color: var(--accent);
  }
  .rating .rlabel {
    font-weight: 600;
    font-size: 14px;
  }
  .rating .rint {
    font-size: 12px;
    color: var(--text-dim);
  }
  .rating .rkey {
    font-size: 10px;
    color: var(--text-dim);
    opacity: 0.6;
  }
  .rating.again {
    border-top: 2px solid var(--error);
  }
  .rating.hard {
    border-top: 2px solid var(--warn);
  }
  .rating.good {
    border-top: 2px solid var(--accent);
  }
  .rating.easy {
    border-top: 2px solid var(--success);
  }
  .empty,
  .done {
    text-align: center;
  }
  .empty .big {
    font-size: 40px;
    color: var(--success);
    display: block;
    margin-bottom: var(--space-3);
  }
  .empty h1,
  .done h1 {
    font-size: 22px;
    margin-bottom: var(--space-2);
  }
  .empty p {
    color: var(--text-dim);
    margin-bottom: var(--space-5);
  }
  .done .score {
    color: var(--text-dim);
    margin: var(--space-3) 0 var(--space-5);
  }
  .done .big {
    font-size: 40px;
    color: var(--accent);
    font-weight: 700;
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
  }
</style>
