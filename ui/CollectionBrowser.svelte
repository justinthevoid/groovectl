<script lang="ts">
 import { LibraryBig, ListMusic, Disc3, Mic2, Music2, Clock3, Search, LayoutGrid, List, X, ArrowRight, ArrowLeft, RefreshCw, Check, Plus } from "@lucide/svelte";
 import type { Readable } from "svelte/store";
 import { CollectionController } from "./collection-controller.js";
 import type { PlaybackController } from "./playback-controller.js";
 import { recordingKey, targetFor, type Recording, type Category, type LibrarySource, type CollectionItem } from "./music-model.js";
 import Button from "./components/Button.svelte";
 import IconButton from "./components/IconButton.svelte";
 import CollectionTile from "./components/CollectionTile.svelte";
 import TrackRow from "./components/TrackRow.svelte";
 import Artwork from "./components/Artwork.svelte";
 import ConnectionStatus from "./components/ConnectionStatus.svelte";
 import { playerPresentation, catalogConnectionLabel } from "./player-state.js";
 export type Connection = { connected: boolean; active: boolean; auth: { developer_key_configured: boolean; user_authorized: boolean }; tools?: string[] };
 let { controller, playback, connection, onstudio }: { controller: CollectionController; playback: PlaybackController; connection: Readable<Connection>; onstudio: (tracks: Recording[]) => void } = $props();
 let query = $state('');
 let layout = $state<'grid' | 'list'>('grid');
 let sort = $state('original');
 let feedback = $state('');
 let detailLimit = $state(100);
 let returnFocus: HTMLElement | undefined;
 let detailHeading = $state<HTMLHeadingElement>();
 let loaded = $state(false);
 let searchControl: HTMLInputElement;
 const categories: { id: Category; label: string; icon: typeof ListMusic }[] = [
  { id:'recently-added', label:'Recently added', icon:Clock3 }, { id:'playlists', label:'Playlists', icon:ListMusic },
  { id:'songs', label:'Songs', icon:Music2 }, { id:'albums', label:'Albums', icon:Disc3 }, { id:'artists', label:'Artists', icon:Mic2 },
 ];
 let categoryName = $derived(categories.find(c => c.id === $controller.category)?.label ?? 'Playlists');
 let allowed = $derived($connection.tools === undefined || $connection.tools.includes($controller.source === 'native' ? 'list_playlists' : 'browse_api_library'));
 let ready = $derived($connection.connected && allowed && ($controller.source === 'native' || $connection.auth.user_authorized));
 let canNative = $derived($playback.player.selected_player === 'native' && ($connection.tools === undefined || $connection.tools.includes('list_playlists')));
 let visible = $derived.by(() => {
  const value = query.toLocaleLowerCase().trim();
  const items = $controller.items.filter(i => `${i.name} ${i.artist}`.toLocaleLowerCase().includes(value));
  return sort === 'name' ? [...items].sort((a,b) => a.name.localeCompare(b.name)) : items;
 });
 let selectedKeys = $derived(new Set($controller.selected.map(recordingKey)));
 $effect(() => {
  if ($connection.active && ready && !loaded) { loaded = true; void controller.load(); }
 });
 function change(category: Category, source = $controller.source) { query = ''; feedback = ''; loaded = true; void controller.load(category, source); }
 function toggle(track: Recording) { try { controller.toggle(track); feedback = ''; } catch(e) { feedback = e instanceof Error ? e.message : 'Selection failed.'; } }
 async function openItem(item: CollectionItem, target?: EventTarget | null, nested = false) {
  if (!nested) returnFocus = target instanceof HTMLElement ? target : undefined;
  detailLimit = 100;
  const read = controller.open(item, nested);
  requestAnimationFrame(() => detailHeading?.focus());
  await read;
 }
 function backDetail() { controller.back(); detailLimit = 100; requestAnimationFrame(() => detailHeading?.focus()); }
 function closeDetail() { controller.close(); requestAnimationFrame(() => returnFocus?.isConnected ? returnFocus.focus() : searchControl?.focus()); }
 function useInStudio() { try { onstudio($controller.selected); controller.clear(); feedback = ''; } catch(e) { feedback = e instanceof Error ? e.message : 'Studio selection could not be added.'; } }
