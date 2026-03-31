<script lang="ts">
  import type { Snippet } from 'svelte';

  let { main, panel }: { main: Snippet; panel: Snippet } = $props();

  // Mobile drawer state
  let drawerOpen = $state(false);
</script>

<!-- Desktop: two-column grid. Mobile: single column -->
<div class="lg:grid lg:grid-cols-[65fr_35fr] lg:gap-8">
  <!-- LEFT: main content -->
  <div class="min-w-0 space-y-6">
    {@render main()}
  </div>

  <!-- RIGHT: second column — always visible on desktop, hidden on mobile -->
  <div class="min-w-0 space-y-4 hidden lg:block">
    {@render panel()}
  </div>
</div>

<!-- Mobile: fixed toggle button (bottom-right, above the nav) -->
<button
  onclick={() => (drawerOpen = true)}
  class="lg:hidden fixed right-4 z-40 flex h-10 w-10 items-center justify-center
         rounded-full bg-[#1e1e2e] text-[#e2e2e8] shadow-lg transition-opacity
         hover:bg-[#2a2a3e]"
  style="bottom: calc(5rem + env(safe-area-inset-bottom))"
  aria-label="Open panel"
>
  <!-- Grid icon (2x2 dots) -->
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
    <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
    <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7"/>
  </svg>
</button>

<!-- Mobile drawer overlay -->
{#if drawerOpen}
  <!-- Backdrop -->
  <div
    class="lg:hidden fixed inset-0 z-40 bg-black/50"
    onclick={() => (drawerOpen = false)}
    role="presentation"
  ></div>

  <!-- Drawer panel — slides in from right -->
  <div
    class="lg:hidden fixed right-0 top-0 z-50 h-full w-[85vw] max-w-sm
           overflow-y-auto bg-[#12121c] px-4 py-6 space-y-4 shadow-2xl"
    style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom))"
  >
    <!-- Close button -->
    <div class="flex justify-end mb-2">
      <button
        onclick={() => (drawerOpen = false)}
        class="font-mono text-xs text-[#6b6b7a] hover:text-[#e2e2e8] transition-colors"
      >
        ✕ Close
      </button>
    </div>
    {@render panel()}
  </div>
{/if}
