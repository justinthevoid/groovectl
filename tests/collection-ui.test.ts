import { test } from "node:test";
import assert from "node:assert/strict";
import { CollectionController, type CollectionState } from "../ui/collection-controller.js";
import { PlaybackController, type PlayerState } from "../ui/playback-controller.js";
import { artworkUrl, collectionPage, formatTime, resourceItem, targetFor } from "../ui/music-model.js";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(r => { resolve = r; });
	return { promise, resolve };
}
const track = { source: "catalog" as const, id: "101", name: "Fixture", artist: "Synthetic", album: "", duration_ms: 220000 };
const paused = { running: true, state: "paused", selected_player: "cider", volume: 0, position: 0,
	track, capabilities: { available: true, actions: ["play", "pause", "volume"] } };

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
	assert.match(state.error!, /unavailable/);
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
