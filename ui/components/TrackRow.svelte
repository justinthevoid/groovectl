<script lang="ts">
 import { Play, Check, Plus } from "@lucide/svelte";
 import type { Recording } from "../music-model.js";
 import { formatTime } from "../music-model.js";
 import IconButton from "./IconButton.svelte";
 let { track, index, selected = false, onselect, onplay, disabled = false }: { track: Recording; index: number; selected?: boolean; onselect?: () => void; onplay?: () => void; disabled?: boolean } = $props();
</script>
<li class:g-selected={selected} class="g-track-row">
 <span class="g-track-index">{index + 1}</span>
 <div class="g-track-copy"><strong title={track.name}>{track.name}{#if track.explicit}<span class="g-explicit" aria-label="Explicit recording">E</span>{/if}</strong><span title={`${track.artist} · ${track.album}`}>{track.artist || 'Artist unavailable'}{track.album ? ` · ${track.album}` : ''}</span>{#if track.playable === false}<small class="g-track-unavailable">Playback unavailable for this source</small>{/if}</div>
 <span class="g-track-source">{track.source === 'library-api' ? 'Library' : track.source === 'native' ? 'Music.app' : 'Catalog'}</span>
 <span class="g-track-time">{formatTime(track.duration_ms > 0 ? track.duration_ms / 1000 : undefined)}</span>
 {#if onplay}<IconButton label={`Play ${track.name} on the selected player`} {disabled} onclick={onplay}><Play size={16} fill="currentColor" /></IconButton>{/if}
 {#if onselect}<IconButton label={`${selected ? 'Deselect' : 'Select'} ${track.name} for Studio`} pressed={selected} onclick={onselect}>{#if selected}<Check size={18}/>{:else}<Plus size={18}/>{/if}</IconButton>{/if}
</li>
