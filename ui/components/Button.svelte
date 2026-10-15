<script lang="ts">
 import type { Snippet } from "svelte";
 import type { HTMLButtonAttributes } from "svelte/elements";
 let { children, variant = "secondary", pending = false, ...props }: HTMLButtonAttributes & { children?: Snippet; variant?: "primary" | "secondary" | "quiet"; pending?: boolean } = $props();
</script>
<button type="button" {...props} class={['g-button', `g-${variant}`, props.class]} disabled={props.disabled || pending} aria-busy={pending || undefined}>{@render children?.()}</button>
