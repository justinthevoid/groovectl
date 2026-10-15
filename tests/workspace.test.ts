import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture, track } from "./helpers.js";
import { createTools } from "../src/tools.js";
import { Cider } from "../src/players.js";
import { Studio, ListeningBrief } from "../src/studio.js";
import { PlanSummary } from "../src/workspace-models.js";

test("large plan histories stay compact while exact receipts remain inspectable", async (t) => {
	const f = fixture();
	t.after(() => f.plans.close());
	const tools = createTools(
		f.music,
		{
			name: "native",
			status: () => f.native.status(),
			playback: (r) => f.native.playback(r),
		},
		new Cider("http://127.0.0.1:10767"),
	);
	const recordings = Array.from({ length: 200 }, (_, i) =>
		track(
			(i + 1).toString(16).padStart(16, "0"),
			`Recording ${i} ${"x".repeat(150)}`,
		),
	);
	let last: ReturnType<typeof f.plans.create> | undefined;
	for (let i = 0; i < 20; i++) {
		last = f.plans.create({
			operation: "create",
			source: "native",
			name: `Mixtape ${i}`,
			description: "Full detail stays private until selected",
			tracks: recordings,
			expected_tracks: recordings,
			expected_ids: [],
			audit: {
				duration_minutes: 600,
				version_qualifiers: ["alternate recording"],
			},
			duplicates_removed: 0,
		});
		f.plans.finish(last.plan_id, i === 19 ? "unknown" : "applied", {
			accepted_playlist_id: "receipt-must-survive",
			playlist: { tracks: recordings },
			retry_safe: false,
		});
	}
	const before = JSON.stringify(f.plans.recent());
	const workspace = await tools
		.find((tool) => tool.name === "get_music_workspace")!
		.execute({});
	const summaries = (workspace.plans as unknown[]).map((p) =>
		PlanSummary.parse(p),
	);
	assert.equal(summaries.length, 20);
	assert.equal(summaries[0].state, "unknown");
	assert.equal(summaries[0].track_count, 200);
	assert.equal(summaries[0].has_result, true);
	const size = Buffer.byteLength(JSON.stringify(workspace));
	assert.ok(size < 20000, `Workspace grew to ${size} bytes`);
	assert.ok(size < Buffer.byteLength(before) / 50);
	assert.ok(!JSON.stringify(workspace).includes("receipt-must-survive"));
	assert.ok(!JSON.stringify(workspace).includes("Recording 199"));
	const inspected = await tools
		.find((tool) => tool.name === "inspect_playlist_plan")!
		.execute({ plan_id: last!.plan_id });
	assert.deepEqual(inspected, f.plans.get(last!.plan_id));
	assert.equal(
		(inspected.result as { accepted_playlist_id: string }).accepted_playlist_id,
		"receipt-must-survive",
	);
	assert.equal(JSON.stringify(f.plans.recent()), before);
	assert.equal(f.native.writes, 0);
});

test("workspace and studio lists omit interview histories; selected drafts preserve constraints and ideas", async (t) => {
	const f = fixture();
	t.after(() => f.plans.close());
	const studio = new Studio(f.root);
	const brief = ListeningBrief.parse({
		title: "Saved brief",
		intent: "private intent ".repeat(100),
		explicit: "avoid",
		exclude: ["no live versions"],
		cover_direction: "private cover direction",
	});
	let saved: ReturnType<typeof studio.save> | undefined;
	for (let i = 0; i < 20; i++)
		saved = studio.save(brief, "deep", undefined, {
			locked: ["title"],
			suggestions: {
				mood: [{ label: "A quiet turn", value: "private suggestion" }],
			},
		});
	const tools = createTools(
		f.music,
		{
			name: "native",
			status: () => f.native.status(),
			playback: (r) => f.native.playback(r),
		},
		new Cider("http://127.0.0.1:10767"),
	);
	for (const name of [
		"open_music",
		"get_music_workspace",
		"get_playlist_studio",
	]) {
		const summary = await tools.find((tool) => tool.name === name)!.execute({});
		const text = JSON.stringify(summary);
		assert.ok(Buffer.byteLength(text) < 20000);
		for (const omitted of [
			"private intent",
			"private cover direction",
			"private suggestion",
			"no live versions",
		])
			assert.ok(
				!text.includes(omitted),
				`${name} leaked unselected ${omitted}`,
			);
	}
	const selected = await tools
		.find((tool) => tool.name === "get_playlist_studio")!
		.execute({ draft_id: saved!.draft_id });
	assert.deepEqual(selected.draft, studio.get(saved!.draft_id));
	assert.equal(f.native.writes, 0);
});
