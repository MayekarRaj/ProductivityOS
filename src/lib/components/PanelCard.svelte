<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<div class="rounded-xl bg-[#161620] p-4">
  {#if title}
    <p class="mb-3 mt-10 font-mono text-[50px] font-semibold uppercase tracking-[0.12em] text-[#6b6b7a]">
      {title}
    </p>
  {/if}
  {@render children()}
</div>
