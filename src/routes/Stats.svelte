<script lang="ts">
  import { getStatsData, type StatsData, type DayCount } from '../db/queries';

  let data = $state<StatsData | null>(null);
  let error = $state<string | null>(null);

  void getStatsData()
    .then((d) => (data = d))
    .catch((e: unknown) => (error = e instanceof Error ? e.message : 'Failed to load stats.'));

  // Bar-chart geometry (SVG user units; the viewBox scales to fit the card).
  const CW = 336;
  const CH = 120;
  const PLOT = CH - 22; // leave room for the day labels along the bottom

  function bars(series: DayCount[]): {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    count: number;
  }[] {
    const max = Math.max(1, ...series.map((d) => d.count));
    const slot = CW / series.length;
    const w = slot * 0.62;
    return series.map((d, i) => {
      const h = (d.count / max) * PLOT;
      return {
        x: i * slot + (slot - w) / 2,
        y: PLOT - h,
        w,
        h,
        // Day-of-month, parsed from YYYY-MM-DD without a Date (avoids TZ shifts).
        label: d.date.slice(8),
        count: d.count,
      };
    });
  }

  const reviewBars = $derived(data ? bars(data.reviewsByDay) : []);
  const forecastBars = $derived(data ? bars(data.forecast) : []);

  const STATE_META: { key: keyof StatsData['cardStates']; label: string; color: string }[] = [
    { key: 'new', label: 'New', color: 'var(--text-dim)' },
    { key: 'learning', label: 'Learning', color: 'var(--warn)' },
    { key: 'review', label: 'Review', color: 'var(--accent)' },
    { key: 'relearning', label: 'Relearning', color: 'var(--error)' },
  ];

  const stateTotal = $derived(
    data ? STATE_META.reduce((s, m) => s + data!.cardStates[m.key], 0) : 0,
  );
</script>

<section class="view">
  <h1>Stats</h1>
  <p class="sub">Your review history, retention, and what's coming up.</p>

  {#if error}
    <p class="note">{error}</p>
  {:else if data === null}
    <p class="note mono">Loading…</p>
  {:else}
    <!-- KPI row -->
    <div class="kpis">
      <div class="kpi">
        <span class="kpi-num mono">{data.retentionPct === null ? '—' : `${data.retentionPct}%`}</span>
        <span class="kpi-label">retention</span>
      </div>
      <div class="kpi">
        <span class="kpi-num mono">{data.totalReviews}</span>
        <span class="kpi-label">total reviews</span>
      </div>
      <div class="kpi">
        <span class="kpi-num mono">{stateTotal}</span>
        <span class="kpi-label">cards tracked</span>
      </div>
      <div class="kpi">
        <span class="kpi-num mono">{data.forecast[0]?.count ?? 0}</span>
        <span class="kpi-label">due today</span>
      </div>
    </div>

    <!-- Reviews per day -->
    <div class="card">
      <h2>Reviews · last 14 days</h2>
      {#if data.totalReviews === 0}
        <p class="empty">No reviews logged yet — start a review session to build history.</p>
      {:else}
        <svg class="chart" viewBox="0 0 {CW} {CH}" preserveAspectRatio="none" role="img"
          aria-label="Reviews completed per day over the last 14 days">
          {#each reviewBars as b (b.x)}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill="var(--accent)">
              <title>{b.count} on the {b.label}</title>
            </rect>
            <text x={b.x + b.w / 2} y={CH - 6} class="axis" text-anchor="middle">{b.label}</text>
          {/each}
        </svg>
      {/if}
    </div>

    <!-- Forecast -->
    <div class="card">
      <h2>Forecast · next 14 days</h2>
      <svg class="chart" viewBox="0 0 {CW} {CH}" preserveAspectRatio="none" role="img"
        aria-label="Cards coming due over the next 14 days">
        {#each forecastBars as b (b.x)}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill="var(--accent-dim)">
            <title>{b.count} due on the {b.label}</title>
          </rect>
          <text x={b.x + b.w / 2} y={CH - 6} class="axis" text-anchor="middle">{b.label}</text>
        {/each}
      </svg>
      <p class="caption">Day 1 includes anything overdue.</p>
    </div>

    <!-- Card-state mix -->
    <div class="card">
      <h2>Card mix</h2>
      {#if stateTotal === 0}
        <p class="empty">No cards yet.</p>
      {:else}
        <div class="mixbar">
          {#each STATE_META as m (m.key)}
            {@const n = data.cardStates[m.key]}
            {#if n > 0}
              <div class="seg" style:flex-grow={n} style:background={m.color} title="{m.label}: {n}"></div>
            {/if}
          {/each}
        </div>
        <div class="legend">
          {#each STATE_META as m (m.key)}
            <span class="leg">
              <span class="swatch" style:background={m.color}></span>
              {m.label}
              <span class="leg-n mono">{data.cardStates[m.key]}</span>
            </span>
          {/each}
        </div>
      {/if}
    </div>
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
    margin-bottom: var(--space-6);
  }
  .note {
    color: var(--text-dim);
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .kpi {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .kpi-num {
    font-size: 26px;
    font-weight: 700;
    color: var(--text);
  }
  .kpi-label {
    color: var(--text-dim);
    font-size: 12px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
    margin-bottom: var(--space-4);
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: var(--space-4);
  }
  .chart {
    display: block;
    width: 100%;
    height: 140px;
  }
  .axis {
    fill: var(--text-dim);
    font-size: 8px;
    font-family: var(--font-mono);
  }
  .caption {
    color: var(--text-dim);
    font-size: 12px;
    margin-top: var(--space-2);
  }
  .empty {
    color: var(--text-dim);
    font-size: 14px;
  }
  .mixbar {
    display: flex;
    height: 20px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-2);
  }
  .seg {
    height: 100%;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-top: var(--space-3);
  }
  .leg {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 13px;
    color: var(--text);
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }
  .leg-n {
    color: var(--text-dim);
    font-size: 12px;
  }
</style>
