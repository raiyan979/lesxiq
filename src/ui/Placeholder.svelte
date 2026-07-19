<script lang="ts">
  /*
   * Temporary scaffold view. Each real route (Dashboard, Learn, ...) renders
   * this in Phase 1 so we can prove the shell, routing and theming work before
   * the feature screens exist. Replaced screen-by-screen in later phases.
   */
  interface Props {
    title: string;
    note: string;
  }
  let { title, note }: Props = $props();
</script>

<section class="view">
  <div class="card">
    <h1>{title}</h1>
    <p class="note mono">{note}</p>
  </div>
</section>

<style>
  .view {
    padding: var(--space-6);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    box-shadow: var(--card-shadow);
    padding: var(--space-5);
  }
  h1 {
    font-size: 28px;
    margin-bottom: var(--space-3);
  }
  .note {
    color: var(--text-dim);
  }
</style>
