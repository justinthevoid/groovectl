<script lang="ts">
 import { untrack } from "svelte";
 import exampleCover from "../assets/examples/between-stations.png";
 import { Play, Plus, Check, RefreshCw } from "@lucide/svelte";
 import Button from "./components/Button.svelte";
 import IconButton from "./components/IconButton.svelte";
 import Artwork from "./components/Artwork.svelte";
 import CollectionTile from "./components/CollectionTile.svelte";
 import TrackRow from "./components/TrackRow.svelte";
 import PlayerBar from "./components/PlayerBar.svelte";
 import ConnectionStatus from "./components/ConnectionStatus.svelte";
 import { PlaybackController, type Player } from "./playback-controller.js";
 import type { Recording, CollectionItem } from "./music-model.js";
 let dark = $state(false), selected = $state(false), playerMode = $state('cider');
 let events = $state('No actions yet.');
 const track: Recording = { source:'catalog', id:'101', name:'A House in the Trees', artist:'Mara Vale', album:'Afternoon Light', duration_ms:220000, explicit:true };
 const long: Recording = { source:'library-api', id:'i.synthetic', name:'風の中の手紙 — a very long recording title that should remain readable', artist:'架空のアーティスト · Synthetic artist', album:'Field recordings / alternate version', duration_ms:0 };
 const tile: CollectionItem = { source:'library-api', id:'p.synthetic', kind:'library-playlists', name:'Between Stations', artist:'Original Groovectl example cover', artwork:exampleCover };
 const fixturePlayer = (mode: string): Player => ({ execution_platform: mode === 'closed' ? 'darwin' : 'win32', available_players: [{ id:mode === 'closed' ? 'native' : 'windows', label:mode === 'closed' ? 'Music.app' : 'Apple Music', configured:true }, {id:'cider',label:'Cider',configured:true}], ...(mode === 'windows' ? { running:true, state:'paused', selected_player:'windows', media:{title:'',artist:'',album:''}, capabilities:{available:true,actions:['play','pause','stop']} } : mode === 'closed' ? { running:false, state:'stopped', selected_player:'native', capabilities:{available:true,actions:[]} } : { running:true, state:'paused', selected_player:'cider', position:42, volume:30, shuffle:false, repeat:'off', track, capabilities:{available:true,actions:['play','pause','previous','next','seek','volume','shuffle','repeat']} }) });
 let playerData: Player = fixturePlayer('cider');
 const fixtureCall = async (name: string, args?: Record<string, unknown>) => {
  if (name === 'get_playback_state' && args?.player && args.player !== playerData.selected_player) { playerData = fixturePlayer(args.player === 'native' ? 'closed' : String(args.player)); events = `Synthetic ${args.player} selected. No playback was requested.`; }
  if (name === 'control_playback') { events = `Synthetic ${args?.action} requested. No real player is connected.`; playerData = { ...playerData, ...(args?.action === 'play' ? { state:'playing' } : args?.action === 'pause' ? { state:'paused' } : args?.action === 'volume' ? { volume:Number(args.value) } : args?.action === 'seek' ? { position:Number(args.value) } : args?.action === 'shuffle' ? { shuffle:args.value === 1 } : args?.action === 'repeat' ? { repeat:args.value === 1 ? 'one' : args.value === 2 ? 'all' : 'off' } : {}) }; }
  return playerData;
 };
 let controller = $state(new PlaybackController(fixtureCall));
 $effect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; });
 $effect(() => {
  const next = fixturePlayer(playerMode);
  untrack(() => { playerData = next; const nextController = new PlaybackController(fixtureCall); nextController.observe(next); controller = nextController; });
 });
