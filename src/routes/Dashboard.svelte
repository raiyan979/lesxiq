<script lang="ts">
  import { navigate } from '../ui/router.svelte';
  import { getDashboardData, type DashboardData } from '../db/queries';

  let data = $state<DashboardData | null>(null);
  let error = $state<string | null>(null);

  void getDashboardData()
    .then((d) => (data = d))
    .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Failed to load dashboard.'));

  // Greeting keyed off the local hour — small touch, no locale libs needed.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const CONTINUE_LABEL: Record<string, string> = {
    available: 'Start',
    in_progress: 'Continue',
  };

  function startReview(): void {
    navigate('/review');
  }
</script>

<section class="view">
  <header class="head">
    <h1>{greeting} 👋</h1>
    <p class="sub">Here's where you left off.</p>
  </header>

  {#if error}
    <p class="note">{error}</p>
  {:else if data === null}
    <p class="note mono">Loading…</p>
  {:else}
    {@const s = data.status}
    {@const caughtUp = s.due === 0 && s.newDone >= s.newTarget}

    <div class="hero">
      <!-- Review CTA -->
      <div class="card review-card">
        <span class="eyebrow mono">Today's review</span>
        {#if caughtUp}
          <p class="big-line"><span class="big">✓</span> All caught up</p>
          <p class="hero-note">No cards due and today's new-card goal is met.</p>
          <button type="button" class="btn" onclick={startReview}>Review anyway</button>
        {:else}
          <p class="big-line">
            <span class="big mono">{s.due}</span>
            <span class="big-unit">{s.due === 1 ? 'card due' : 'cards due'}</span>
          </p>
          <p class="hero-note">New today: {s.newDone} / {s.newTarget}</p>
          <button type="button" class="btn primary" onclick={startReview}>Start Review →</button>
        {/if}
      </div>

      <!-- Continue learning -->
      <div class="card continue-card">
        <span class="eyebrow mono">Continue learning</span>
        {#if data.continueUnit}
          {@const u = data.continueUnit}
          <p class="unit-title">{u.title_en}</p>
          <p class="unit-fr">{u.title_fr}</p>
          <p class="hero-note mono">{u.grammar_focus} · {u.exercise_count} exercises</p>
          <button type="button" class="btn primary" onclick={() => navigate(`/learn/${u.id}`)}>
            {CONTINUE_LABEL[u.status] ?? 'Open'} →
          </button>
        {:else}
          <p class="big-line"><span class="big">🎉</span></p>
          <p class="hero-note">Every unit is complete. Keep your reviews sharp!</p>
          <button type="button" class="btn" onclick={() => navigate('/learn')}>Browse units</button>
        {/if}
      </div>
    </div>

    <!-- Stats strip -->
    <div class="stats">
      <div class="stat">
        <span class="stat-num mono">{s.streakDays}</span>
        <span class="stat-label">day streak</span>
        <span class="stat-sub mono">best {data.totals.longestStreak}</span>
      </div>
      <div class="stat">
        <span class="stat-num mono">{s.xp}</span>
        <span class="stat-label">XP</span>
      </div>
      <div class="stat">
        <span class="stat-num mono">{data.totals.reviews}</span>
        <span class="stat-label">reviews</span>
      </div>
      <div class="stat">
        <span class="stat-num mono">{data.totals.wordsLearned}</span>
        <span class="stat-label">words learned</span>
      </div>
      <div class="stat">
        <span class="stat-num mono">{data.unitsCompleted} / {data.unitsTotal}</span>
        <span class="stat-label">units done</span>
      </div>
    </div>
  {/if}
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .head {
    margin-bottom: var(--space-6);
  }
  h1 {
    font-size: 28px;
    margin-bottom: var(--space-2);
  }
  .sub {
    color: var(--text-dim);
  }
  .note {
    color: var(--text-dim);
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .hero {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .eyebrow {
    color: var(--text-dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .big-line {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .big {
    font-size: 40px;
    font-weight: 700;
    color: var(--accent-text);
    line-height: 1.1;
  }
  .big-unit {
    color: var(--text-dim);
    font-size: var(--reading-size);
  }
  .hero-note {
    color: var(--text-dim);
    font-size: 14px;
  }
  .unit-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin-top: var(--space-1);
  }
  .unit-fr {
    color: var(--text-dim);
    font-size: 14px;
  }
  .btn {
    margin-top: var(--space-3);
    align-self: flex-start;
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
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-3);
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
    align-items: center;
  }
  .stat-num {
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
  }
  .stat-label {
    color: var(--text-dim);
    font-size: 12px;
  }
  .stat-sub {
    color: var(--text-dim);
    font-size: 11px;
    opacity: 0.8;
  }
</style>
