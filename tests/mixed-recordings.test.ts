import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { MusicService } from "../src/service.js";
import { TrackRef } from "../src/models.js";
import { sameRecording } from "../src/identity.js";
import { fixture, A } from "./helpers.js";

test("new API playlists can select a reviewed parent folder and verify membership", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.music.preview(
		"Filed",
		mixed,
		"",
		undefined,
		[],
		"p.parent",
	);
	const result = await f.music.apply(plan.plan_id);
	assert.equal(result.state, "applied");
	assert.equal(result.result?.parent_verified, true);
	assert.deepEqual(
		(
			f.writes[0]?.body.relationships as unknown as {
				parent: { data: Entry[] };
			}
		).parent.data,
		[{ id: "p.parent", type: "library-playlist-folders" }],
	);
});

test("folder placement rejects stale parents and leaves unverified membership for review", async (t) => {
	const stale = setup();
	t.after(() => stale.plans.close());
	const plan = await stale.music.preview(
		"Stale",
		mixed,
		"",
		undefined,
		[],
		"p.parent",
	);
	stale.renameParent();
	await assert.rejects(
		stale.music.apply(plan.plan_id),
		/Parent folder changed/,
	);
	assert.equal(stale.writes.length, 0);
	const missing = setup();
	t.after(() => missing.plans.close());
	const next = await missing.music.preview(
		"Missing",
		mixed,
		"",
		undefined,
		[],
		"p.parent",
	);
	missing.missingParent();
	assert.equal((await missing.music.apply(next.plan_id)).state, "needs_review");
	assert.equal(missing.plans.get(next.plan_id).result?.order_verified, true);
	assert.equal(missing.plans.get(next.plan_id).result?.parent_verified, false);
	await assert.rejects(missing.music.apply(next.plan_id), /needs_review/);
	assert.equal(missing.writes.length, 1);
});

test("native creation and API append cannot relocate a playlist through the parent option", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	await assert.rejects(
		f.music.preview(
			"Native",
			[{ source: "native", id: A }],
			"",
			undefined,
			[],
			"p.parent",
		),
		/only for a new API playlist/,
	);
	f.seed([{ type: "songs", id: "101" }]);
	await assert.rejects(
		f.music.preview("", mixed, "", "p.created", [], "p.parent"),
		/only for a new API playlist/,
	);
	assert.equal(f.writes.length, 0);
});

type Entry = { id: string; type: string };
const recordings = new Map([
	[
		"101",
		{
			name: "Catalog recording",
			artistName: "First artist",
			durationInMillis: 180000,
			playParams: { id: "101" },
		},
	],
	[
		"102",
		{
			name: "Second recording",
			artistName: "Second artist",
			durationInMillis: 210000,
			playParams: { id: "102" },
		},
	],
]);
const library = new Map([
	[
		"i.mapped",
		{
			name: "Catalog recording",
			artistName: "First artist",
			durationInMillis: 180000,
			playParams: { catalogId: "101" },
		},
	],
	[
		"i.local",
		{
			name: "Private import",
			artistName: "Local artist",
			durationInMillis: 240000,
		},
	],
]);
function setup() {
	const f = fixture();
	const writes: Array<{
		path: string;
		body: { relationships?: { tracks: { data: Entry[] } }; data?: Entry[] };
	}> = [];
	let items: Entry[] = [],
		failReadback = false,
		reverseReadback = false,
		videoReadback = false;
	let parentName = "Playlists",
		folderContains = true;
	const fetcher = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = new URL(String(input)),
			path = url.pathname;
		const response = (data: unknown) =>
			new Response(JSON.stringify({ data }), {
				headers: { "Content-Type": "application/json" },
			});
		if (init?.method === "POST") {
			const body = JSON.parse(String(init.body));
			writes.push({ path, body });
			items = path.endsWith("/tracks")
				? [...items, ...body.data]
				: body.relationships.tracks.data;
			return path.endsWith("/tracks")
				? new Response(null, { status: 204 })
				: response([{ id: "p.created", type: "library-playlists" }]);
		}
		if (path === "/v1/catalog/us/songs" || path === "/v1/me/library/songs") {
			const personal = path.includes("/me/"),
				table = personal ? library : recordings;
			if (personal)
				assert.equal(
					new Headers(init?.headers).get("Music-User-Token"),
					"synthetic-user-token",
				);
			return response(
				url.searchParams
					.get("ids")!
					.split(",")
					.flatMap((id) =>
						table.has(id)
							? [
									{
										id,
										type: personal ? "library-songs" : "songs",
										attributes: table.get(id),
									},
								]
							: [],
					),
			);
		}
		if (failReadback && writes.length)
			throw new Error("synthetic readback timeout");
		if (path === "/v1/me/library/playlist-folders/p.parent")
			return response([
				{
					id: "p.parent",
					type: "library-playlist-folders",
					attributes: { name: parentName },
				},
			]);
		if (path === "/v1/me/library/playlist-folders/p.parent/children")
			return response(
				folderContains ? [{ id: "p.created", type: "library-playlists" }] : [],
			);
		if (path === "/v1/me/library/playlists/p.created")
			return response([
				{ id: "p.created", attributes: { name: "Mixed", canEdit: true } },
			]);
		if (path === "/v1/me/library/playlists/p.created/tracks") {
			const rows = items.map((item) =>
				item.type === "songs"
					? {
							id: "i.cat" + item.id,
							type: videoReadback ? "library-music-videos" : "library-songs",
							attributes: {
								...recordings.get(item.id),
								playParams: { catalogId: item.id },
							},
						}
					: {
							id: item.id,
							type: "library-songs",
							attributes: library.get(item.id),
						},
			);
			return response(reverseReadback ? rows.reverse() : rows);
		}
		throw new Error("Unexpected fixture request " + path);
	}) as typeof fetch;
	class Catalog extends AppleCatalog {
		override async developerToken() {
			return "synthetic-developer-token";
		}
		override userToken() {
			return "synthetic-user-token";
		}
		override readiness() {
			return {
				developer_key_configured: true,
				user_authorized: true,
				storefront: "us",
			};
		}
	}
	const catalog = new Catalog(f.root, fetcher);
	return {
		...f,
		catalog,
		music: new MusicService(f.native, catalog, f.plans),
		writes,
		renameParent() {
			parentName = "Renamed";
		},
		missingParent() {
			folderContains = false;
		},
		seed(value: Entry[]) {
			items = value;
		},
		fail() {
			failReadback = true;
		},
		reverse() {
			reverseReadback = true;
		},
		video() {
			videoReadback = true;
		},
	};
}
const mixed = [
	{ source: "catalog", id: "102" },
	{ source: "library-api", id: "i.local" },
] satisfies TrackRef[];

