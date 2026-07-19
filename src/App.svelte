<script lang="ts">
  // Importing the theme store runs its initializer, which stamps data-theme on
  // <html> before the shell paints (avoids a flash of the wrong theme).
  import './ui/theme.svelte';
  import Shell from './ui/Shell.svelte';
</script>

<Shell />
