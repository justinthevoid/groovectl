import { test } from "node:test";
import assert from "node:assert/strict";
import { Curation, comparePlaylists, sequenceTracks } from "../src/curation.js";
import { fixture, A, B, C, P, track } from "./helpers.js";
import { checkPair } from "../src/flow.js";

test("an absent energy estimate is not silently treated as zero", () => {
	assert.deepEqual(
		checkPair({ id: "a", bpm: 120, energy: 0.9 }, { id: "b", bpm: 90 }),
		[],
	);
	assert.deepEqual(
		checkPair(
			{ id: "a", bpm: 120, energy: null },
			{ id: "b", bpm: 90, energy: 0.9 },
		),
		[],
	);
	assert.ok(
		checkPair(
			{ id: "a", bpm: 120, energy: 0.9 },
			{ id: "b", bpm: 90, energy: 0 },
		).includes("energy_clash"),
	);
});
test("a fuzzy artist/title suggestion is review-needed rather than an exact recording claim", async () => {
	const f = fixture();
	try {
		f.music.catalog.search = async () => [
			{
				...track(),
				source: "catalog",
				id: "123",
				name: "Love You",
				artist: "Air Supply",
			},
		];
		const fuzzy = await f.music.resolve("Love", "Air");
		assert.equal(fuzzy.match?.id, "123");
		assert.equal(fuzzy.needs_review, true);
		f.music.catalog.search = async () => [
			{
				...track(),
				source: "catalog",
				id: "456",
				name: "Alive",
				artist: "Pearl Jam",
			},
		];
		assert.equal(
			(await f.music.resolve("alive", "PEARL JAM")).needs_review,
			false,
		);
	} finally {
		f.plans.close();
	}
});

test("M3U export reports every omitted link and rejects line injection and other origins", async () => {
	const f = fixture();
	try {
		f.native.songs.get(A)!.url =
			"https://music.apple.com/us/album/example/123?i=456";
		f.native.songs.get(B)!.url = "https://example.invalid/audio.mp3";
		f.native.songs.get(C)!.url =
			"https://music.apple.com/us/album/example/123\n#EXTINF:3,Injected";
		const d = "0000000000000004";
		f.native.songs.set(d, track(d));
		await f.native.create("Export fixture", [A, B, C, d]);
		const result = await new Curation(f.music).export("native", P, "m3u8");
		assert.equal(result.omitted_tracks_without_catalog_url, 3);
		assert.ok(
			result.content.includes(
				"https://music.apple.com/us/album/example/123?i=456",
			),
		);
		assert.equal(result.content.includes("example.invalid"), false);
		assert.equal(result.content.includes("Injected"), false);
	} finally {
		f.plans.close();
	}
});
test("sequencing preserves every recording and reports impossible artist spacing", () => {
	const tracks = [
		track(A, "One", "Same"),
		track(B, "Two", "Same"),
		track(C, "Three", "Other"),
	];
	const result = sequenceTracks(tracks, { artist_gap: 1 });
	assert.deepEqual(
		(result.tracks as typeof tracks).map((t) => t.id),
		[A, C, B],
	);
	assert.deepEqual(result.artist_spacing_conflicts, []);
	const impossible = sequenceTracks(tracks.slice(0, 2), { artist_gap: 2 });
	assert.equal((impossible.artist_spacing_conflicts as unknown[]).length, 1);
});
test("energy arc requires actual supplied estimates", () =>
	assert.throws(
		() => sequenceTracks([track()], { artist_gap: 2, energy_arc: "peak" }),
		/requires user-supplied/,
	));
test("snapshots round-trip into a new verified preview without changing the original", async () => {
	const f = fixture();
	await f.native.create("Original", [A, B]);
	const curation = new Curation(f.music);
	const s = await curation.snapshot("native", P),
		restored = await curation.restore(s.snapshot_id, "Restored");
	assert.equal(restored.payload.operation, "create");
	assert.deepEqual(
		restored.payload.tracks.map((t) => t.id),
		[A, B],
	);
	assert.equal(curation.snapshots().snapshots.length, 1);
	assert.equal(f.native.writes, 1);
	assert.equal((await f.native.playlist(P)).name, "Original");
	assert.throws(() => curation.readSnapshot("../user.json"));
	f.plans.close();
});
test("export/import revalidates recordings rather than trusting embedded metadata", async () => {
	const f = fixture();
	await f.native.create("Original", [A]);
	const c = new Curation(f.music);
	const exported = await c.export("native", P, "json"),
		document = JSON.parse(exported.content);
	document.playlist.tracks[0].name = "Forged";
	const preview = await c.importPreview("Import", JSON.stringify(document));
	assert.equal(preview.payload.tracks[0]?.name, "Alive");
	assert.equal(f.native.writes, 1);
	f.plans.close();
});
test("comparison uses recording IDs and reports order changes", () => {
	const a = {
			source: "native" as const,
			id: P,
			name: "A",
			tracks: [track(A), track(B)],
		},
		b = { ...a, name: "B", tracks: [track(B), track(A)] };
	const diff = comparePlaylists(a, b);
	assert.equal(diff.same_order, false);
	assert.equal(diff.moved.length, 2);
	assert.deepEqual(diff.only_in_first, []);
});
