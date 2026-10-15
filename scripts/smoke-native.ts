/** Disposable, silent native integration test; mirrors the retained Python smoke. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { MacMusic } from "../src/players.js";
import { MusicService } from "../src/service.js";
import { Track } from "../src/models.js";
import { z } from "zod";
const native = new MacMusic(),
	music = new MusicService(native),
	initial = await native.status();
if (initial.state === "playing")
	throw new Error(
		"Music is playing; this test must not interrupt a listening session.",
	);
const tracks = z
	.object({ tracks: z.array(Track).length(3) })
	.parse(await native.search("", 3, 0)).tracks;
const name = `Groovectl disposable test ${Date.now()}`,
	preview = await music.preview(
		name,
		tracks.slice(0, 2).map((t) => ({ source: "native", id: t.id })),
	);
let playlistId: string | undefined, appendedId: string | undefined;
const playback: Record<string, unknown> = {};
try {
	const result = await music.apply(preview.plan_id);
	assert.equal(result.state, "applied");
	assert.deepEqual(await music.apply(preview.plan_id), result);
	playlistId = z
		.object({ playlist: z.object({ id: z.string() }) })
		.parse(result.result).playlist.id;
	const additions = await music.preview(
		"",
		tracks.map((t) => ({ source: "native", id: t.id })),
		"",
		playlistId,
	);
	appendedId = additions.plan_id;
	assert.equal(additions.payload.duplicates_removed, 2);
	assert.equal((await music.apply(additions.plan_id)).state, "applied");
	try {
		await native.playback({ action: "volume", value: 0 });
		playback.play = (
			await native.playback({ action: "play", playlist_id: playlistId })
		).state;
		playback.pause = (await native.playback({ action: "pause" })).state;
		assert.equal(playback.play, "playing");
		assert.equal(playback.pause, "paused");
	} finally {
		await native.playback({ action: "stop" });
		if (initial.volume !== undefined)
			await native.playback({ action: "volume", value: initial.volume });
		if (initial.track && initial.state === "paused") {
			await native.playback({ action: "play", track_id: initial.track.id });
			await native.playback({ action: "pause" });
			if (initial.position !== undefined)
				await native.playback({ action: "seek", value: initial.position });
		}
	}
	const current = await native.playlist(playlistId);
	assert.equal(current.name, name);
	assert.deepEqual(
		current.tracks.map((t) => t.id),
		tracks.map((t) => t.id),
	);
	await native.deleteOwned(playlistId, name);
	assert.ok(
		!(await native.playlists()).playlists.some((p) => p.id === playlistId),
	);
	music.plans.finish(preview.plan_id, "deleted", {
		playlist_id: playlistId,
		verified: true,
	});
	if (appendedId)
		music.plans.finish(appendedId, "deleted", {
			playlist_id: playlistId,
			verified: true,
		});
	const receipt = {
		bridge: native.bridge(),
		native_playlist_create: true,
		append_deduplicated: true,
		retry_idempotent: true,
		track_order_verified: true,
		playback,
		volume_restored: (await native.status()).volume === initial.volume,
		disposable_playlist_removed: true,
	};
	if (process.argv[2])
		writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + "\n");
	console.log(JSON.stringify(receipt, null, 2));
} finally {
	music.plans.close();
}
