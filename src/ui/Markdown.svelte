<script lang="ts">
  import { marked } from 'marked';

  interface Props {
    /** Trusted, build-time-authored markdown (from the curriculum seed). */
    source: string;
  }
  let { source }: Props = $props();

  // Curriculum content is authored by us and compiled into the seed DB — there
  // is no user-generated input here, so rendering it as HTML is safe. Restrict
  // to the inline+block subset the lessons actually use.
  const html = $derived(marked.parse(source, { async: false, gfm: true, breaks: false }));
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted curriculum content, see note above -->
<div class="prose">{@html html}</div>

<style>
  .prose {
    color: var(--text);
    font-size: var(--reading-size);
    line-height: 1.65;
  }
  .prose :global(h2) {
    font-size: 18px;
    font-weight: 700;
    margin: var(--space-5) 0 var(--space-2);
    color: var(--text);
  }
  .prose :global(h3) {
    font-size: 15px;
    font-weight: 600;
    margin: var(--space-4) 0 var(--space-2);
  }
  .prose :global(h2:first-child),
  .prose :global(h3:first-child) {
    margin-top: 0;
  }
  .prose :global(p) {
    margin: var(--space-2) 0;
  }
  .prose :global(ul) {
    margin: var(--space-2) 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .prose :global(li) {
    list-style: disc;
  }
  .prose :global(strong) {
    color: var(--text);
    font-weight: 700;
  }
  .prose :global(em) {
    color: var(--text-dim);
  }
  /* Inline code is used for French terms — give it the accent tint. */
  .prose :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    color: var(--accent-text);
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 4px;
  }
</style>
