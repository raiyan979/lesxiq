<script lang="ts">
  import {
    getLibraryVocab,
    searchLibrarySentences,
    type LibraryVocabItem,
    type LibrarySentenceItem,
    type Mastery,
  } from '../db/queries';
  import AudioButton from '../ui/AudioButton.svelte';

  type Mode = 'vocab' | 'sentences';
  type LevelFilter = 'all' | 'A1' | 'A2';

  let mode = $state<Mode>('vocab');
  let query = $state('');
  let levelFilter = $state<LevelFilter>('all');

  let vocab = $state<LibraryVocabItem[]>([]);
  let vocabLoaded = $state(false);
  let sentences = $state<LibrarySentenceItem[]>([]);
  let sentenceLoading = $state(false);
  let error = $state<string | null>(null);

  // Vocab is small (~400 rows): load once, filter in the browser.
  void getLibraryVocab()
    .then((v) => {
      vocab = v;
      vocabLoaded = true;
    })
    .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Library unavailable.'));

  // Accent-insensitive contains, for client-side vocab search.
  function norm(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  const filteredVocab = $derived.by(() => {
    const nq = norm(query.trim());
    return vocab.filter((v) => {
      if (levelFilter !== 'all' && v.level !== levelFilter) return false;
      if (nq === '') return true;
      return norm(v.fr).includes(nq) || norm(v.en).includes(nq) || (v.ipa ? norm(v.ipa).includes(nq) : false);
    });
  });

  // Sentences: pool is ~30k, so search is a capped DB query (debounced).
  let debounce: ReturnType<typeof setTimeout> | undefined;

  function runSentenceSearch(): void {
    sentenceLoading = true;
    searchLibrarySentences(query)
      .then((r) => (sentences = r))
      .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Search failed.'))
      .finally(() => (sentenceLoading = false));
  }

  function onInput(): void {
    if (mode === 'sentences') {
      clearTimeout(debounce);
      debounce = setTimeout(runSentenceSearch, 220);
    }
  }

  function setMode(m: Mode): void {
    mode = m;
    if (m === 'sentences' && sentences.length === 0 && !sentenceLoading) runSentenceSearch();
  }

  const MASTERY_LABEL: Record<Mastery, string> = {
    new: 'New',
    learning: 'Learning',
    known: 'Known',
  };
  const GENDER_ARTICLE: Record<string, string> = { m: 'le', f: 'la', na: '' };
</script>

<section class="view">
  <h1>Library</h1>
  <p class="sub">Browse and search every word and sentence in the course.</p>

  <div class="controls">
    <div class="seg">
      <button type="button" class="seg-btn" class:active={mode === 'vocab'} onclick={() => setMode('vocab')}>
        Vocabulary
      </button>
      <button type="button" class="seg-btn" class:active={mode === 'sentences'} onclick={() => setMode('sentences')}>
        Sentences
      </button>
    </div>
    <input
      class="search"
      type="search"
      placeholder={mode === 'vocab' ? 'Search words (French or English)…' : 'Search sentences…'}
      bind:value={query}
      oninput={onInput}
    />
  </div>

  {#if mode === 'vocab'}
    <div class="chips">
      {#each ['all', 'A1', 'A2'] as lv (lv)}
        <button type="button" class="chip" class:active={levelFilter === lv} onclick={() => (levelFilter = lv as LevelFilter)}>
          {lv === 'all' ? 'All levels' : lv}
        </button>
      {/each}
    </div>
  {/if}

  {#if error}
    <p class="note">{error}</p>
  {:else if mode === 'vocab'}
    {#if !vocabLoaded}
      <p class="note mono">Loading…</p>
    {:else}
      <p class="count mono">{filteredVocab.length} word{filteredVocab.length === 1 ? '' : 's'}</p>
      <ul class="list">
        {#each filteredVocab as v (v.id)}
          <li class="row">
            <div class="main">
              <span class="fr gender-{v.gender}">
                {#if GENDER_ARTICLE[v.gender]}<span class="art">{GENDER_ARTICLE[v.gender]}</span>{/if}
                {v.fr}
              </span>
              {#if v.audioPath}<AudioButton src={v.audioPath} label="Play" />{/if}
              {#if v.ipa}<span class="ipa mono">/{v.ipa}/</span>{/if}
            </div>
            <div class="meta">
              <span class="en">{v.en}</span>
              <span class="badge {v.mastery}">{MASTERY_LABEL[v.mastery]}</span>
            </div>
          </li>
        {:else}
          <li class="empty">No words match “{query}”.</li>
        {/each}
      </ul>
    {/if}
  {:else}
    {#if sentenceLoading}
      <p class="note mono">Searching…</p>
    {:else}
      <p class="count mono">
        {sentences.length} result{sentences.length === 1 ? '' : 's'}{query.trim() === '' ? ' · course sentences' : ''}
      </p>
      <ul class="list">
        {#each sentences as s (s.id)}
          <li class="row sentence">
            <div class="main">
              <span class="fr">{s.fr}</span>
              {#if s.audioPath}<AudioButton src={s.audioPath} label="Play" />{/if}
            </div>
            <div class="meta">
              <span class="en">{s.en}</span>
              {#if s.mastery}<span class="badge {s.mastery}">{MASTERY_LABEL[s.mastery]}</span>{/if}
            </div>
          </li>
        {:else}
          <li class="empty">No sentences match “{query}”.</li>
        {/each}
      </ul>
    {/if}
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
    margin-bottom: var(--space-5);
  }
  .note {
    color: var(--text-dim);
  }
  .controls {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .seg {
    display: inline-flex;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    padding: 2px;
    flex-shrink: 0;
  }
  .seg-btn {
    padding: var(--space-2) var(--space-4);
    font-size: 14px;
    color: var(--text-dim);
    background: transparent;
    border: none;
    border-radius: calc(var(--radius-button) - 2px);
    cursor: pointer;
    transition: color var(--transition-fast), background var(--transition-fast);
  }
  .seg-btn.active {
    color: var(--on-accent);
    background: var(--accent);
    font-weight: 600;
  }
  .search {
    flex: 1;
    min-width: 200px;
    padding: var(--space-3) var(--space-4);
    font-size: var(--reading-size);
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
  }
  .search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .chips {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .chip {
    padding: var(--space-1) var(--space-3);
    font-size: 13px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    transition: color var(--transition-fast), border-color var(--transition-fast);
  }
  .chip.active {
    color: var(--accent-text);
    border-color: var(--accent-dim);
  }
  .count {
    color: var(--text-dim);
    font-size: 12px;
    margin-bottom: var(--space-3);
  }
  .list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--surface);
  }
  .row.sentence {
    align-items: flex-start;
  }
  .main {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    flex-wrap: wrap;
  }
  .fr {
    font-weight: 600;
    color: var(--text);
    font-size: var(--reading-size);
  }
  .fr .art {
    color: var(--text-dim);
    font-weight: 400;
    margin-right: 2px;
  }
  .gender-m {
    color: var(--gender-m, var(--text));
  }
  .gender-f {
    color: var(--gender-f, var(--text));
  }
  .ipa {
    color: var(--text-dim);
    font-size: 13px;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }
  .en {
    color: var(--text-dim);
    font-size: 14px;
    text-align: right;
  }
  .badge {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--border);
    white-space: nowrap;
  }
  .badge.new {
    color: var(--text-dim);
  }
  .badge.learning {
    color: var(--warn);
    border-color: var(--warn);
  }
  .badge.known {
    color: var(--success);
    border-color: var(--success);
  }
  .empty {
    padding: var(--space-5);
    text-align: center;
    color: var(--text-dim);
    background: var(--surface);
  }
</style>
