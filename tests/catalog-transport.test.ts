import { test } from "node:test";
import assert from "node:assert/strict";
import { AppleCatalog } from "../src/catalog.js";
import { root } from "./helpers.js";

function catalog(fetcher: typeof fetch) {
	const client = new AppleCatalog(root(), fetcher);
	client.developerToken = async () => "synthetic-developer-secret";
	client.userToken = () => "synthetic-user-secret";
	return client;
}
const reset = () => new TypeError("private URL and credentials", { cause: Object.assign(new Error("secret"), { code: "ECONNRESET" }) });

test("transient GET failures recover once with the same deadline and authorization", async () => {
	const signals: (AbortSignal | null | undefined)[] = [];
	const client = catalog(async (_url, init) => {
		signals.push(init?.signal);
		assert.equal(new Headers(init?.headers).get("Music-User-Token"), "synthetic-user-secret");
		if (signals.length === 1) throw reset();
		return Response.json({ data: [{ id: "p.fixture", attributes: { name: "Recovered" } }] });
	});
	const result = await client.request("GET", "/v1/me/library/playlists", { personal: true });
	assert.equal(result.data?.[0]?.attributes.name, "Recovered");
	assert.equal(signals.length, 2);
	assert.ok(signals[0]);
	assert.equal(signals[0], signals[1]);
});

test("GET gateway errors recover once and cancel the abandoned body", async () => {
	let calls = 0, cancelled = false;
	const client = catalog(async () => ++calls === 1
		? new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 503 })
		: Response.json({ data: [] }));
	assert.deepEqual(await client.request("GET", "/v1/catalog/us/songs"), { data: [] });
	assert.equal(calls, 2);
	assert.equal(cancelled, true);
});

test("GET retries are bounded and transport messages cannot expose exception secrets", async () => {
	let calls = 0;
	const client = catalog(async () => { calls++; throw reset(); });
	await assert.rejects(client.request("GET", "/v1/catalog/us/songs"), error => {
		assert.ok(error instanceof Error);
		assert.match(error.message, /ECONNRESET/);
		assert.doesNotMatch(error.message, /private|credentials|secret/);
		return true;
	});
	assert.equal(calls, 2);
});

test("failed GET response bodies participate in safe retry", async () => {
	let calls = 0;
	const client = catalog(async () => ++calls === 1
		? new Response(new ReadableStream({ start(controller) { controller.error(reset()); } }))
		: Response.json({ data: [] }));
	assert.deepEqual(await client.request("GET", "/v1/catalog/us/songs"), { data: [] });
	assert.equal(calls, 2);
});

test("the original deadline can expire during backoff without a second request", async t => {
	const deadline = new AbortController();
	t.mock.method(AbortSignal, "timeout", () => deadline.signal);
	let calls = 0;
	const client = catalog(async () => {
		calls++;
		setTimeout(() => deadline.abort(new DOMException("private timeout detail", "TimeoutError")), 5);
		throw reset();
	});
	await assert.rejects(client.request("GET", "/v1/catalog/us/songs"), /25-second request limit/);
	assert.equal(calls, 1);
});

test("authorization, rate limits and other HTTP errors are not retried", async () => {
	for (const status of [400, 401, 403, 404, 429, 500]) {
		let calls = 0;
		const client = catalog(async () => { calls++; return new Response("private error body", { status }); });
		await assert.rejects(client.request("GET", "/v1/catalog/us/songs"), error => error instanceof Error && error.message.includes(`HTTP ${status}`) && !error.message.includes("private"));
		assert.equal(calls, 1);
	}
});

test("timeouts and unknown errors do not trigger an automatic retry", async () => {
	for (const failure of [new DOMException("secret", "TimeoutError"), new Error("secret"), Object.assign(new Error("secret"), { code: "ENOTFOUND" })]) {
		let calls = 0;
		const client = catalog(async () => { calls++; throw failure; });
		await assert.rejects(client.request("GET", "/v1/catalog/us/songs"), error => error instanceof Error && !error.message.includes("secret"));
		assert.equal(calls, 1);
	}
});

test("POST, PUT and DELETE never retry a failed connection, response body or gateway response", async () => {
	for (const method of ["POST", "PUT", "DELETE"] as const) {
		for (const failure of ["connection", "body", "gateway"]) {
			let calls = 0;
			const client = catalog(async () => {
				calls++;
				if (failure === "connection") throw reset();
				return failure === "gateway" ? new Response("private", { status: 503 })
					: new Response(new ReadableStream({ start(controller) { controller.error(reset()); } }));
			});
			await assert.rejects(client.request(method, "/v1/me/library/playlists", { personal: true, body: { name: "Fixture" } }), /Writes are not retried automatically/);
			assert.equal(calls, 1);
		}
	}
});
