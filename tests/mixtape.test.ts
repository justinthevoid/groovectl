import { test } from "node:test";
import assert from "node:assert/strict";
import { sequenceTracks, Curation } from "../src/curation.js";
import {
	ListeningStory,
	validateStory,
	storyReport,
	recipes,
} from "../src/mixtape.js";
import { fixture, track, A, B, C, P } from "./helpers.js";
import { MusicService } from "../src/service.js";
import { Plans } from "../src/storage.js";

const ref = (id: string) => ({ source: "native" as const, id });
const story = () =>
	ListeningStory.parse({
		recipe: "side-a-side-b",
		chapters: [
			{ title: "Side A", purpose: "A warm invitation", start: 1, end: 2 },
			{ title: "Side B", start: 3, end: 3 },
		],
		anchors: [{ track: ref(B), position: 1 }],
		runtime_budget_minutes: 10,
	});

test("sequencing reserves anchors and keeps every recording inside its chapter", () => {
	const tracks = [track(A), track(B), track(C)];
	const result = sequenceTracks(tracks, { artist_gap: 1, story: story() });
	assert.deepEqual(
		(result.tracks as typeof tracks).map((t) => t.id),
		[B, A, C],
	);
	assert.deepEqual(result.original_positions, [2, 1, 3]);
	assert.deepEqual(
		(result.listening_story as ReturnType<typeof storyReport>).chapters.map(
			(c) => c.duration_minutes,
		),
		[6, 3],
	);
	assert.equal(
		(result.listening_story as ReturnType<typeof storyReport>).runtime.status,
		"within_budget",
	);
});
test("pinned artist conflicts are reported rather than silently moving an anchor", () => {
	const tracks = [track(A), track(B), track(C)];
	const input = ListeningStory.parse({
		anchors: [
			{ track: ref(A), position: 1 },
			{ track: ref(B), position: 2 },
		],
		runtime_budget_minutes: 1,
		runtime_tolerance_minutes: 0,
	});
	const result = sequenceTracks(tracks, { artist_gap: 2, story: input });
	assert.deepEqual(
		(result.tracks as typeof tracks).map((t) => t.id),
		[A, B, C],
	);
	assert.equal((result.artist_spacing_conflicts as unknown[]).length, 2);
	assert.equal(
		(result.listening_story as ReturnType<typeof storyReport>).runtime.status,
		"over_budget",
	);
	assert.equal((result.tracks as typeof tracks).length, 3);
});
test("gaps, overlaps, out-of-range pins and cross-chapter moves fail before sequencing", () => {
	const tracks = [track(A), track(B), track(C)];
	for (const chapters of [
		[{ title: "Gap", start: 2, end: 3 }],
		[
			{ title: "Overlap", start: 1, end: 2 },
			{ title: "Again", start: 2, end: 3 },
		],
		[{ title: "Truncated", start: 1, end: 2 }],
	])
		assert.throws(
			() => validateStory({ chapters }, tracks, false),
			/cover every recording/,
		);
	assert.throws(
		() =>
			validateStory(
				{ ...story(), anchors: [{ track: ref(A), position: 3 }] },
				tracks,
				false,
			),
		/cannot leave/,
	);
	assert.throws(
		() =>
			validateStory(
				{ anchors: [{ track: ref(A), position: 4 }] },
				tracks,
				false,
			),
		/valid final position/,
	);
	assert.throws(
		() =>
			validateStory(
				{
					anchors: [
						{ track: ref(A), position: 1 },
						{ track: ref(A), position: 2 },
					],
				},
				tracks,
				false,
			),
		/unique/,
	);
});
test("stories reject duplicate aliases and unknown durations never qualify a runtime budget", () => {
	assert.throws(
		() => validateStory({}, [track(A), track(A)]),
		/duplicate recordings/,
	);
	const a = {
		...track(),
		source: "catalog" as const,
		id: "123",
		catalog_id: "123",
	};
	const b = {
		...a,
		source: "library-api" as const,
		id: "i.import",
		library_id: "i.import",
	};
	assert.throws(() => validateStory({}, [a, b]), /duplicate recordings/);
	const report = storyReport(
		[{ ...track(), duration_ms: 0 }],
		ListeningStory.parse({ runtime_budget_minutes: 30 }),
	);
	assert.equal(report.runtime.status, "incomplete");
	assert.equal(report.runtime.difference_minutes, null);
	assert.equal(report.runtime.missing_duration_count, 1);
});
test("a preview checks final anchor positions and cannot silently deduplicate a story", async () => {
	const f = fixture();
	try {
		await assert.rejects(
			f.music.preview(
				"Wrong",
				[ref(A), ref(B), ref(C)],
				"",
				undefined,
				[],
				undefined,
				story(),
			),
			/Pinned anchors/,
		);
		await assert.rejects(
			f.music.preview(
				"Repeated",
				[ref(A), ref(A)],
				"",
				undefined,
				[],
				undefined,
				ListeningStory.parse({}),
			),
			/duplicate recordings/,
		);
		assert.equal(f.native.writes, 0);
	} finally {
		f.plans.close();
	}
});
test("a verified write preserves its story across restart, snapshots, JSON export and import", async () => {
	const f = fixture();
	try {
		const plan = await f.music.preview(
			"Mixtape",
			[ref(B), ref(A), ref(C)],
			"",
			undefined,
			[],
			undefined,
			story(),
		);
		assert.equal(
			(plan.payload.listening_story as ReturnType<typeof storyReport>)
				.chapters[0]?.title,
			"Side A",
		);
		const applied = await f.music.apply(plan.plan_id);
		assert.deepEqual(applied.result?.story_storage, { saved: true });
		assert.equal(f.native.writes, 1);
		const secondPlans = new Plans(f.root);
		try {
			const music = new MusicService(f.native, f.music.catalog, secondPlans),
				c = new Curation(music);
			const playlist = await music.getPlaylist("native", P);
			assert.equal(playlist.story_status, "current");
			const snapshot = await c.snapshot("native", P);
			const restore = await c.restore(snapshot.snapshot_id, "Restored");
			assert.deepEqual(restore.payload.story, story());
			const exported = await c.export("native", P, "json");
			const imported = await c.importPreview("Imported", exported.content);
			assert.deepEqual(imported.payload.story, story());
			assert.equal(f.native.writes, 1);
		} finally {
			secondPlans.close();
		}
	} finally {
		f.plans.close();
	}
});
test("external order/name changes mark chapter metadata stale instead of attaching a false story", async () => {
	const f = fixture();
	try {
		const plan = await f.music.preview(
			"Mixtape",
			[ref(B), ref(A), ref(C)],
			"",
			undefined,
			[],
			undefined,
			story(),
		);
		await f.music.apply(plan.plan_id);
		f.native.items.get(P)!.tracks.reverse();
		const playlist = await f.music.getPlaylist("native", P);
		assert.equal(playlist.story_status, "stale");
		assert.equal(playlist.story, undefined);
		const exported = JSON.parse(
			(await new Curation(f.music).export("native", P, "json")).content,
		);
		assert.equal(exported.playlist.story, undefined);
	} finally {
		f.plans.close();
	}
});
test("a local story-storage failure does not turn a verified music write into an unknown or repeat it", async () => {
	const f = fixture();
	try {
		f.music.stories.remember = () => {
			throw new Error("Synthetic storage failure");
		};
		const plan = await f.music.preview(
			"Mixtape",
			[ref(B), ref(A), ref(C)],
			"",
			undefined,
			[],
			undefined,
			story(),
		);
		const applied = await f.music.apply(plan.plan_id);
		assert.equal(applied.state, "applied");
		assert.equal(
			(applied.result?.story_storage as { saved: boolean }).saved,
			false,
		);
		assert.deepEqual(await f.music.apply(plan.plan_id), applied);
		assert.equal(f.native.writes, 1);
	} finally {
		f.plans.close();
	}
});
test("an unverified write never publishes chapter metadata as current", async () => {
	const f = fixture();
	try {
		f.native.reverseReadback = true;
		const plan = await f.music.preview(
			"Mixtape",
			[ref(B), ref(A), ref(C)],
			"",
			undefined,
			[],
			undefined,
			story(),
		);
		assert.equal((await f.music.apply(plan.plan_id)).state, "needs_review");
		assert.equal(
			(await f.music.getPlaylist("native", P)).story_status,
			"absent",
		);
	} finally {
		f.plans.close();
	}
});
test("recipes offer guidance without inventing selections, listening history or measurements", () => {
	assert.equal(new Set(recipes.map((r) => r.id)).size, 6);
	for (const recipe of recipes)
		assert.ok(recipe.chapters.length && recipe.question && recipe.prompt);
	assert.match(
		recipes.find((r) => r.id === "rediscovery")!.prompt,
		/bounded library sample/,
	);
});
test("album-flight chapters can preserve their exact internal recording order", () => {
	const tracks = [
		track(A, "First", "Same"),
		track(B, "Second", "Same"),
		track(C, "Third", "Other"),
	];
	const input = ListeningStory.parse({
		recipe: "album-flight",
		chapters: [
			{ title: "Complete mini-run", start: 1, end: 3, ordering: "preserve" },
		],
	});
	const result = sequenceTracks(tracks, { artist_gap: 1, story: input });
	assert.deepEqual(
		(result.tracks as typeof tracks).map((t) => t.id),
		[A, B, C],
	);
	assert.equal((result.artist_spacing_conflicts as unknown[]).length, 1);
	assert.throws(
		() =>
			validateStory(
				{ ...input, anchors: [{ track: ref(B), position: 1 }] },
				tracks,
				false,
			),
		/cannot reorder/,
	);
});
