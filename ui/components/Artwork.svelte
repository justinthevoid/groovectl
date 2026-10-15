<script lang="ts">
 import { Disc3 } from "@lucide/svelte";
 let { src, name, size = "tile" }: { src?: string; name: string; size?: "tile" | "row" | "player" } = $props();
 let failed = $state(false);
 $effect(() => { src; failed = false; });
</script>
<span class={`g-artwork g-artwork-${size}`} aria-hidden="true">
 {#if src && !failed}<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => failed = true} />
 {:else}<Disc3 size={size === 'tile' ? 44 : 22} strokeWidth={1.3} /><span class="g-artwork-letter">{name.slice(0, 1)}</span>{/if}
</span>
