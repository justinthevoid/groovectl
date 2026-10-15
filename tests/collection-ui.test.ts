import { test } from "node:test";
import assert from "node:assert/strict";
import { CollectionController, type CollectionState } from "../ui/collection-controller.js";
import { PlaybackController, type PlayerState } from "../ui/playback-controller.js";
import { artworkUrl, collectionPage, formatTime, resourceItem, targetFor } from "../ui/music-model.js";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((r, fail) => { resolve = r; reject = fail; });
	return { promise, resolve, reject };
}
const track = { source: "catalog" as const, id: "101", name: "Fixture", artist: "Synthetic", album: "", duration_ms: 220000 };
const paused = { running: true, state: "paused", selected_player: "cider", volume: 0, position: 0,
	track, capabilities: { available: true, actions: ["play", "pause", "volume"] } };

test("player selection routes reads, commands and queues without changing the host default", async () => {
	const calls: { name: string; args?: Record<string, unknown> }[] = [];
	const available_players = [{ id: "windows", label: "Apple Music", configured: true }, { id: "cider", label: "Cider", configured: true }];
	const windows = { running: true, state: "paused", selected_player: "windows", execution_platform: "win32", available_players, capabilities: { available: true, actions: ["play", "pause"] } };
	const controller = new PlaybackController(async (name, args) => {
		calls.push({ name, args });
		if (name === "get_playback_queue") return { tracks: [], truncated: false };
		return args?.player === "cider" ? { ...paused, execution_platform: "win32", available_players } : windows;
	});
	let state!: PlayerState; controller.subscribe(s => state = s);
	controller.observe(windows);
	await controller.selectPlayer("cider");
	assert.equal(calls.length, 1); assert.equal(calls[0]?.name, "get_playback_state");
	assert.equal(state.player.selected_player, "cider");
	controller.observe(windows);
	assert.equal(state.player.selected_player, "cider");
	await controller.command("play"); await controller.queue(); await controller.refresh();
	assert.deepEqual(calls.map(c => c.args?.player), ["cider", "cider", "cider", "cider"]);
	assert.equal(state.refreshing, false);
});

test("late reads and failed switches cannot send a command to the previous player", async () => {
	const old = deferred<unknown>(), next = deferred<unknown>(); let reads = 0, commands = 0;
	const available_players = [{id:"windows",label:"Apple Music",configured:true},{id:"cider",label:"Cider",configured:true}];
	const initial = { ...paused, available_players };
	const controller = new PlaybackController(async (name, args) => {
		if (name === "control_playback") { commands++; return initial; }
		if (args?.player === "windows") return next.promise;
		reads++; return old.promise;
	});
	let state!: PlayerState; controller.subscribe(s => state = s); controller.observe(initial);
	const first = controller.refresh(); const switching = controller.selectPlayer("windows");
	old.resolve(initial); await first;
	assert.equal(state.refreshing, true); assert.equal(state.player.selected_player, "windows");
	assert.equal(state.player.track, undefined);
	await controller.command("play"); assert.equal(commands, 0);
	next.reject(new Error("Windows connection unavailable")); await switching;
	assert.match(state.error!, /Windows connection/); assert.equal(state.needsRefresh, true);
	await controller.command("play"); assert.equal(commands, 0); assert.equal(reads, 1);
});

test("a different-player response fails closed and unconfigured choices do not read or play", async () => {
	let calls = 0;
	const controller = new PlaybackController(async () => { calls++; return paused; });
	let state!: PlayerState; controller.subscribe(s => state = s);
	controller.observe({ ...paused, available_players: [{id:"windows",label:"Apple Music",configured:true},{id:"cider",label:"Cider",configured:false}] });
	await controller.selectPlayer("cider"); assert.equal(calls, 0);
	await controller.selectPlayer("windows");
	assert.match(state.error!, /different player/); assert.equal(state.needsRefresh, true);
	await controller.command("play"); assert.equal(calls, 1);
});

