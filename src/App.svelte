<script lang="ts">
  // Importing the theme store runs its initializer, which stamps data-theme on
  // <html> before the shell paints (avoids a flash of the wrong theme).
  import './ui/theme.svelte';
  // Importing prefs stamps data-font on <html> before paint (font size + audio).
  import './ui/prefs.svelte';
  import Shell from './ui/Shell.svelte';
</script>

<Shell />
