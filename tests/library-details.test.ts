import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { root } from "./helpers.js";

class Catalog extends AppleCatalog {
	calls: Array<{ path: string; options: unknown }> = [];
	response: Awaited<ReturnType<AppleCatalog["request"]>> = { data: [] };
	override async request(_method: "GET" | "POST" | "PUT" | "DELETE", path: string, options = {}) {
		this.calls.push({ path, options }); return this.response;
	}
}
const song = { id: "i.upload", type: "library-songs", attributes: { name: "Library version", playParams: { catalogId: "123" } } };

test("library details follow Apple's typed relationships with personal auth and retain library identities", async () => {
	const c = new Catalog(root());
	c.response = { data: [song], next: "/v1/me/library/albums/l.album/tracks?offset=100&limit=100" };
	const first = await c.libraryDetails("albums", "l.album");
	assert.equal(first.items[0]?.id, "i.upload"); assert.equal(first.items[0]?.type, "library-songs");
	assert.equal(first.complete, false);
	c.response = { data: [] }; await c.libraryDetails("albums", "l.album", first.next_page!);
	assert.deepEqual(c.calls[1], { path: "/v1/me/library/albums/l.album/tracks", options: { personal: true, params: { limit: "100", offset: "100" } } });
	c.response = { data: [{ id: "l.album", type: "library-albums", attributes: {} }] };
	const artist = await c.libraryDetails("artists", "r.artist");
	assert.equal(c.calls[2]?.path, "/v1/me/library/artists/r.artist/albums");
	assert.equal(artist.relationship, "albums"); assert.equal(artist.complete, true);
});

test("detail pagination cannot leave the resource, change auth destination or repeat a page", async () => {
	const c = new Catalog(root());
	for (const page of [
		"https://attacker.invalid/v1/me/library/albums/l.album/tracks?offset=100",
		"/v1/me/library/albums/l.other/tracks?offset=100",
		"/v1/me/library/artists/l.album/albums?offset=100",
		"https://user:secret@api.music.apple.com/v1/me/library/albums/l.album/tracks?offset=100",
		"/v1/me/library/albums/l.album/tracks?offset=100#fragment",
		"/v1/me/library/albums/l.album/tracks?offset=100&offset=200",
		"/v1/me/library/albums/l.album/tracks?offset=-1",
		"/v1/me/library/albums/l.album/tracks?offset=100001",
		"/v1/me/library/albums/l.album/tracks?offset=100&limit=999",
		"/v1/me/library/albums/l.album/tracks?offset=100&include=catalog",
	]) await assert.rejects(c.libraryDetails("albums", "l.album", page));
	assert.equal(c.calls.length, 0);
	c.response = { data: [], next: "/v1/me/library/albums/l.album/tracks?offset=0" };
	await assert.rejects(c.libraryDetails("albums", "l.album"), /did not advance/);
	await assert.rejects(c.libraryDetails("albums", "../other"));
});

test("missing data and catalog substitutions fail rather than fabricate library details", async () => {
	const c = new Catalog(root());
	c.response = {}; await assert.rejects(c.libraryDetails("albums", "l.album"));
	c.response = { data: [{ ...song, type: "songs", id: "123" }] };
	await assert.rejects(c.libraryDetails("albums", "l.album"), /different library/);
	c.response = { data: Array.from({ length: 101 }, () => song) };
	await assert.rejects(c.libraryDetails("albums", "l.album"));
});