test("profile restrictions clear a selected player and cannot retain live command capabilities", async () => {
	let commands = 0;
	const choices = [{ id:"windows", label:"Apple Music", configured:true }, { id:"cider", label:"Cider", configured:true }];
	const controller = new PlaybackController(async (name) => {
		if (name === "control_playback") commands++;
		return { ...paused, available_players: choices };
	});
	let state!: PlayerState; controller.subscribe(s => state = s);
	controller.observe({ ...paused, selected_player:"windows", available_players: choices });
	await controller.selectPlayer("cider");
	controller.observe({ running:false, state:"profile-limited", selected_player:"windows", available_players:[], capabilities:{available:false,actions:[]} });
	await controller.command("play"); assert.equal(commands, 0);
	controller.observe({ ...paused, selected_player:"windows", available_players: choices });
	assert.equal(state.player.selected_player, "windows");
});

test("collection normalizes real namespaces and refuses non-Apple artwork destinations", () => {
	const item = resourceItem({ id: "i.local", type: "library-songs", attributes: { name: "Uploaded recording", artistName: "Artist", playParams: { catalogId: "101" }, artwork: { url: "https://is1-ssl.mzstatic.com/image/{w}x{h}bb.{f}" } } });
	assert.equal(item.recording?.source, "library-api");
	assert.equal(item.recording?.id, "i.local");
	assert.equal(targetFor(item.recording!, "cider"), undefined);
	assert.equal(targetFor(track, "cider"), "101");
	assert.equal(targetFor(track, "windows"), undefined);
	assert.equal(targetFor({ ...track, source: "native", id: "0123456789ABCDEF" }, "native"), "0123456789ABCDEF");
	assert.equal(artworkUrl("https://mzstatic.com.attacker.invalid/a.jpg"), undefined);
	assert.equal(artworkUrl("https://user:password@is1-ssl.mzstatic.com/a.jpg"), undefined);
	assert.equal(artworkUrl("https://is1-ssl.mzstatic.com:8000/a.jpg"), undefined);
	assert.equal(artworkUrl("data:image/svg+xml,<svg/>"), undefined);
	assert.equal(item.artwork, "https://is1-ssl.mzstatic.com/image/360x360bb.jpg");
	assert.equal(formatTime(undefined), "—"); assert.equal(formatTime(0), "0:00");
	assert.equal(collectionPage({ playlists: [{ id: "0123456789ABCDEF", name: "Local" }] }, "native").items[0]?.source, "native");
	assert.throws(() => collectionPage({ results: {} }, "catalog"));
});

test("collection ignores an older page and an older inspector after navigation", async () => {
	const page = deferred<unknown>(), detail = deferred<unknown>();
	const controller = new CollectionController(async (name, args) => {
		if (name === "get_playlist") return detail.promise;
		if (args?.type === "albums") return page.promise;
		return { data: [{ id: "p.new", type: "library-playlists", attributes: { name: "Current" } }] };
	});
	let state!: CollectionState; controller.subscribe(s => { state = s; });
	const old = controller.load("albums"); await controller.load("playlists");
	page.resolve({ data: [{ id: "a.old", attributes: { name: "Old" } }] }); await old;
	assert.equal(state.category, "playlists"); assert.equal(state.items[0]?.id, "p.new");
	const pendingDetail = controller.open(state.items[0]!); controller.close();
	detail.resolve({ tracks: [track] }); await pendingDetail;
	assert.equal(state.detail, undefined);
});

test("pagination is bounded, append-only, and deduplicated without changing selection", async () => {
	const controller = new CollectionController(async (_name, args) => ({ data: [{ id: "p.same", type: "library-playlists", attributes: { name: "Same" } }, ...(args?.offset === 100 ? [{ id: "p.new", type: "library-playlists", attributes: { name: "Next" } }] : [])], ...(args?.offset === 0 ? { next: "/v1/me/library/playlists?offset=100" } : {}) }));
	let state!: CollectionState; controller.subscribe(s => { state = s; });
	controller.toggle(track); controller.toggle({ ...track, source: "library-api" });
	await controller.load(); await controller.load("playlists", "catalog", true);
	assert.equal(state.items.length, 2); assert.equal(state.offset, 100); assert.equal(state.hasMore, false);
	assert.equal(state.selected.length, 2);
	for (let i = 2; i < 200; i++) controller.toggle({ ...track, id: String(1000 + i) });
	assert.throws(() => controller.toggle({ ...track, id: "99999" }), /200/);
	assert.equal(state.selected.length, 200);
});

