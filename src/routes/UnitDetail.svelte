<script lang="ts">
  import { router, navigate } from '../ui/router.svelte';
  import { matchPath } from '../ui/match';
  import Markdown from '../ui/Markdown.svelte';
  import AudioButton from '../ui/AudioButton.svelte';
  import {
    getUnitById,
    getLessonsForUnit,
    getVocabForUnit,
    type UnitWithProgress,
  } from '../db/queries';
  import type { LessonRow, VocabRow, LessonType } from '../db/types';

  let unit = $state<UnitWithProgress | null>(null);
  let lessons = $state<LessonRow[]>([]);
  let vocab = $state<VocabRow[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(true);

  const unitId = $derived.by(() => {
    const params = matchPath('/learn/:unitId', router.path);
    const n = params?.unitId !== undefined ? Number(params.unitId) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  $effect(() => {
    const id = unitId;
    if (id === null) return;
    loading = true;
    error = null;
    void Promise.all([getUnitById(id), getLessonsForUnit(id), getVocabForUnit(id)])
      .then(([u, l, v]) => {
        unit = u;
        lessons = l;
        vocab = v;
      })
      .catch((e: unknown) => {
        error = e instanceof Error ? e.message : 'Failed to load this unit.';
      })
      .finally(() => (loading = false));
  });

  const LESSON_LABEL: Record<LessonType, string> = {
    grammar: 'Grammar',
    vocab: 'Vocabulary',
    dialogue: 'Dialogue',
    reading: 'Reading',
  };

  function genderClass(g: string | null): string {
    return g === 'm' ? 'm' : g === 'f' ? 'f' : '';
  }

  function practice(): void {
    if (unitId !== null) navigate(`/learn/${unitId}/practice`);
  }
</script>

<section class="view">
  <button type="button" class="back" onclick={() => navigate('/learn')}>← All units</button>

  {#if error}
    <p class="note">{error}</p>
  {:else if loading}
    <p class="note mono">Loading…</p>
  {:else if unit}
    <header class="head">
      <span class="level mono">{unit.level}</span>
      <h1>{unit.title_en}</h1>
      <p class="fr">{unit.title_fr}</p>
      <p class="focus mono">Focus: {unit.grammar_focus}</p>
      <p class="desc">{unit.description}</p>
    </header>

    {#each lessons as lesson (lesson.id)}
      <article class="lesson">
        <div class="lesson-head">
          <span class="tag {lesson.type} mono">{LESSON_LABEL[lesson.type]}</span>
          <h2>{lesson.title}</h2>
        </div>
        <Markdown source={lesson.body_markdown} />
      </article>
    {/each}

    {#if vocab.length > 0}
      <article class="lesson">
        <div class="lesson-head">
          <span class="tag vocab mono">Vocabulary</span>
          <h2>Word list</h2>
        </div>
        <div class="vtable">
          {#each vocab as v (v.id)}
            <div class="vrow">
              <span class="vfr {genderClass(v.gender)}">
                <AudioButton src={v.audio_path} label="Play «{v.lemma_fr}»" />
                {v.lemma_fr}
              </span>
              {#if v.ipa}<span class="vipa mono">/{v.ipa}/</span>{/if}
              <span class="ven">{v.translation_en}</span>
            </div>
          {/each}
        </div>
      </article>
    {/if}

    <div class="cta">
      <button type="button" class="btn primary" onclick={practice}>
        Practice exercises →
      </button>
      <span class="count mono">{unit.exercise_count} exercises</span>
    </div>
  {/if}
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .back {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 14px;
    padding: var(--space-1) 0;
    margin-bottom: var(--space-4);
  }
  .back:hover {
    color: var(--text);
  }
  .note {
    color: var(--text-dim);
  }
  .head {
    margin-bottom: var(--space-6);
  }
  .level {
    color: var(--accent-text);
    font-weight: 700;
    font-size: 13px;
  }
  .head h1 {
    font-size: 28px;
    margin: var(--space-1) 0;
  }
  .fr {
    color: var(--text-dim);
    font-size: 16px;
  }
  .focus {
    color: var(--text-dim);
    font-size: 12px;
    margin-top: var(--space-3);
  }
  .desc {
    margin-top: var(--space-2);
    color: var(--text);
  }
  .lesson {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
    margin-bottom: var(--space-4);
  }
  .lesson-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .lesson-head h2 {
    font-size: 18px;
    font-weight: 600;
  }
  .tag {
    font-size: 11px;
    padding: 2px var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--text-dim);
    white-space: nowrap;
  }
  .tag.grammar {
    color: var(--accent-text);
    border-color: var(--accent-dim);
  }
  .tag.dialogue {
    color: var(--gender-m);
    border-color: var(--gender-m);
  }
  .tag.reading {
    color: var(--warn);
    border-color: var(--warn);
  }
  .vtable {
    display: flex;
    flex-direction: column;
  }
  .vrow {
    display: grid;
    grid-template-columns: 1fr auto 1.2fr;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
  }
  .vrow:last-child {
    border-bottom: none;
  }
  .vfr {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: 600;
    font-size: var(--reading-size);
  }
  .vfr.m {
    color: var(--gender-m);
  }
  .vfr.f {
    color: var(--gender-f);
  }
  .vipa {
    color: var(--text-dim);
    font-size: 13px;
  }
  .ven {
    color: var(--text-dim);
    text-align: right;
  }
  .cta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-6);
    padding-top: var(--space-5);
    border-top: 1px solid var(--border);
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
  .btn.primary {
    background: var(--accent);
    color: var(--on-accent);
    border-color: var(--accent);
    font-weight: 600;
  }
  .count {
    color: var(--text-dim);
    font-size: 13px;
  }
</style>
