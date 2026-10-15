<script lang="ts">
 import Artwork from "./Artwork.svelte";
 import type { CollectionItem } from "../music-model.js";
 let { item, onclick, active = false }: { item: CollectionItem; onclick: (event: MouseEvent) => void; active?: boolean } = $props();
</script>
<button type="button" class="g-collection-tile" aria-label={`Open ${item.name}`} aria-current={active ? "true" : undefined} {onclick}>
 <Artwork src={item.artwork} name={item.name} />
 <strong title={item.name}>{item.name}</strong><span title={item.artist}>{item.artist || (item.kind.includes('playlists') ? 'Playlist' : 'Your library')}</span>
</button>
