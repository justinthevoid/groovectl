import { test } from "node:test";
import assert from "node:assert/strict";
import { NoPlayer, playerCapabilities, Cider } from "../src/players.js";
import { createTools } from "../src/tools.js";
import { fixture } from "./helpers.js";

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
