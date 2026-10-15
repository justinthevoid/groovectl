import { test } from "node:test";
import assert from "node:assert/strict";
import { createTools } from "../src/tools.js";
import { Cider, NoPlayer, type Player } from "../src/players.js";
import { fixture } from "./helpers.js";

test("explicit local player routing preserves the default and never starts playback on selection", async t => {
	const f = fixture(); t.after(() => f.plans.close());
	let defaultReads = 0, defaultCommands = 0, playing = false;
	const calls: { method?: string; endpoint: string }[] = [];
	const defaultPlayer: Player = {
		name: process.platform === "win32" ? "windows" : "native",
		status: async () => { defaultReads++; return { running: true, state: "paused" }; },
		playback: async () => { defaultCommands++; return { running: true, state: "playing" }; },
	};
	const cider = new Cider("http://127.0.0.1:10767", "synthetic-token", async (url, init) => {
		const endpoint = new URL(String(url)).pathname.split("/").at(-1)!;
		calls.push({ method: init?.method, endpoint });
		if (endpoint === "play") playing = true;
		return Response.json(endpoint === "is-playing" ? { is_playing: playing } : endpoint === "volume" ? { volume: 0 } : endpoint === "queue" ? [] : { info: null });
	});
	const tools = createTools(f.music, defaultPlayer, cider);
	const call = (name: string, input: unknown) => tools.find(tool => tool.name === name)!.execute(input);
	const initial = await call("get_playback_state", {});
	assert.equal(initial.selected_player, defaultPlayer.name);
	assert.equal(initial.execution_platform, process.platform);
	assert.equal(calls.length, 0);
	assert.ok((initial.available_players as { id: string; configured: boolean }[]).some(p => p.id === "cider" && p.configured));
	const selected = await call("get_playback_state", { player: "cider" });
	assert.equal(selected.selected_player, "cider");
	assert.equal(selected.state, "paused");
	assert.ok(calls.every(c => c.method === "GET"));
	assert.equal(defaultCommands, 0);
	const played = await call("control_playback", { player: "cider", action: "play" });
	assert.equal(played.state, "playing");
	assert.equal(defaultCommands, 0);
	assert.equal(calls.filter(c => c.method === "POST").length, 1);
	assert.deepEqual((await call("get_playback_queue", { player: "cider" })).tracks, []);
	assert.equal((await call("get_playback_state", {})).selected_player, defaultPlayer.name);
	assert.equal(defaultReads, 2);
});

test("player routing rejects another OS and arbitrary targets before player IO", async t => {
	const f = fixture(); t.after(() => f.plans.close());
	let calls = 0;
	const player: Player = { name: "cider", status: async () => { calls++; return { running: true, state: "paused" }; }, playback: async () => { calls++; return { running: true, state: "playing" }; } };
	const tools = createTools(f.music, player, new Cider("http://127.0.0.1:10767", "synthetic", async () => { calls++; return Response.json({}); }));
	for (const name of ["get_playback_state", "control_playback"]) {
		const tool = tools.find(t => t.name === name)!;
		const action = name === "control_playback" ? { action: "play" } : {};
		await assert.rejects(tool.execute({ ...action, player: process.platform === "win32" ? "native" : "windows" }), /unavailable on this execution host/);
		await assert.rejects(tool.execute({ ...action, player: "ssh://another-host" }));
	}
	assert.equal(calls, 0);
});

test("player choices distinguish local configuration from connection and respect profiles", async t => {
	const f = fixture(); t.after(() => f.plans.close());
	let reads = 0;
	const player: Player = { name: "cider", status: async () => { reads++; return { running: true, state: "paused" }; }, playback: async () => ({ running: true, state: "paused" }) };
	for (const profile of ["catalog", "curator"] as const) {
		const tools = createTools(f.music, player, new Cider("http://127.0.0.1:10767"), profile);
		const caps = await tools.find(t => t.name === "get_capabilities")!.execute({});
		assert.deepEqual(caps.available_players, []);
		assert.ok(!tools.some(t => t.group === "playback"));
	}
	assert.equal(reads, 0);
	const tools = createTools(f.music, player, new Cider("http://127.0.0.1:10767"));
	const caps = await tools.find(t => t.name === "get_capabilities")!.execute({});
	assert.ok((caps.available_players as { id: string; configured: boolean }[]).some(p => p.id === "cider" && !p.configured));
	const apiOnly = createTools(f.music, new NoPlayer(), new Cider("http://127.0.0.1:10767", "synthetic"));
	assert.deepEqual((await apiOnly.find(t => t.name === "get_capabilities")!.execute({})).available_players, []);
});
