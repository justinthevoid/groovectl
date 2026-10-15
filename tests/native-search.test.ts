import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Music's eSrA search-area enum contains all/albums/artists/composers/displayed/names.
// "songs" belongs to a different enum and raises a live Apple Event type error.
for (const file of ["native/Sources/MusicBridge/music.js", "server/src/apple_music_hybrid/music.js"]) {
	test(`${file}: searches title/artist and retains native identities and paging`, () => {
		const songs = [
			{ id: "0000000000000001", title: "First song", artist: "Fixture" },
			{ id: "0000000000000002", title: "Fixture song", artist: "Second artist" },
		];
		const tracks = songs.map(song => ({ persistentID: () => song.id, name: () => song.title, artist: () => song.artist, album: () => "Album", duration: () => 180 }));
		const library = { tracks: () => tracks };
		const music = {
			libraryPlaylists: [library],
			search(target: unknown, options: { for: string; only: string }) {
				assert.equal(target, library);
				assert.ok(["all", "albums", "artists", "composers", "displayed", "names"].includes(options.only), "Search area must be accepted by Music's dictionary");
				return tracks.filter(track => (options.only === "names" ? track.name() : `${track.name()} ${track.artist()}`).includes(options.for));
			},
		};
		const context = { Application: (name: string) => { assert.equal(name, "Music"); return music; } };
		const run = runInNewContext(`${readFileSync(new URL(`../${file}`, import.meta.url), "utf8")}\nrun`, context) as (args: string[]) => string;
		const result = JSON.parse(run([JSON.stringify({ op: "search", query: "Fixture", limit: 1, offset: 1 })]));
		assert.equal(result.error, undefined);
		assert.equal(result.total, 2);
		assert.equal(result.offset, 1);
		assert.equal(result.tracks.length, 1);
		assert.equal(result.tracks[0].source, "native");
		assert.equal(result.tracks[0].id, songs[1]?.id);
		const all = JSON.parse(run([JSON.stringify({ op: "search", query: "", limit: 1, offset: 0 })]));
		assert.equal(all.total, 2);
		assert.equal(all.tracks[0].id, songs[0]?.id);
	});
}