</script>
<div class="g-kit g-library-shell" class:g-has-detail={!!$controller.detail}>
 <aside class="g-library-rail" aria-label="Library categories">
  <div class="g-rail-heading"><LibraryBig size={19}/><strong>Library</strong></div>
  <nav aria-label="Collection type">
   {#each categories as category}<button type="button" aria-current={$controller.category === category.id ? 'page' : undefined} disabled={$controller.source === 'native' && category.id !== 'playlists'} onclick={() => change(category.id)}><category.icon size={18}/>{category.label}</button>{/each}
  </nav>
  <p>Choose recordings here.<br/>Make them yours in Studio.</p>
 </aside>
 <section class="g-library-content" class:g-detail-open={!!$controller.detail}>
  <div class="g-library-heading"><div><h1>{categoryName}</h1><p>{$controller.source === 'native' ? 'Music.app collection' : 'Your Apple Music collection'}</p></div><IconButton label="Refresh collection" disabled={!ready || $controller.loading} onclick={() => void controller.load()}><RefreshCw size={18}/></IconButton></div>
  <div class="g-library-source"><label for="collection-source">Read from</label><select id="collection-source" value={$controller.source} onchange={e => change('playlists', e.currentTarget.value as LibrarySource)}><option value="catalog">Apple Music API</option>{#if canNative}<option value="native">Music.app</option>{/if}</select></div>
  <label class="g-mobile-categories">Collection<select value={$controller.category} onchange={e => change(e.currentTarget.value as Category)}>{#each categories as c}<option value={c.id} disabled={$controller.source === 'native' && c.id !== 'playlists'}>{c.label}</option>{/each}</select></label>
  <div class="g-library-toolbar"><label class="g-search"><Search size={17}/><span class="g-sr-only">Filter loaded collection</span><input bind:this={searchControl} bind:value={query} type="search" placeholder="Filter loaded items" maxlength="200"/></label><label class="g-sort"><span class="g-sr-only">Sort loaded items</span><select bind:value={sort}><option value="original">Apple order</option><option value="name">Name · loaded items</option></select></label><div class="g-view-toggle" aria-label="Collection layout"><IconButton label="Grid view" pressed={layout === 'grid'} onclick={() => layout = 'grid'}><LayoutGrid size={17}/></IconButton><IconButton label="List view" pressed={layout === 'list'} onclick={() => layout = 'list'}><List size={19}/></IconButton></div></div>
  {#if !$connection.connected}<div class="g-empty-state"><LibraryBig size={32}/><h2>Connect to your collection</h2><p>Open Groovectl in an MCP Apps host. Your draft stays in Studio.</p></div>
  {:else if !allowed}<div class="g-empty-state"><h2>Library is outside this profile</h2><p>Reconnect with the full or library profile to browse your collection.</p></div>
  {:else if !ready}<div class="g-empty-state"><LibraryBig size={32}/><h2>Your library needs a connection</h2><p>Set up MusicKit locally with <code>groovectl setup</code>, then <code>groovectl authorize</code>.</p>{#if canNative}<Button onclick={() => change('playlists', 'native')}>Browse Music.app playlists</Button>{/if}<p>Local playback has its own connection and can work independently.</p></div>
  {:else}
   {#if $controller.items.length >= 1000}<p class="g-detail-state">Showing the first 1,000 loaded items. Use Apple Music to explore beyond this session limit.</p>{/if}<p class="g-result-count" aria-live="polite">{#if $controller.loading && !$controller.items.length}Reading {categoryName.toLowerCase()}…{:else}{visible.length}{query ? ` of ${$controller.items.length}` : ''} loaded{#if $controller.hasMore} · more available{/if}{/if}</p>
   {#if $controller.error}<div class="g-read-error" role="alert"><p>{$controller.error}</p><Button onclick={() => void controller.retryLoad()}>Try collection again</Button></div>{/if}
   {#if !$controller.loading && !visible.length && !$controller.error}<div class="g-empty-state"><Music2 size={32}/><h2>{query ? 'No matching loaded items' : 'Nothing on this page'}</h2><p>{query ? 'Try another filter, or load more of your collection.' : 'Choose another category or refresh your library.'}</p>{#if query}<Button onclick={() => query = ''}>Clear filter</Button>{/if}</div>{/if}
   {#if layout === 'grid' && $controller.category !== 'songs'}<div class="g-collection-grid" aria-label={categoryName}>{#each visible as item (`${item.source}:${item.id}`)}<CollectionTile {item} active={$controller.detail?.item.id === item.id} onclick={event => void openItem(item, event.currentTarget)}/>{/each}</div>
   {:else}<ul class="g-collection-list" aria-label={categoryName}>{#each visible as item, i (`${item.source}:${item.id}`)}{#if item.recording}<TrackRow track={item.recording} index={i} selected={selectedKeys.has(recordingKey(item.recording))} onselect={() => item.recording && toggle(item.recording)}/>{:else}<li><button class="g-collection-list-item" type="button" onclick={event => void openItem(item, event.currentTarget)}><Artwork src={item.artwork} name={item.name} size="row"/><span><strong>{item.name}</strong><small>{item.artist || (item.kind === 'library-artists' ? 'Library artist' : item.kind === 'library-albums' ? 'Library album' : 'Playlist')}</small></span><ArrowRight size={17}/></button></li>{/if}{/each}</ul>{/if}
   {#if $controller.hasMore}<div class="g-load-more"><Button pending={$controller.loading} onclick={() => void controller.load($controller.category, $controller.source, true)}>Load next 100</Button><span>Filter and sort apply to loaded items.</span></div>{/if}
  {/if}
 </section>
 {#if $controller.detail}
  {@const detail = $controller.detail}
  <aside class="g-collection-detail" aria-label={`${detail.item.name} details`}>
   <div class="g-detail-top"><Button variant="quiet" onclick={detail.parents.length ? backDetail : closeDetail}><ArrowLeft size={16}/>{detail.parents.at(-1)?.name || 'Collection'}</Button><IconButton label="Close collection details" onclick={closeDetail}><X size={19}/></IconButton></div>
   <div class="g-playlist-header"><Artwork src={detail.item.artwork} name={detail.item.name}/><div><h2 bind:this={detailHeading} tabindex="-1">{detail.item.name}</h2><p>{detail.item.artist || (detail.item.kind === 'library-artists' ? 'Library artist' : detail.item.kind === 'library-albums' ? 'Library album' : 'Your playlist')}</p><span>{detail.item.source === 'native' ? 'Music.app persistent IDs' : 'Apple Music library'}{#if detail.tracks.length || detail.children.length} · {detail.item.kind === 'library-artists' ? `${detail.children.length} albums loaded` : `${detail.tracks.length} recordings loaded`}{/if}</span></div></div>
   {#if detail.loading}<p class="g-detail-state" role="status">Reading {detail.item.kind === 'library-artists' ? 'library albums' : 'exact recordings'}…</p>{/if}
   {#if detail.error}<div class="g-read-error" role="alert"><p>{detail.error}</p><Button onclick={() => void controller.retryDetail()}>Try details again</Button></div>{/if}
   {#if !detail.loading && !detail.error && !detail.tracks.length && !detail.children.length}<p class="g-detail-state">Apple returned no {detail.item.kind === 'library-artists' ? 'library albums' : 'recordings'} for this item.</p>{/if}
   {#if detail.children.length}<p class="g-detail-state">Albums in your library. Open one to choose its exact recordings.</p><ul class="g-collection-list" aria-label="Artist library albums">{#each detail.children as album (`${album.source}:${album.kind}:${album.id}`)}<li><button class="g-collection-list-item" type="button" onclick={event => void openItem(album, event.currentTarget, true)}><Artwork src={album.artwork} name={album.name} size="row"/><span><strong>{album.name}</strong><small>{album.artist || 'Library album'}</small></span><ArrowRight size={17}/></button></li>{/each}</ul>{/if}
   {#if detail.tracks.length}<p class="g-detail-state">Select recordings for Studio. Play controls appear only for IDs this player accepts.</p><ol class="g-recording-list">{#each detail.tracks.slice(0, detailLimit) as track, index (`${recordingKey(track)}:${index}`)}<TrackRow {track} {index} selected={selectedKeys.has(recordingKey(track))} onselect={() => toggle(track)} disabled={$playback.pending || $playback.needsRefresh || !$playback.player.capabilities?.available} onplay={targetFor(track, $playback.player.selected_player) && $playback.player.capabilities?.actions.includes('play') ? () => void playback.command('play', undefined, targetFor(track, $playback.player.selected_player)) : undefined}/>{/each}</ol>{#if detailLimit < detail.tracks.length}<div class="g-load-more"><Button onclick={() => detailLimit += 100}>Show next 100 recordings</Button><span>{Math.min(detailLimit, detail.tracks.length)} of {detail.tracks.length} shown</span></div>{/if}{/if}
   {#if detail.nextPage && detail.tracks.length + detail.children.length < 1000}<div class="g-load-more"><Button pending={detail.loading} onclick={() => { detailLimit += 100; void controller.moreDetail(); }}>Load next detail page</Button></div>{:else if detail.nextPage}<p class="g-detail-state">Showing the first 1,000 related items. Explore the rest in Apple Music.</p>{/if}
  </aside>
 {/if}
 {#if $controller.selected.length}<div class="g-selection-tray" role="region" aria-label="Recordings selected for Studio"><span><Check size={17}/><strong>{$controller.selected.length} selected</strong><small>Exact versions, ready to shape.</small></span><Button variant="quiet" onclick={() => controller.clear()}>Clear</Button><Button variant="primary" onclick={useInStudio}>Use in Studio<ArrowRight size={16}/></Button></div>{/if}
 {#if feedback}<p class="g-library-feedback" role="status">{feedback}</p>{/if}
 <div class="g-library-connections"><ConnectionStatus player={playerPresentation($playback.player).status} library={catalogConnectionLabel($connection.auth)}/></div>
</div>
