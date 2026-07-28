<script lang="ts">
  import { router, navigate } from '../ui/router.svelte';
  import { matchPath } from '../ui/match';
  import { Session } from '../exercises/session.svelte';
  import { getUnitById, type UnitWithProgress } from '../db/queries';
  import Confetti from '../ui/Confetti.svelte';
  import McExercise from '../exercises/components/McExercise.svelte';
  import TextExercise from '../exercises/components/TextExercise.svelte';
  import WordOrderExercise from '../exercises/components/WordOrderExercise.svelte';
  import MatchExercise from '../exercises/components/MatchExercise.svelte';

  const session = new Session();
  let unit = $state<UnitWithProgress | null>(null);
  let error = $state<string | null>(null);

  const unitId = $derived.by(() => {
    const params = matchPath('/learn/:unitId/practice', router.path);
    const raw = params?.unitId;
    const n = raw !== undefined ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  function backToUnit(): void {
    navigate(unitId !== null ? `/learn/${unitId}` : '/learn');
  }

  $effect(() => {
    const id = unitId;
    if (id === null) return;
    error = null;
    unit = null;
    void getUnitById(id).then((u) => (unit = u));
    void session.load(id).catch((e: unknown) => {
      error = e instanceof Error ? e.message : 'Failed to load exercises.';
    });
  });

  const view = $derived(session.current);

  const accuracy = $derived(
    session.total > 0 ? Math.round((session.correctCount / session.total) * 100) : 0,
  );

  function onCheck(): void {
    if (session.phase === 'answering' && session.canCheck) void session.check();
  }

  function onWindowKey(event: KeyboardEvent): void {
    // In feedback, Enter/Space moves to the next question (rating is automatic).
    if (
      session.phase === 'feedback' &&
      !session.error &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      void session.next();
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<section class="session">
  <header class="bar">
    <button type="button" class="exit" onclick={backToUnit}>← Exit</button>
    {#if session.total > 0 && (session.phase === 'answering' || session.phase === 'feedback')}
      <div class="progress" aria-label="progress">
        <div class="track">
          <div class="fill" style:width="{((session.index + 1) / session.total) * 100}%"></div>
        </div>
        <span class="count mono">{session.index + 1} / {session.total}</span>
      </div>
    {/if}
    <span class="unit-title">{unit?.title_en ?? ''}</span>
  </header>

  {#if error}
    <div class="card note">{error}</div>
  {:else if session.phase === 'loading'}
    <div class="card note mono">Loading…</div>
  {:else if session.phase === 'empty'}
    <div class="card note">This unit has no exercises yet.</div>
  {:else if session.phase === 'done'}
    <div class="card done">
      <Confetti />
      <h1>Session complete</h1>
      <p class="score">
        <span class="big mono">{session.correctCount}</span> / {session.total} correct
        <span class="pct mono">({accuracy}%)</span>
      </p>
      {#if session.unlockedTitle}
        <div class="unlock">
          <span class="unlock-icon">🔓</span>
          <span>New unit unlocked: <strong>{session.unlockedTitle}</strong></span>
          <button
            type="button"
            class="btn"
            onclick={() => session.unlockedUnitId !== null && navigate(`/learn/${session.unlockedUnitId}`)}
          >
            Go →
          </button>
        </div>
      {/if}
      <div class="actions">
        <button type="button" class="btn primary" onclick={() => unitId !== null && session.load(unitId)}>
          Practice again
        </button>
        <button type="button" class="btn" onclick={backToUnit}>Back to unit</button>
      </div>
    </div>
  {:else if view}
    <div class="card exercise">
      {#if view.type === 'mc'}
        <McExercise {session} {view} disabled={session.phase === 'feedback'} />
      {:else if view.type === 'word_order'}
        <WordOrderExercise {session} {view} disabled={session.phase === 'feedback'} />
      {:else if view.type === 'match'}
        <MatchExercise {session} {view} disabled={session.phase === 'feedback'} />
      {:else}
        <TextExercise {session} {view} disabled={session.phase === 'feedback'} onEnter={onCheck} />
      {/if}
    </div>

    <footer class="footer">
      {#if session.phase === 'answering'}
        <button type="button" class="btn primary check" disabled={!session.canCheck} onclick={onCheck}>
          Check
        </button>
      {:else if session.result}
        <div class="feedback" class:ok={session.result.correct} class:bad={!session.result.correct}>
          {#if session.result.correct}
            <span class="mark">✓ Correct</span>
          {:else}
            <span class="mark">✗ Answer:</span>
            <span class="expected">{session.result.expected}</span>
          {/if}
          {#if session.result.total !== undefined}
            <span class="partial mono">{session.result.correctCount}/{session.result.total} pairs</span>
          {/if}
        </div>

        {#if session.error}
          <div class="err">
            <span class="err-title mono">Couldn’t save your progress</span>
            <span class="err-msg mono">{session.error}</span>
            <button type="button" class="btn" onclick={() => session.skip()}>Skip to next →</button>
          </div>
        {:else}
          <button type="button" class="btn primary check" onclick={() => session.next()}>
            {session.index + 1 >= session.total ? 'Finish' : 'Next question'} →
          </button>
        {/if}
      {/if}
    </footer>
  {/if}
</section>

<style>
  .session {
    padding: var(--space-5) var(--space-6);
    max-width: var(--exercise-max-width);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  .exit {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 14px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-button);
  }
  .exit:hover {
    color: var(--text);
  }
  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
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
  .unit-title {
    color: var(--text-dim);
    font-size: 13px;
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
  .exercise {
    margin-bottom: var(--space-5);
  }
  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
  .btn:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .btn.primary {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 600;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .check {
    align-self: flex-end;
  }
  .feedback {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-button);
    font-size: var(--reading-size);
  }
  .feedback.ok {
    color: var(--success);
    background: color-mix(in srgb, var(--success) 12%, transparent);
  }
  .feedback.bad {
    color: var(--error);
    background: color-mix(in srgb, var(--error) 12%, transparent);
  }
  .feedback .expected {
    color: var(--text);
    font-weight: 600;
  }
  .partial {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 13px;
  }
  .err {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--error);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--error) 10%, transparent);
  }
  .err-title {
    color: var(--error);
    font-weight: 600;
    font-size: 13px;
  }
  .err-msg {
    color: var(--text-dim);
    font-size: 12px;
    word-break: break-word;
  }
  .err .btn {
    align-self: flex-start;
  }
  .unlock {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-5);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    font-size: var(--reading-size);
  }
  .unlock-icon {
    font-size: 20px;
  }
  .done {
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .done h1 {
    font-size: 24px;
    margin-bottom: var(--space-4);
  }
  .score {
    font-size: var(--reading-size);
    color: var(--text-dim);
    margin-bottom: var(--space-5);
  }
  .score .big {
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