</script>
<div class="g-kit g-gallery">
 <header><div><strong class="g-gallery-brand">groovectl.</strong><h1>Music components</h1><p>Account-free development gallery · every recording and action is synthetic.</p></div><Button onclick={() => dark = !dark}>{dark ? 'Light theme' : 'Dark theme'}</Button></header>
 <nav aria-label="Gallery sections"><a href="#controls">Controls</a><a href="#collection">Collection</a><a href="#recordings">Recordings</a><a href="#player">Player</a></nav>
 <section id="controls"><h2>Controls</h2><p>One action language, with clear focus and pending states.</p><div class="g-gallery-examples"><Button variant="primary" onclick={() => events = 'Synthetic selection carried to Studio.'}><Plus size={16}/>Use in Studio</Button><Button onclick={() => events = 'Synthetic collection refreshed.'}><RefreshCw size={16}/>Refresh</Button><Button variant="quiet" onclick={() => selected = !selected}>Quiet action</Button><Button disabled>Unavailable</Button><Button pending>Reading…</Button><IconButton label="Example play action" onclick={() => events = 'Example play action.'}><Play size={18}/></IconButton><IconButton label="Selected recording example" pressed={true}><Check size={18}/></IconButton></div></section>
 <section id="collection"><h2>Collection</h2><p>Artwork is content. A named fallback never invents a cover.</p><div class="g-gallery-artwork"><CollectionTile item={tile} onclick={() => events = 'Synthetic playlist opened. Playback was not requested.'}/><div><Artwork name="Missing artwork"/><p class="g-gallery-caption">Artwork unavailable</p></div><div><Artwork name="Compact artwork" size="row"/><p class="g-gallery-caption">Recording size</p></div></div></section>
 <section id="recordings"><h2>Recordings</h2><p>Selection, playback, version identity and unknown duration remain separate.</p><ol class="g-recording-list"><TrackRow {track} index={0} {selected} onselect={() => selected = !selected} onplay={() => events = 'Synthetic targeted play requested.'}/><TrackRow track={long} index={1} onselect={() => events = 'Synthetic library recording selected.'}/><TrackRow track={{...track, name:'Unavailable recording', playable:false}} index={2}/></ol></section>
 <section><h2>Connections</h2><ConnectionStatus player="Paused on Cider" library="Catalog and library not connected"/></section>
 <section id="player"><div class="g-gallery-player-heading"><h2>Persistent player</h2><label>State<select bind:value={playerMode}><option value="cider">Cider · known time and volume</option><option value="windows">Windows · transport, no metadata</option><option value="closed">Music.app · closed</option></select></label></div><PlayerBar {controller}/></section>
 <p class="g-gallery-events" role="status">{events}</p>
</div>
<style>
 .g-gallery{max-width:1100px;margin:auto;padding:32px 28px 60px}.g-gallery header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:28px}.g-gallery-brand{font-size:22px;letter-spacing:-.03em;display:block;margin-bottom:28px}.g-gallery h1{font-size:32px}.g-gallery header p,.g-gallery section>p{color:var(--g-muted);margin-top:8px;font-size:13px}.g-gallery nav{display:flex;gap:22px;padding:0 0 22px;border-bottom:1px solid var(--g-line);flex-wrap:wrap}.g-gallery nav a{color:var(--g-accent);font-size:13px;text-underline-offset:4px}.g-gallery section{padding:26px 0;border-bottom:1px solid var(--g-line);scroll-margin-top:16px}.g-gallery-examples{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:22px}.g-gallery-artwork{display:grid;grid-template-columns:180px 180px 150px;gap:24px;margin-top:22px;align-items:start}.g-gallery-caption{font-size:12px;color:var(--g-muted);margin-top:9px!important}.g-gallery .g-recording-list{margin-top:20px}.g-gallery-player-heading{display:flex;align-items:center;gap:20px;justify-content:space-between;flex-wrap:wrap;margin-bottom:22px}.g-gallery-player-heading label{display:flex;flex-direction:column;gap:6px}.g-gallery-events{padding:20px 0;color:var(--g-muted);font-size:13px}@media(max-width:680px){.g-gallery{padding:22px 18px 40px}.g-gallery header{flex-direction:column}.g-gallery-artwork{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.g-gallery-artwork>div:last-child{grid-column:1/-1}.g-gallery h1{font-size:27px}}
</style>
