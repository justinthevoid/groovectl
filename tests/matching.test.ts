import { test } from "node:test";
import assert from "node:assert/strict";
import {
	bestMatch,
	suffixReview,
	versionNoise,
	foldTempo,
	harmonicOK,
} from "../src/flow.js";
import type { Track } from "../src/models.js";
const song = (id: string, name: string, artist: string): Track => ({
	source: "catalog",
	id,
	name,
	artist,
	album: "",
	duration_ms: 0,
});
test("wrong artist cover is rejected", () =>
	assert.equal(
		bestMatch("Dreams", "Fleetwood Mac", [song("1", "Dreams", "Cover Band")]),
		null,
	));
test("Alive is not a live version marker", () =>
	assert.deepEqual(versionNoise("Alive"), []));
test("exact recording beats live alternate", () =>
	assert.equal(
		bestMatch("Dreams", "Fleetwood Mac", [
			song("1", "Dreams (Live)", "Fleetwood Mac"),
			song("2", "Dreams", "Fleetwood Mac"),
		])?.id,
		"2",
	));
test("only alternate is flagged for review", () => {
	const t = bestMatch("Dreams", "Fleetwood Mac", [
		song("1", "Dreams (under the fabric)", "Fleetwood Mac"),
	]);
	assert.equal(t?.id, "1");
	assert.equal(suffixReview("Dreams", t!.name), true);
});
test("structured titles containing dashes remain unambiguous", () => {
	const t = song("1", "Part One - Part Two", "Artist - Duo");
	assert.equal(bestMatch(t.name, t.artist, [t])?.id, "1");
});
test("Unicode matching preserves Japanese, Korean and accented names", () => {
	for (const [title, artist] of [
		["夜に駆ける", "YOASOBI"],
		["봄날", "방탄소년단"],
		["Été", "Beyoncé"],
	])
		assert.ok(bestMatch(title!, artist!, [song("1", title!, artist!)]));
});
test("blank candidate identity cannot match a request", () => {
	assert.equal(bestMatch("Dreams", "Fleetwood Mac", [song("1", "", "")]), null);
});
test("tempo folding and Camelot wrap retain upstream behavior", () => {
	assert.equal(foldTempo(180), 90);
	assert.equal(foldTempo(75), 75);
	assert.equal(harmonicOK("12A", "1A"), true);
	assert.equal(harmonicOK("12A", "1B"), false);
});
