import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { LibraryFolders } from "../src/organization.js";
import { Preferences } from "../src/preferences.js";
import { Plans } from "../src/storage.js";
import { root } from "./helpers.js";

test("an empty root identity is an unavailable view, not an invented folder or a write", async (t) => {
	const plans = new Plans(root());
	t.after(() => plans.close());
	const catalog = new (class extends AppleCatalog {
		override async request() {
			return {
				data: [],
				meta: { filters: { identity: { playlistsroot: [] } } },
			};
		}
	})(plans.root);
	const folders = new LibraryFolders(catalog, plans);
	const result = await folders.browse({});
	assert.equal(result.folder, null);
	assert.equal(result.complete, false);
	assert.equal(result.availability, "root_not_returned");
	await assert.rejects(
		folders.preview({ action: "create_folder", name: "Mixtapes" }),
		/did not expose a root/,
	);
	assert.equal(plans.recent().length, 0);
});

function setup() {
	const directory = root(),
		plans = new Plans(directory);
	const calls: Array<{ method: string; path: string; body: unknown }> = [];
	let parentName = "Playlists",
		accepted = false,
		failRead = false,
		wrongParent = false;
	let next: string | undefined;
	const catalog = new (class extends AppleCatalog {
		override async developerToken() {
			return "fixture-key";
		}
		override userToken() {
			return "fixture-user";
		}
		override readiness() {
			return {
				user_authorized: true,
				developer_key_configured: true,
				storefront: "us",
			};
		}
	})(directory, async (url, options) => {
		const uri = new URL(String(url)),
			method = options?.method ?? "GET",
			path = uri.pathname;
		calls.push({
			method,
			path,
			body: options?.body ? JSON.parse(String(options.body)) : undefined,
		});
		assert.equal(
			new Headers(options?.headers).get("Music-User-Token"),
			"fixture-user",
		);
		if (method === "POST") {
			accepted = true;
			return Response.json(
				{ data: [{ id: "p.new", type: "library-playlist-folders" }] },
				{ status: 201 },
			);
		}
		if (path === "/v1/me/library/playlist-folders")
			return Response.json({
				data: [],
				meta: {
					filters: {
						identity: {
							playlistsroot: [
								{ id: "p.root", type: "library-playlist-folders" },
							],
						},
					},
				},
			});
		if (path.endsWith("/p.root"))
			return Response.json({
				data: [
					{
						id: "p.root",
						type: "library-playlist-folders",
						attributes: { name: parentName },
					},
				],
			});
		if (path.endsWith("/p.root/children"))
			return Response.json({ data: [], next });
		if (accepted && failRead) throw new Error("private provider response");
		if (path.endsWith("/p.new/parent"))
			return Response.json({
				data: [
					{
						id: wrongParent ? "p.other" : "p.root",
						type: "library-playlist-folders",
					},
				],
			});
		if (path.endsWith("/p.new"))
			return Response.json({
				data: [
					{
						id: "p.new",
						type: "library-playlist-folders",
						attributes: { name: "Mixtapes" },
					},
				],
			});
		throw new Error("Unexpected fixture path " + path);
	});
	return {
		plans,
		calls,
		catalog,
		folders: new LibraryFolders(catalog, plans),
		changes: new Preferences(catalog, plans),
		rename() {
			parentName = "Renamed";
		},
		fail() {
			failRead = true;
		},
		mismatch() {
			wrongParent = true;
		},
		next(value: string) {
			next = value;
		},
	};
}
test("folder browsing resolves Apple's meta-only root and rejects foreign or unbounded pages", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	assert.equal((await f.folders.browse({})).folder.id, "p.root");
	assert.ok(f.calls.every((call) => call.method === "GET"));
	for (const page of [
		"https://evil.example/steal",
		"/v1/me/library/playlist-folders/p.other/children",
		"/v1/me/library/playlist-folders/p.root/children?limit=101",
		"/v1/me/library/playlist-folders/p.root/children?offset=-1",
		"/v1/me/library/playlist-folders/p.root/children?include=secret",
	]) {
		await assert.rejects(f.folders.browse({ page }), /pagination/);
	}
	f.next(
		"/v1/me/library/playlist-folders/p.root/children?offset=100&limit=100",
	);
	const page = await f.folders.browse({});
	assert.equal(page.complete, false);
	assert.equal(
		(await f.folders.browse({ page: page.next_page! })).folder.id,
		"p.root",
	);
});

test("folder creation uses the existing review/apply flow and verifies name plus parent", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.changes.preview({
		action: "create_folder",
		name: "Mixtapes",
	});
	assert.ok(f.calls.every((call) => call.method === "GET"));
	assert.equal((await f.changes.apply(plan.plan_id)).state, "applied");
	assert.deepEqual(f.calls.find((call) => call.method === "POST")?.body, {
		attributes: { name: "Mixtapes" },
		relationships: {
			parent: { data: [{ id: "p.root", type: "library-playlist-folders" }] },
		},
	});
	await Promise.all([
		f.changes.apply(plan.plan_id),
		f.changes.apply(plan.plan_id),
	]);
	assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
});

test("folder previews reject a renamed parent before mutation", async (t) => {
	const f = setup();
	t.after(() => f.plans.close());
	const plan = await f.changes.preview({
		action: "create_folder",
		name: "Mixtapes",
	});
	f.rename();
	await assert.rejects(f.changes.apply(plan.plan_id), /changed since preview/);
	assert.equal(f.plans.get(plan.plan_id).state, "ready");
	assert.ok(f.calls.every((call) => call.method === "GET"));
});

test("folder readback uncertainty retains accepted identity and blocks replay", async (t) => {
	for (const mode of ["fail", "mismatch"] as const) {
		const f = setup();
		t.after(() => f.plans.close());
		const plan = await f.changes.preview({
			action: "create_folder",
			name: "Mixtapes",
		});
		f[mode]();
		if (mode === "fail")
			await assert.rejects(
				f.changes.apply(plan.plan_id),
				/blocked from automatic retry/,
			);
		else
			assert.equal((await f.changes.apply(plan.plan_id)).state, "needs_review");
		const result = f.plans.get(plan.plan_id);
		assert.equal(result.result?.accepted_folder_id, "p.new");
		await assert.rejects(f.changes.apply(plan.plan_id), /unknown|needs_review/);
		assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
	}
});