test("player commands reject stale reads, preserve zero values, and prevent duplicate commands", async () => {
	const oldRead = deferred<unknown>(), command = deferred<unknown>();
	let reads = 0, writes = 0;
	const controller = new PlaybackController(async name => {
		if (name === "control_playback") { writes++; return command.promise; }
		reads++; return reads === 1 ? oldRead.promise : { ...paused, state: "playing", position: 2 };
	});
	let state!: PlayerState; controller.subscribe(s => { state = s; }); controller.observe(paused);
	assert.equal(state.player.volume, 0); assert.equal(state.player.position, 0);
	const old = controller.refresh(), write = controller.command("play");
	await controller.command("play"); assert.equal(writes, 1);
	command.resolve({ ...paused, state: "playing", position: 2 }); await write;
	oldRead.resolve(paused); await old;
	assert.equal(state.player.state, "playing"); assert.equal(state.player.position, 2);
	assert.equal(state.pending, false);
});

test("a failed player write is not replayed or presented as observed success", async () => {
	let writes = 0;
	const controller = new PlaybackController(async () => { writes++; throw new Error("Command timed out"); });
	let state!: PlayerState; controller.subscribe(s => { state = s; }); controller.observe(paused);
	await controller.command("play");
	assert.equal(writes, 1); assert.equal(state.player.state, "paused");
	assert.match(state.error!, /Refresh the player/);
	await controller.command("seek", 10); assert.equal(writes, 1);
	assert.equal(state.needsRefresh, true);
	assert.match(state.error!, /Refresh the player/);
});

test("player requires a fresh observation after uncertain IO and retains mode readbacks", async () => {
	let writes = 0, fail = true;
	const modes = { ...paused, shuffle: false, repeat: "off", capabilities: { available: true, actions: ["shuffle", "repeat"] } };
	const controller = new PlaybackController(async (name, args) => {
		if (name === "get_playback_state") return modes;
		writes++;
		if (fail) throw new Error("Response lost");
		return { ...modes, shuffle: args?.action === "shuffle", repeat: "one" };
	});
	let state!: PlayerState; controller.subscribe(s => { state = s; }); controller.observe(modes);
	assert.equal(state.player.shuffle, false); assert.equal(state.player.repeat, "off");
	await controller.command("shuffle", 1); await controller.command("shuffle", 1);
	assert.equal(writes, 1); assert.equal(state.needsRefresh, true); assert.equal(state.player.shuffle, false);
	fail = false; await controller.refresh(); assert.equal(state.needsRefresh, false);
	await controller.command("repeat", 1); assert.equal(writes, 2); assert.equal(state.player.repeat, "one");
	controller.observe({ ...modes, capabilities: { available: false, actions: ["shuffle"] } });
	await controller.command("shuffle", 1); assert.equal(writes, 2);
});

test("a late command cannot replace a newer player observation", async () => {
	const pending = deferred<unknown>();
	const controller = new PlaybackController(async () => pending.promise);
	let state!: PlayerState; controller.subscribe(s => { state = s; }); controller.observe(paused);
	const command = controller.command("play");
	controller.observe({ running: true, state: "paused", selected_player: "windows", capabilities: { available: true, actions: ["play"] } });
	pending.resolve({ ...paused, state: "playing" }); await command;
	assert.equal(state.player.selected_player, "windows"); assert.equal(state.player.state, "paused");
	assert.equal(state.pending, false);
});

