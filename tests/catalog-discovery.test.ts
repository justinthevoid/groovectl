import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { root } from "./helpers.js";
class Catalog extends AppleCatalog {
	calls: Array<{ method: string; path: string; options: unknown }> = [];
	override async request(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		options = {},
	) {
		this.calls.push({ method, path, options });
		return { data: [], meta: { filters: { isrc: { USABC1234567: [] } } } };
	}
}
test("recording alternatives preserve Apple mapping and separate filter modes", async () => {
	const c = new Catalog(root());
	const r = await c.recordingAlternatives({ isrcs: ["USABC1234567"] });
	assert.deepEqual(r.mapping, { filters: { isrc: { USABC1234567: [] } } });
	assert.deepEqual(c.calls[0]?.options, {
		params: { "filter[isrc]": "USABC1234567" },
	});
	await c.recordingAlternatives({ equivalent_ids: ["123"] });
	assert.deepEqual(c.calls[1]?.options, {
		params: { "filter[equivalents]": "123" },
	});
});
test("Replay is scoped to latest eligible year with personal authorization", async () => {
	const c = new Catalog(root());
	await c.replay();
	assert.deepEqual(c.calls[0], {
		method: "GET",
		path: "/v1/me/music-summaries",
		options: {
			personal: true,
			params: {
				"filter[year]": "latest",
				views: "top-artists,top-albums,top-songs",
			},
		},
	});
});
