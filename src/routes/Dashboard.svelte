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

  // Circle geometry for the progress ring (r = 16 → circumference ≈ 100.53).
  const RING_R = 16;
  const RING_C = 2 * Math.PI * RING_R;
  function ringOffset(pct: number): number {
    return RING_C * (1 - pct / 100);
  }
</script>

<section class="view">
  {#if error}
    <p class="note">{error}</p>
  {:else if data === null}
    <p class="note mono">Loading…</p>
  {:else}
    {@const s = data.status}
    {@const caughtUp = s.due === 0 && s.newDone >= s.newTarget}

    <header class="head">
      <div class="greeting"><h1>{greeting}</h1><span class="wave">👋</span></div>
      <p class="sub">Here's where you left off.</p>
    </header>

    <div class="hero">
      <!-- Today's review -->
      <div class="card hero-card strip-teal">
        <span class="eyebrow mono teal">Today's review</span>
        <div class="hero-main">
          <span class="chip chip-teal" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
              ><rect x="5" y="3" width="10" height="14" rx="2" stroke="currentColor" stroke-width="1.6" /><circle
                cx="10"
                cy="9"
                r="1.4"
                fill="currentColor"
              /></svg
            >
          </span>
          <span class="hero-figure">
            {#if caughtUp}All caught up{:else}{s.due} {s.due === 1 ? 'card due' : 'cards due'}{/if}
          </span>
        </div>
        <p class="hero-note">New today: {s.newDone} / {s.newTarget}</p>
        <button type="button" class="btn btn-teal" onclick={() => navigate('/review')}>
          {caughtUp ? 'Review anyway' : 'Start Journey'} <span aria-hidden="true">→</span>
        </button>
      </div>

      <!-- Continue learning -->
      <div class="card hero-card strip-amber">
        {#if data.continueUnit}
          {@const u = data.continueUnit}
          <div class="continue-head">
            <span class="eyebrow mono amber">Continue learning</span>
            <svg class="ring" width="40" height="40" viewBox="0 0 40 40" aria-label="{data.continueProgress}% complete">
              <circle cx="20" cy="20" r={RING_R} fill="none" stroke="var(--border)" stroke-width="4" />
              <circle
                cx="20"
                cy="20"
                r={RING_R}
                fill="none"
                stroke="var(--accent-2)"
                stroke-width="4"
                stroke-linecap="round"
                stroke-dasharray={RING_C}
                stroke-dashoffset={ringOffset(data.continueProgress)}
                transform="rotate(-90 20 20)"
              />
              <text x="20" y="24" text-anchor="middle" class="ring-text mono">{data.continueProgress}%</text>
            </svg>
          </div>
          <p class="unit-chapter mono">Module {u.level} · Chapter {u.order_index + 1}</p>
          <h2 class="unit-title">{u.title_en}</h2>
          <p class="unit-fr">{u.title_fr}</p>
          <p class="unit-meta">{u.grammar_focus} · {u.exercise_count} exercises</p>
          <button type="button" class="btn btn-amber" onclick={() => navigate(`/learn/${u.id}`)}>
            {CONTINUE_LABEL[u.status] ?? 'Open'} <span aria-hidden="true">→</span>
          </button>
        {:else}
          <span class="eyebrow mono amber">Continue learning</span>
          <div class="hero-main"><span class="hero-figure">🎉 All units complete</span></div>
          <p class="hero-note">Keep your reviews sharp to hold onto what you've learned.</p>
          <button type="button" class="btn btn-amber" onclick={() => navigate('/learn')}>
            Browse units <span aria-hidden="true">→</span>
          </button>
        {/if}
      </div>
    </div>

    <!-- Stat tiles -->
    <div class="stats">
      <div class="stat">
        <span class="chip chip-amber" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
            ><path
              d="M9 2C9 2 5 6 5 10a4 4 0 0 0 8 0c0-1.2-.5-2-1-2.6.1 1-.4 1.6-1 1.6-.8 0-1-1-1-2C10 5 9 3.5 9 2Z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="stat-num mono">{s.streakDays}</span>
        <span class="stat-label">Day streak</span>
      </div>
      <div class="stat">
        <span class="chip chip-teal" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
            ><path
              d="M9 2L11 7H16L12 10.5L13.5 16L9 12.5L4.5 16L6 10.5L2 7H7L9 2Z"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="stat-num mono">{s.xp}</span>
        <span class="stat-label">XP</span>
      </div>
      <div class="stat">
        <span class="chip chip-teal" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
            ><path
              d="M3 4.5C3 3.7 3.7 3 4.5 3H13.5C14.3 3 15 3.7 15 4.5V11.5C15 12.3 14.3 13 13.5 13H7L4 15.5V13H4.5C3.7 13 3 12.3 3 11.5V4.5Z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="stat-num mono">{data.totals.wordsLearned}</span>
        <span class="stat-label">Words learned</span>
      </div>
      <div class="stat">
        <span class="chip chip-amber" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"
            ><path d="M9 2L16 5.5L9 9L2 5.5L9 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><path
              d="M2 12.5L9 16L16 12.5M2 9L9 12.5L16 9"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="stat-num mono">{data.unitsCompleted}/{data.unitsTotal}</span>
        <span class="stat-label">Units done</span>
      </div>
    </div>
  {/if}
</section>

<style>
  .view {
    padding: var(--space-6) var(--space-8);
    max-width: 940px;
    margin: 0 auto;
  }
  .note {
    color: var(--text-dim);
  }

  /* Header */
  .head {
    margin-bottom: var(--space-6);
  }
  .greeting {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-1);
  }
  h1 {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .wave {
    font-size: 30px;
  }
  .sub {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-dim);
  }

  /* Cards */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    box-shadow: var(--card-shadow);
  }
  .hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  .hero-card {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-card-lg);
    padding: 26px;
  }
  /* Colored top strip */
  .hero-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
  }
  .strip-teal::before {
    background: var(--accent);
  }
  .strip-amber::before {
    background: var(--accent-2);
  }

  .eyebrow {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .eyebrow.teal {
    color: var(--accent-text);
  }
  .eyebrow.amber {
    color: var(--accent-2-text);
  }

  .hero-main {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .hero-figure {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
  }
  .hero-note {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-dim);
    margin-bottom: 22px;
  }

  /* Icon chips */
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .chip-teal {
    color: var(--accent-text);
    background: var(--accent-bg);
  }
  .chip-amber {
    color: var(--accent-2-text);
    background: var(--accent-2-bg);
  }
  .hero-main .chip {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  /* Continue card */
  .continue-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .continue-head .eyebrow {
    margin-top: 2px;
  }
  .ring {
    flex: none;
  }
  .ring-text {
    font-size: 10px;
    font-weight: 700;
    fill: var(--text);
  }
  .unit-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 2px;
  }
  .unit-fr {
    font-size: 14.5px;
    font-weight: 500;
    color: var(--text-dim);
    margin-bottom: 12px;
  }
  .unit-meta {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 22px;
    line-height: 1.5;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    padding: 12px 20px;
    border: none;
    border-radius: var(--radius-button);
    color: var(--on-accent);
    cursor: pointer;
    transition: filter var(--transition-fast);
  }
  .btn:hover {
    filter: brightness(1.06);
  }
  .btn-teal {
    background: var(--accent);
  }
  .btn-amber {
    background: var(--accent-2);
    color: var(--on-accent-2);
  }
  .unit-chapter {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--accent-2-text);
    margin-bottom: 4px;
  }

  /* Stat tiles */
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: 20px;
  }
  .stat .chip {
    width: 32px;
    height: 32px;
    border-radius: 9px;
  }
  .stat-num {
    font-size: 26px;
    font-weight: 700;
    color: var(--text);
  }
  .stat-label {
    font-size: 12.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  /* Responsive: stack heroes and wrap tiles on narrow windows */
  @media (max-width: 720px) {
    .hero {
      grid-template-columns: 1fr;
    }
    .stats {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
