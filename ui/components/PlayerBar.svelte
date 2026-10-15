<script lang="ts">
 import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, RefreshCw } from "@lucide/svelte";
 import { playerPresentation } from "../player-state.js";
 import { formatTime } from "../music-model.js";
 import { readable, type Readable } from "svelte/store";
 import type { PlaybackController } from "../playback-controller.js";
 import IconButton from "./IconButton.svelte";
 import Artwork from "./Artwork.svelte";
 let { controller, onqueue, queueEnabled = readable(false) }: { controller: PlaybackController; onqueue?: () => void; queueEnabled?: Readable<boolean> } = $props();
 let p = $derived($controller.player);
 let presentation = $derived(playerPresentation(p));
 let actions = $derived(p.capabilities?.actions ?? []);
 let duration = $derived(p.track?.duration_ms ? p.track.duration_ms / 1000 : undefined);
 let timeline = $derived(p.position !== undefined && duration !== undefined && p.position <= duration);
 let seek = $state<number | undefined>();
 let volume = $state<number | undefined>();
 $effect(() => { p.volume; volume = undefined; });
 $effect(() => { p.position; seek = undefined; });
 function command(action: string, value?: number) { void controller.command(action, value); }
</script>
<section class="g-player" aria-label="Music player" aria-busy={$controller.pending}>
 <div class="g-now"><Artwork name={presentation.title} size="player"/><div><strong title={presentation.title}>{presentation.title}</strong><span title={presentation.subtitle}>{presentation.subtitle}</span><small>{$controller.error ? 'Last observed: ' : ''}{presentation.status}</small></div></div>
 <div class="g-transport">
  <div class="g-transport-buttons">
   <IconButton label="Previous track" disabled={$controller.pending || !actions.includes('previous')} onclick={() => command('previous')}><SkipBack size={19} fill="currentColor"/></IconButton>
   <button class="g-play-toggle" type="button" aria-label={p.state === 'playing' ? 'Pause playback' : 'Start or resume playback'} disabled={$controller.pending || !actions.includes(p.state === 'playing' ? 'pause' : 'play')} onclick={() => command(p.state === 'playing' ? 'pause' : 'play')}>
    {#if p.state === 'playing'}<Pause size={20} fill="currentColor"/>{:else}<Play size={20} fill="currentColor"/>{/if}
   </button>
   <IconButton label="Next track" disabled={$controller.pending || !actions.includes('next')} onclick={() => command('next')}><SkipForward size={19} fill="currentColor"/></IconButton>
  </div>
  <div class="g-timeline"><span>{formatTime(p.position)}</span>{#if timeline}<input aria-label="Playback position in seconds" aria-valuetext={formatTime(seek ?? p.position)} type="range" min="0" max={duration} step="1" value={seek ?? p.position} disabled={$controller.pending || !actions.includes('seek')} oninput={e => seek = +e.currentTarget.value} onchange={e => command('seek', +e.currentTarget.value)}/>{:else}<span class="g-time-unknown">Time unavailable</span>{/if}<span>{formatTime(duration)}</span></div>
 </div>
 <div class="g-player-tools">
  {#if p.volume !== undefined && actions.includes('volume')}<label class="g-volume"><Volume2 size={18}/><span class="g-sr-only">Volume</span><input type="range" min="0" max="100" step="1" aria-label="Volume" aria-valuetext={`${volume ?? p.volume}%`} value={volume ?? p.volume} disabled={$controller.pending} oninput={e => volume = +e.currentTarget.value} onchange={e => command('volume', +e.currentTarget.value)}/></label>{:else}<span class="g-volume-unavailable">Volume unavailable</span>{/if}
  {#if onqueue && $queueEnabled && p.selected_player === 'cider'}<IconButton label="Open Cider queue" onclick={onqueue}><ListMusic size={20}/></IconButton>{/if}
  <IconButton label="Refresh player state" disabled={$controller.pending || $controller.refreshing || !$controller.player.capabilities?.available} onclick={() => void controller.refresh()}><RefreshCw size={17}/></IconButton>
 </div>
 {#if $controller.error}<p class="g-player-error" role="status">{$controller.error}</p>{/if}
</section>
