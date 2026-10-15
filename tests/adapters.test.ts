import { test } from "node:test";
import assert from "node:assert/strict";
import { Cider, MacMusic, loopbackURL } from "../src/players.js";
import { AppleCatalog } from "../src/catalog.js";
import { PlaybackRequest, apiId, TrackRef } from "../src/models.js";
import { root } from "./helpers.js";

test("Apple resource IDs cannot normalize into another endpoint before network IO", async () => {
	let requests = 0;
	const catalog = new AppleCatalog(root(), async () => {
		requests++;
		throw new Error("Unexpected network request");
	});
	for (const id of [".", "..", "p..other", "../songs", "%2e"]) {
		assert.throws(() => apiId(id));
		assert.throws(() => TrackRef.parse({ source: "library-api", id }));
		await assert.rejects(catalog.browse("albums", id));
	}
	assert.equal(requests, 0);
	assert.equal(apiId("p.valid-123"), "p.valid-123");
});

test("native creation records the accepted playlist before attempting additions", async () => {
	const events: string[] = [],
		id = "ABCDEF0123456789",
		track = "0123456789ABCDEF";
	class FixedBridge extends MacMusic {
		override async request(op: string): Promise<unknown> {
			events.push(op);
			if (op === "create") return { id };
			if (op === "append") throw new Error("Interrupted add");
			throw new Error("Unexpected operation");
		}
	}
	await assert.rejects(
		new FixedBridge().create("Test", [track], "", () => {
			events.push("journal");
		}),
		/Interrupted add/,
	);
	assert.deepEqual(events, ["create", "journal", "append"]);
});

