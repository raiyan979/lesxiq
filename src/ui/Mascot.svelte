<script lang="ts">
  /*
   * Lexiq mascot — a friendly cartoon croissant. Fixed warm colors (a croissant
   * is golden in any theme), so this does NOT use theme tokens. Scales with the
   * `size` prop. Decorative by default; pass a `title` to announce it.
   */
  interface Props {
    size?: number;
    title?: string;
  }
  let { size = 32, title }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  role={title ? 'img' : 'presentation'}
  aria-label={title}
  aria-hidden={title ? undefined : 'true'}
>
  <!-- baked crust outline -->
  <path d="M13 45 Q32 4 51 45" fill="none" stroke="#a86413" stroke-width="21" stroke-linecap="round" />
  <!-- golden body -->
  <path d="M13 45 Q32 4 51 45" fill="none" stroke="#f5a524" stroke-width="16" stroke-linecap="round" />
  <!-- highlight -->
  <path d="M13 45 Q32 4 51 45" fill="none" stroke="#ffca63" stroke-width="5" stroke-linecap="round" opacity="0.6" />
  <!-- segment ridges -->
  <path
    d="M21 31 l4.5 9 M32 23 v11 M43 31 l-4.5 9"
    fill="none"
    stroke="#cd7f16"
    stroke-width="2.2"
    stroke-linecap="round"
  />
  <!-- face -->
  <circle cx="27" cy="35" r="2.3" fill="#3a2a12" />
  <circle cx="37" cy="35" r="2.3" fill="#3a2a12" />
  <circle cx="27.8" cy="34.2" r="0.7" fill="#fff" />
  <circle cx="37.8" cy="34.2" r="0.7" fill="#fff" />
  <path d="M28 41 Q32 44.5 36 41" fill="none" stroke="#3a2a12" stroke-width="2.2" stroke-linecap="round" />
  <!-- cheeks -->
  <circle cx="22.5" cy="39" r="2.2" fill="#f47a52" opacity="0.55" />
  <circle cx="41.5" cy="39" r="2.2" fill="#f47a52" opacity="0.55" />
</svg>
