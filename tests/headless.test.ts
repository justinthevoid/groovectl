import { test } from "node:test";
import assert from "node:assert/strict";
import {
	NoPlayer,
	playerCapabilities,
	sessionCapabilities,
	Cider,
} from "../src/players.js";

test("Windows workspace controls follow the live session and recover as it becomes playable", () => {
	assert.deepEqual(
		sessionCapabilities(
			"windows",
			{
				running: true,
				capabilities: { play: true, pause: false, seek: false, next: false },
			},
			"win32",
		).actions,
		["play"],
	);
	assert.deepEqual(
		sessionCapabilities(
			"windows",
			{
				running: true,
				capabilities: { play: false, pause: true, seek: true, next: false },
			},
			"win32",
		).actions,
		["pause", "seek"],
	);
	for (const status of [
		{ running: false },
		{ running: true },
		{ running: true, capabilities: { play: "yes" } },
	])
		assert.deepEqual(
			sessionCapabilities("windows", status, "win32").actions,
			[],
		);
	assert.deepEqual(
		sessionCapabilities(
			"windows",
			{ running: true, capabilities: { play: true } },
			"linux",
		).actions,
		[],
	);
	assert.equal(
		sessionCapabilities(
			"windows",
			{ running: true, capabilities: { volume: true } },
			"win32",
		).volume,
		false,
	);
});
import { createTools } from "../src/tools.js";
import { fixture } from "./helpers.js";

test("playback tools preserve raw session capabilities and add the shared player projection", async t => {
	const f = fixture(); t.after(() => f.plans.close());
	let commands = 0;
	const player = { name: "cider" as const,
		status: async () => ({ running: true, state: "paused", capabilities: { pause: true } }),
		playback: async () => { commands++; return { running: true, state: "playing", volume: 0, capabilities: { play: false, pause: true } }; },
	};
	const tools = createTools(f.music, player, new Cider("http://127.0.0.1:10767"));
	const read = await tools.find(t => t.name === "get_playback_state")!.execute({});
	assert.deepEqual(read.capabilities, { pause: true });
	assert.equal(read.selected_player, "cider");
	assert.ok((read.player_capabilities as { actions: string[] }).actions.includes("play"));
	const command = await tools.find(t => t.name === "control_playback")!.execute({ action: "play" });
	assert.deepEqual(command.capabilities, { play: false, pause: true });
	assert.equal(command.state, "playing"); assert.equal(command.volume, 0); assert.equal(commands, 1);
});

test("API-only mode keeps useful curation/library tools and omits playback commands", async (t) => {
	const f = fixture();
	t.after(() => f.plans.close());
	const player = new NoPlayer(),
		tools = createTools(f.music, player, new Cider("http://127.0.0.1:10767"));
	assert.equal((await player.status()).state, "api-only");
	await assert.rejects(
		player.playback({ action: "play" }),
		/No desktop player/,
	);
	assert.ok(!tools.some((tool) => tool.group === "playback"));
	assert.ok(tools.some((tool) => tool.name === "preview_playlist"));
	assert.ok(tools.some((tool) => tool.name === "browse_library_folders"));
	const capability = await tools
		.find((tool) => tool.name === "get_capabilities")!
		.execute({});
	assert.deepEqual((capability.playback as { actions: string[] }).actions, []);
	const workspace = await tools
		.find((tool) => tool.name === "get_music_workspace")!
		.execute({});
	assert.equal((workspace.player as { state: string }).state, "api-only");
});

test("capabilities distinguish adapter support, runtime OS and actual connection checks", () => {
	assert.deepEqual(playerCapabilities("native", "linux").actions, []);
	assert.equal(playerCapabilities("native", "darwin").targeted_play, true);
	assert.deepEqual(playerCapabilities("windows", "darwin").actions, []);
	assert.equal(playerCapabilities("windows", "win32").volume, false);
	assert.equal(playerCapabilities("cider", "linux").queue, true);
	assert.match(
		playerCapabilities("cider", "linux").qualification,
		/not a connection check/,
	);
});
test("catalog/curator profiles expose their actual tool set and do not probe an excluded player", async (t) => {
	const f = fixture();
	t.after(() => f.plans.close());
	let probes = 0;
	const player = {
		name: "cider" as const,
		status: async () => {
			probes++;
			return { running: true, state: "playing" };
		},
		playback: async () => ({ running: true, state: "playing" }),
	};
	for (const profile of ["catalog", "curator"] as const) {
		const tools = createTools(
			f.music,
			player,
			new Cider("http://127.0.0.1:10767"),
			profile,
		);
		const workspace = await tools
			.find((t) => t.name === "get_music_workspace")!
			.execute({});
		assert.deepEqual(
			workspace.available_tools,
			tools.map((t) => t.name),
		);
		assert.equal(workspace.tool_profile, profile);
		assert.equal(
			(workspace.player as { state: string }).state,
			"profile-limited",
		);
		const capability = await tools
			.find((t) => t.name === "get_capabilities")!
			.execute({});
		assert.deepEqual(
			(capability.playback as { actions: string[] }).actions,
			[],
		);
		assert.equal(capability.queue, false);
	}
	assert.equal(probes, 0);
});