test("playback validation rejects out-of-range and ambiguous operations before IO", () => {
	for (const r of [
		{ action: "volume", value: 101 },
		{ action: "volume", value: 0.5 },
		{ action: "seek", value: -1 },
		{ action: "pause", track_id: "1" },
		{ action: "play", track_id: "1", playlist_id: "2" },
		{ action: "repeat", value: 3 },
	])
		assert.throws(() => PlaybackRequest.parse(r));
});
test("Cider refuses remote URLs, credentials and path injection", () => {
	for (const url of [
		"https://localhost:10767",
		"http://example.com:10767",
		"http://127.0.0.1:10767/private",
		"http://user:pass@localhost:10767",
		"http://127.0.0.1:10767?token=secret",
	])
		assert.throws(() => loopbackURL(url));
	assert.equal(loopbackURL("http://[::1]:10767").hostname, "[::1]");
});
test("Cider scales volume to its documented range and never sends token in URL", async () => {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const fetcher: typeof fetch = async (url, init) => {
		calls.push({ url: String(url), init });
		const path = new URL(String(url)).pathname.split("/").at(-1);
		const result =
			path === "now-playing"
				? {
						info: {
							name: "Song",
							artistName: "Artist",
							albumName: "Album",
							playParams: { id: "1234" },
							currentPlaybackTime: 10,
						},
					}
				: path === "is-playing"
					? { is_playing: false }
					: path === "volume" && init?.method === "GET"
						? { volume: 0.42 }
						: { status: "ok" };
		return Response.json(result);
	};
	const cider = new Cider("http://127.0.0.1:10767", "synthetic-token", fetcher);
	const state = await cider.playback({ action: "volume", value: 42 });
	assert.equal(calls[0]?.init?.body, '{"volume":0.42}');
	assert.equal(state.volume, 42);
	assert.ok(calls.every((c) => !c.url.includes("synthetic-token")));
	assert.equal(
		new Headers(calls[0]?.init?.headers).get("apptoken"),
		"synthetic-token",
	);
});
test("Cider HTTP failure cannot retry a command or expose a token-bearing body", async () => {
	let calls = 0;
	const cider = new Cider("http://127.0.0.1:10767", "secret", async () => {
		calls++;
		return new Response("secret", { status: 403 });
	});
	await assert.rejects(
		cider.playback({ action: "play" }),
		(error) =>
			error instanceof Error &&
			/403/.test(error.message) &&
			!error.message.includes("secret"),
	);
	assert.equal(calls, 1);
});
test("Cider accepts documented empty seek responses without inventing a playback timestamp", async () => {
	let seeks = 0;
	const cider = new Cider(
		"http://127.0.0.1:10767",
		"synthetic",
		async (url) => {
			const endpoint = new URL(String(url)).pathname.split("/").at(-1);
			if (endpoint === "seek") {
				seeks++;
				return new Response(null, { status: 204 });
			}
			return Response.json(
				endpoint === "is-playing"
					? { is_playing: false }
					: endpoint === "volume"
						? { volume: 0.3 }
						: { info: { name: "Song", playParams: { id: "123" } } },
			);
		},
	);
	const result = await cider.playback({ action: "seek", value: 20 });
	assert.equal(seeks, 1);
	assert.equal(result.state, "paused");
	assert.equal(result.position, undefined);
});
test("Cider queue omits asset URLs and DRM metadata", async () => {
	const cider = new Cider("http://127.0.0.1:10767", "token", async () =>
		Response.json([
			{
				id: "1234",
				assetURL: "https://private.example/audio",
				assets: [{ downloadKey: "secret-key" }],
				attributes: { name: "Song", artistName: "Artist", albumName: "Album" },
			},
		]),
	);
	const result = JSON.stringify(await cider.queue());
	assert.ok(result.includes("Song"));
	assert.ok(!result.includes("secret-key"));
	assert.ok(!result.includes("private.example"));
});
test("Cider mode changes read the documented value field and stop at requested mode", async () => {
	let mode = 0,
		toggles = 0;
	const cider = new Cider(
		"http://127.0.0.1:10767",
		"token",
		async (url, init) => {
			const path = new URL(String(url)).pathname.split("/").at(-1);
			if (path === "repeat-mode")
				return Response.json({ status: "ok", value: mode });
			if (path === "toggle-repeat") {
				mode = (mode + 1) % 3;
				toggles++;
				return Response.json({ status: "ok" });
			}
			return Response.json(
				path === "is-playing"
					? { is_playing: false }
					: path === "volume"
						? { volume: 0.5 }
						: { info: null },
			);
		},
	);
	await cider.playback({ action: "repeat", value: 2 });
	assert.equal(toggles, 2);
});
test("Apple personal playlist reads include authorization and reject foreign pagination", async () => {
	const c = new AppleCatalog(root(), async (url, init) => {
		assert.equal(
			new Headers(init?.headers).get("Music-User-Token"),
			"synthetic-user-token",
		);
		return Response.json(
			String(url).includes("/tracks")
				? { data: [], next: "https://evil.example/steal" }
				: {
						data: [
							{ id: "p.test", attributes: { name: "Playlist", canEdit: true } },
						],
					},
		);
	});
	c.developerToken = async () => "synthetic-developer-token";
	c.userToken = () => "synthetic-user-token";
	await assert.rejects(c.playlist("p.test"), /Unexpected Apple pagination/);
});
test("Apple malformed API path is rejected before token or HTTP access", async () => {
	let calls = 0;
	const c = new AppleCatalog(root(), async () => {
		calls++;
		return Response.json({});
	});
	await assert.rejects(
		c.request("GET", "/v1/me/../private"),
		/Invalid Apple API path/,
	);
	assert.equal(calls, 0);
});
test("Apple API failures are redacted and writes are never retried", async () => {
	let calls = 0;
	const c = new AppleCatalog(root(), async () => {
		calls++;
		return new Response("token-in-error-body", { status: 503 });
	});
	c.developerToken = async () => "test";
	c.userToken = () => "test";
	await assert.rejects(
		c.create("Test", ["123"]),
		(error) =>
			error instanceof Error &&
			/503/.test(error.message) &&
			!error.message.includes("token-in-error-body"),
	);
	assert.equal(calls, 1);
});
test("artist popularity uses a relationship view and heavy rotation uses its accepted default limit", async () => {
	const urls: URL[] = [],
		c = new AppleCatalog(root(), async (url) => {
			urls.push(new URL(String(url)));
			return Response.json({ data: [] });
		});
	c.developerToken = async () => "test";
	c.userToken = () => "test";
	await c.browse("artists", "462006", "top-songs");
	await c.heavyRotation();
	assert.equal(
		urls[0]?.pathname,
		"/v1/catalog/us/artists/462006/view/top-songs",
	);
	assert.equal(urls[1]?.searchParams.has("limit"), false);
});