test("collection retry repeats the failed page and preserves detail and selection", async () => {
	const offsets: number[] = []; let fail = true;
	const controller = new CollectionController(async (name, args) => {
		if (name === "get_playlist") return { tracks: [track] };
		offsets.push(Number(args?.offset));
		if (args?.offset === 100 && fail) { fail = false; throw new Error("Page interrupted"); }
		return { data: [{ id: `p.${args?.offset}`, type: "library-playlists", attributes: { name: "Playlist" } }], next: "more" };
	});
	let state!: CollectionState; controller.subscribe(s => { state = s; });
	await controller.load(); await controller.open(state.items[0]!); controller.toggle(track);
	await controller.load("playlists", "catalog", true);
	assert.match(state.error!, /interrupted/); assert.equal(state.items.length, 1);
	assert.equal(state.detail?.item.id, "p.0"); assert.equal(state.selected.length, 1);
	await controller.retryLoad();
	assert.deepEqual(offsets, [0, 100, 100]); assert.equal(state.offset, 100);
	assert.equal(state.items.length, 2); assert.equal(state.detail?.tracks[0]?.id, track.id);
	assert.equal(state.selected.length, 1); assert.equal(state.error, undefined);
});

test("artist to album drill-down preserves pages, selection, and history across failures and stale reads", async () => {
	const pending = deferred<unknown>(); let fail = true;
	const calls: string[] = [];
	const artist = resourceItem({ id: "r.artist", type: "library-artists", attributes: { name: "Artist" } });
	const album = { id: "l.album", type: "library-albums", attributes: { name: "Album" } };
	const controller = new CollectionController(async (name, args) => {
		calls.push(name);
		if (args?.type === "artists") return { items: [album], next_page: "artist-next" };
		if (args?.page) return pending.promise;
		if (fail) throw new Error("Temporary read failure");
		return { items: [{ id: "i.library", type: "library-songs", attributes: { name: "Upload", playParams: { catalogId: "123" } } }], next_page: "album-next" };
	});
	let state!: CollectionState; controller.subscribe(s => { state = s; });
	await controller.open(artist); const child = state.detail!.children[0]!;
	await controller.open(child, true); assert.match(state.detail!.error!, /Temporary/);
	fail = false; await controller.retryDetail();
	assert.deepEqual(state.detail!.parents.map(p => p.id), ["r.artist"]);
	const exact = state.detail!.tracks[0]!; controller.toggle(exact);
	assert.equal(exact.source, "library-api"); assert.equal(exact.id, "i.library");
	const next = controller.moreDetail(); controller.back();
	assert.equal(state.detail!.item.id, "r.artist"); assert.equal(state.detail!.children.length, 1);
	assert.equal(state.detail!.nextPage, "artist-next");
	pending.resolve({ items: [], next_page: null }); await next;
	assert.equal(state.detail!.item.id, "r.artist"); assert.equal(state.selected[0]?.id, "i.library");
	assert.ok(calls.every(name => name === "inspect_api_library"));
});

test("opening an album during artist pagination restores a settled parent that can load its next page", async () => {
	const abandoned = deferred<unknown>(); let pageReads = 0;
	const artist = resourceItem({ id: "r.artist", type: "library-artists", attributes: { name: "Artist" } });
	const album = { id: "l.album", type: "library-albums", attributes: { name: "Album" } };
	const controller = new CollectionController(async (_name, args) => {
		if (args?.type === "albums") return { items: [], next_page: null };
		if (!args?.page) return { items: [album], next_page: "artist-next" };
		return ++pageReads === 1 ? abandoned.promise : { items: [album, { ...album, id: "l.second" }], next_page: null };
	});
	let state!: CollectionState; controller.subscribe(s => { state = s; });
	await controller.open(artist); const child = state.detail!.children[0]!;
	const oldPage = controller.moreDetail(); assert.equal(state.detail!.loading, true);
	await controller.open(child, true); controller.back();
	assert.equal(state.detail!.item.id, artist.id); assert.equal(state.detail!.loading, false);
	assert.equal(state.detail!.nextPage, "artist-next");
	await controller.moreDetail(); assert.equal(pageReads, 2); assert.equal(state.detail!.children.length, 2);
	abandoned.resolve({ items: [], next_page: "obsolete" }); await oldPage;
	assert.equal(state.detail!.children.length, 2); assert.equal(state.detail!.nextPage, undefined);
});