test("API playlist creation preserves mixed references, private imports, identity and exact order", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.music.preview("Mixed", mixed);
	assert.deepEqual(
		plan.payload.tracks.map((track) => [track.source, track.id]),
		[
			["catalog", "102"],
			["library-api", "i.local"],
		],
	);
	assert.equal((await f.music.apply(plan.plan_id)).state, "applied");
	assert.deepEqual(f.writes[0]?.body.relationships?.tracks.data, [
		{ id: "102", type: "songs" },
		{ id: "i.local", type: "library-songs" },
	]);
	await f.music.apply(plan.plan_id);
	assert.equal(f.writes.length, 1);
});

test("API aliases deduplicate across namespaces without treating identical titles as identity", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.music.preview("Aliases", [
		{ source: "catalog", id: "101" },
		{ source: "library-api", id: "i.mapped" },
		{ source: "library-api", id: "i.local" },
	]);
	assert.equal(plan.payload.duplicates_removed, 1);
	assert.equal(plan.payload.tracks.length, 2);
	assert.equal(
		sameRecording(plan.payload.tracks[0]!, {
			...plan.payload.tracks[0]!,
			id: "102",
		}),
		false,
	);
});

test("a library reference mapped to catalog identity verifies through readback", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.music.preview("Mapped", [
		{ source: "library-api", id: "i.mapped" },
	]);
	assert.equal((await f.music.apply(plan.plan_id)).state, "applied");
	assert.deepEqual(f.writes[0]?.body.relationships?.tracks.data, [
		{ id: "i.mapped", type: "library-songs" },
	]);
});

test("append removes existing Apple aliases and verifies the entire resulting order", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	f.seed([{ type: "songs", id: "101" }]);
	const plan = await f.music.preview(
		"",
		[{ source: "library-api", id: "i.mapped" }, ...mixed],
		"",
		"p.created",
	);
	assert.equal(plan.payload.duplicates_removed, 1);
	assert.equal((await f.music.apply(plan.plan_id)).state, "applied");
	assert.deepEqual(f.writes[0]?.body.data, [
		{ id: "102", type: "songs" },
		{ id: "i.local", type: "library-songs" },
	]);
});

test("mixed readback order changes and video substitutions require review without retry", async (t) => {
	for (const mode of ["reverse", "video"] as const) {
		const f = setup();
		t.after(() => f.plans.close());
		f[mode]();
		const plan = await f.music.preview("Review", mixed);
		assert.equal((await f.music.apply(plan.plan_id)).state, "needs_review");
		await assert.rejects(f.music.apply(plan.plan_id), /needs_review/);
		assert.equal(f.writes.length, 1);
	}
});

test("missing library IDs and mixed native/API backends fail before a write", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	await assert.rejects(
		f.music.preview("Missing", [{ source: "library-api", id: "i.missing" }]),
		/unavailable/,
	);
	await assert.rejects(
		f.music.preview("Wrong backend", [{ source: "native", id: A }, ...mixed]),
		/one source backend/,
	);
	assert.equal(f.writes.length, 0);
	assert.throws(() =>
		TrackRef.parse({ source: "library-api", id: "../private" }),
	);
});

test("a returned API playlist ID survives readback failure and blocks replay", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.music.preview("Timeout", mixed);
	f.fail();
	await assert.rejects(
		f.music.apply(plan.plan_id),
		/blocked from automatic retry/,
	);
	assert.equal(
		f.plans.get(plan.plan_id).result?.accepted_playlist_id,
		"p.created",
	);
	await assert.rejects(f.music.apply(plan.plan_id), /unknown/);
	assert.equal(f.writes.length, 1);
});

test("pre-migration plans without alias-aware expected tracks still use legacy verification", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const current = await f.music.preview("Legacy", [
		{ source: "catalog", id: "101" },
	]);
	const { expected_tracks, ...legacy } = current.payload;
	assert.ok(expected_tracks);
	const plan = f.plans.create(legacy);
	assert.equal((await f.music.apply(plan.plan_id)).state, "applied");
});
