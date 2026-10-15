/** Optional live test: creates only its uniquely named disposable playlist. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { AppleCatalog } from "../src/catalog.js";
import { MacMusic } from "../src/players.js";
import { MusicService } from "../src/service.js";

if (process.platform !== "darwin")
	throw new Error(
		"This test uses Music.app to remove its own disposable API playlist.",
	);
const catalog = new AppleCatalog(),
	native = new MacMusic(),
	music = new MusicService(native, catalog);
const name = `Groovectl disposable API test ${randomUUID()}`;
const songs = (await catalog.search("Fleetwood Mac Rumours", 3)).slice(0, 2);
assert.equal(songs.length, 2);
const plan = await music.preview(
	name,
	songs.map((t) => ({ source: "catalog", id: t.id })),
);
let removed = false,
	verified = false;
try {
	const result = await music.apply(plan.plan_id);
	assert.equal(result.state, "applied");
	assert.deepEqual(await music.apply(plan.plan_id), result);
	verified = true;
	console.log(
		"Official API create, exact ordered readback and repeat-apply passed.",
	);
} finally {
	// The native/API ID namespaces differ. Locate only this unique test name and
	// verify all observed recordings before deleting anything through Music.app.
	for (let attempt = 0; attempt < 20; attempt++) {
		const matches = (await native.playlists()).playlists.filter(
			(p) => p.name === name,
		);
		if (matches.length > 1)
			throw new Error("Ambiguous test playlist; cleanup requires inspection.");
		if (matches.length === 1) {
			const p = await native.playlist(matches[0]!.id);
			if (
				p.tracks.length > songs.length ||
				p.tracks.some(
					(t) => !songs.some((s) => s.name === t.name && s.artist === t.artist),
				)
			)
				throw new Error("Test playlist changed; cleanup requires inspection.");
			await native.deleteOwned(p.id, name);
			assert.ok(
				!(await native.playlists()).playlists.some((item) => item.id === p.id),
			);
			music.plans.finish(plan.plan_id, "deleted", {
				api_write_verified: verified,
				diagnostic_cleanup_verified: true,
			});
			removed = true;
			break;
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	music.plans.close();
	if (!removed)
		throw new Error(
			`API test playlist has not appeared in Music.app for cleanup. Inspect ${name}; do not repeat creation.`,
		);
}
const receipt = {
	official_api_create: true,
	ordered_catalog_ids_verified: true,
	retry_idempotent: true,
	disposable_playlist_removed: true,
};
if (process.argv[2])
	writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt));
