<script lang="ts">
 import { MonitorSpeaker, CircleCheck, CircleHelp } from "@lucide/svelte";
 let { player, library }: { player: string; library: string } = $props();
</script>
<div class="g-connection-status"><span><MonitorSpeaker size={15}/>{player}</span><span>{#if library.includes('configured')}<CircleCheck size={15}/>{:else}<CircleHelp size={15}/>{/if}{library}</span></div>
