<script lang="ts">
 import { z } from "zod";
 import type { Writable } from "svelte/store";
 import type { ToolCall } from "./collection-controller.js";
 import { Recording } from "./music-model.js";
 import IconButton from "./components/IconButton.svelte";
 import TrackRow from "./components/TrackRow.svelte";
 import Button from "./components/Button.svelte";
 import { X, ListMusic } from "@lucide/svelte";
 let { open, call }: { open: Writable<boolean>; call: ToolCall } = $props();
 let dialog: HTMLDialogElement;
 let tracks = $state<Recording[]>([]), loading = $state(false), error = $state(''), truncated = $state(false);
 let generation = 0;
 async function load() {
  const request = ++generation; loading = true; error = '';
  try { const page = z.object({ tracks: z.array(Recording).max(500), truncated: z.boolean() }).parse(await call('get_playback_queue'));
   if (request === generation) { tracks = page.tracks; truncated = page.truncated; }
  } catch(e) { if (request === generation) error = e instanceof Error ? e.message : 'Queue read failed.'; }
  finally { if(request === generation) loading = false; }
 }
 $effect(() => { if ($open) { dialog.showModal(); void load(); } else { generation++; dialog.close(); } });
</script>
<dialog bind:this={dialog} class="g-kit g-queue-dialog" onclose={() => open.set(false)} aria-labelledby="queue-title">
 <div class="g-queue-heading"><h2 id="queue-title"><ListMusic size={22}/>Cider queue</h2><IconButton label="Close queue" onclick={() => open.set(false)}><X size={20}/></IconButton></div>
 <p>Current player order. This view does not change your queue.</p>
 {#if loading}<p role="status">Reading queue…</p>{:else if error}<p role="alert">{error}</p>{:else}<ol class="g-recording-list">{#each tracks as track, index}<TrackRow {track} {index}/>{:else}<li class="g-detail-state">Cider returned an empty queue.</li>{/each}</ol>{#if truncated}<p>Showing the first 500 recordings.</p>{/if}{/if}
 <Button pending={loading} onclick={() => void load()}>Refresh queue</Button>
</dialog>
