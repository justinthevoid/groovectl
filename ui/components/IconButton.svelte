<script lang="ts">
 import type { Snippet } from "svelte";
 let { label, children, disabled = false, pressed, onclick }: { label: string; children: Snippet; disabled?: boolean; pressed?: boolean; onclick?: () => void } = $props();
</script>
<button class="g-icon-button" type="button" aria-label={label} title={label} aria-pressed={pressed} {disabled} {onclick}>{@render children()}</button>
