import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { Preferences, MusicChange, ratings } from "../src/preferences.js";
import { Plans } from "../src/storage.js";
import { root } from "./helpers.js";

test("missing ratings data cannot be mistaken for a cleared preference", async () => {
	const catalog = new (class extends AppleCatalog {
		override async request() {
			return {};
		}
	})(root());
	await assert.rejects(
		() => ratings(catalog, "songs", ["123"]),
		/no ratings collection/,
	);
});
function fixture() {
	const directory = root(),
		values = new Map<string, number>(),
		calls: Array<{ method: string; url: URL; body: unknown }> = [];
	let failId = "";
	const catalog = new (class extends AppleCatalog {
		override async developerToken() {
			return "test-developer-token";
		}
		override userToken() {
			return "test-user-token";
		}
		override readiness() {
			return {
				developer_key_configured: true,
				user_authorized: true,
				storefront: "us",
			};
		}
	})(directory, async (url, options) => {
		const uri = new URL(url.toString()),
			method = options?.method ?? "GET";
		calls.push({
			method,
			url: uri,
			body: options?.body ? JSON.parse(String(options.body)) : undefined,
		});
		if (method === "GET" && uri.pathname.includes("/ratings/"))
			return Response.json({
				data: (uri.searchParams.get("ids") ?? "")
					.split(",")
					.filter((id) => values.has(id))
					.map((id) => ({ id, attributes: { value: values.get(id) } })),
			});
		if (method === "GET")
			return Response.json({
				data: (uri.searchParams.get("ids") ?? "")
					.split(",")
					.map((id) => ({ id, attributes: { name: `Title ${id}` } })),
			});
		const id = uri.pathname.split("/").at(-1)!;
		if (id === failId) throw new Error("private response");
		if (method === "PUT") {
			values.set(id, JSON.parse(String(options?.body)).attributes.value);
			return Response.json({ data: [] });
		}
		if (method === "DELETE") {
			values.delete(id);
			return new Response(null, { status: 204 });
		}
		return new Response(null, { status: 202 });
	});
	const plans = new Plans(directory);
	return {
		values,
		calls,
		catalog,
		plans,
		service: new Preferences(catalog, plans),
		fail: (id: string) => {
			failId = id;
		},
	};
}
test("ratings preview is read-only; apply verifies and restart/concurrent reuse cannot repeat writes", async () => {
	const f = fixture();
	try {
		const plan = await f.service.preview({
			action: "rating",
			resource: "songs",
			ids: ["123", "456"],
			value: 1,
		});
		assert.ok(f.calls.every((c) => c.method === "GET"));
		await Promise.all([
			f.service.apply(plan.plan_id),
			f.service.apply(plan.plan_id),
		]);
		assert.equal(f.plans.get(plan.plan_id).state, "applied");
		assert.equal(f.calls.filter((c) => c.method === "PUT").length, 2);
		assert.deepEqual(f.calls.find((c) => c.method === "PUT")?.body, {
			type: "ratings",
			attributes: { value: 1 },
		});
		await new Preferences(f.catalog, f.plans).apply(plan.plan_id);
		assert.equal(f.calls.filter((c) => c.method === "PUT").length, 2);
		const clear = await f.service.preview({
			action: "rating",
			resource: "songs",
			ids: ["123"],
			value: "clear",
		});
		await f.service.apply(clear.plan_id);
		assert.equal(
			(await ratings(f.catalog, "songs", ["123"])).ratings[0]?.value,
			null,
		);
	} finally {
		f.plans.close();
	}
});
test("202 favorite/library requests remain accepted, unverified and cannot be replayed", async () => {
	const f = fixture();
	try {
		for (const action of ["favorite", "add_library"] as const) {
			const plan = await f.service.preview({
				action,
				resource: "albums",
				ids: ["123"],
			});
			const result = await f.service.apply(plan.plan_id);
			assert.equal(result.state, "accepted");
			assert.equal(result.result?.verified, false);
			await f.service.apply(plan.plan_id);
		}
		assert.equal(f.calls.filter((c) => c.method === "POST").length, 2);
		assert.equal(
			f.calls
				.find((c) => c.method === "POST")
				?.url.searchParams.get("ids[albums]"),
			"123",
		);
	} finally {
		f.plans.close();
	}
});
test("stale previews reject before writes; partial batch failures retain progress and block retries", async () => {
	const f = fixture();
	try {
		const stale = await f.service.preview({
			action: "rating",
			resource: "songs",
			ids: ["123"],
			value: -1,
		});
		f.values.set("123", 1);
		await assert.rejects(
			() => f.service.apply(stale.plan_id),
			/changed since preview/,
		);
		assert.equal(f.calls.filter((c) => c.method === "PUT").length, 0);
		const plan = await f.service.preview({
			action: "rating",
			resource: "songs",
			ids: ["123", "456"],
			value: -1,
		});
		f.fail("456");
		await assert.rejects(
			() => f.service.apply(plan.plan_id),
			/needs inspection/,
		);
		const result = f.plans.get(plan.plan_id);
		assert.equal(result.state, "unknown");
		assert.deepEqual(result.result?.completed_ids, ["123"]);
		assert.equal(result.result?.attempting_id, "456");
		await assert.rejects(() => f.service.apply(plan.plan_id), /unknown/);
		assert.equal(f.calls.filter((c) => c.method === "PUT").length, 2);
	} finally {
		f.plans.close();
	}
	assert.equal(
		MusicChange.safeParse({
			action: "favorite",
			resource: "stations",
			ids: ["1"],
		}).success,
		false,
	);
	assert.equal(
		MusicChange.safeParse({
			action: "rating",
			resource: "songs",
			ids: ["../secrets"],
			value: 1,
		}).success,
		false,
	);
});
