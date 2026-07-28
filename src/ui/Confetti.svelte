<script lang="ts">
  /*
   * Lightweight celebration confetti — pure CSS, no deps, offline. Renders a
   * burst of themed pieces that fall and fade once. Absolutely positioned, so
   * the parent must be position: relative. Honours prefers-reduced-motion.
   */
  interface Props {
    /** Number of pieces. */
    count?: number;
  }
  let { count = 44 }: Props = $props();

  const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--success)', 'var(--warn)'];

  const pieces = $derived(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.3,
      color: COLORS[i % COLORS.length]!,
      rotate: (Math.random() * 2 - 1) * 540,
      drift: (Math.random() * 2 - 1) * 60,
      size: 6 + Math.random() * 6,
    })),
  );
</script>

<div class="confetti" aria-hidden="true">
  {#each pieces as p (p.id)}
    <span
      class="piece"
      style:left="{p.left}%"
      style:background={p.color}
      style:width="{p.size}px"
      style:height="{p.size}px"
      style:animation-delay="{p.delay}s"
      style:animation-duration="{p.duration}s"
      style:--rot="{p.rotate}deg"
      style:--drift="{p.drift}px"
    ></span>
  {/each}
</div>

<style>
  .confetti {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    border-radius: inherit;
  }
  .piece {
    position: absolute;
    top: -14px;
    border-radius: 2px;
    animation-name: fall;
    animation-timing-function: cubic-bezier(0.3, 0.6, 0.7, 1);
    animation-fill-mode: forwards;
  }
  @keyframes fall {
    0% {
      transform: translate(0, -14px) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translate(var(--drift), 420px) rotate(var(--rot));
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .piece {
      display: none;
    }
  }
</style>
