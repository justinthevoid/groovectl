import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Artwork, rasterInfo } from "../src/artwork.js";
import {
	generateAPIImage,
	ArtworkRateLimit,
	codexMcpOverrides,
} from "../src/artwork-providers.js";
import { root } from "./helpers.js";
import { pngHeader } from "./artwork-fixture.js";

test("Codex artwork disables every configured MCP server without carrying credentials into arguments", () => {
	const args = codexMcpOverrides([
		{ name: "music", env: { TOKEN: "synthetic-secret" } },
		{ name: "new_server", headers: { Authorization: "synthetic-secret" } },
		{ name: "docs-v2" },
		{ name: "music" },
	]);
	assert.deepEqual(args, [
		"-c",
		"mcp_servers.docs-v2.enabled=false",
		"-c",
		"mcp_servers.music.enabled=false",
		"-c",
		"mcp_servers.new_server.enabled=false",
	]);
	assert.equal(args.join(" ").includes("synthetic-secret"), false);
	assert.deepEqual(codexMcpOverrides([]), []);
	for (const input of [
		{},
		[{ name: "unsafe.name" }],
		[{ name: "x=true" }],
		[{ name: "x\nrequired" }],
		[{}],
	])
		assert.throws(() => codexMcpOverrides(input));
});

test("lowered operator caps also stop already queued jobs before API IO", async () => {
	let calls = 0;
	const art = new Artwork(root(), async () => {
		calls++;
		return Response.json({
			data: [{ b64_json: pngHeader().toString("base64") }],
		});
	});
	art.configureProvider("openai", {
		model: "model",
		key: "private-test-key",
		daily_limit: 2,
	});
	const first = art.create("first", randomUUID(), () => {});
	await art.run(first.artwork_id);
	const queued = art.create("second", randomUUID(), () => {});
	art.configureProvider("openai", { daily_limit: 1 });
	await art.run(queued.artwork_id);
	assert.equal(calls, 1);
	assert.equal(art.get(queued.artwork_id).state, "failed");
	assert.match(art.get(queued.artwork_id).error!, /request cap/);
});

test("JPEG bytes retain their MIME type and reject truncated/oversized frames", () => {
	const jpeg = readFileSync(new URL("./fixtures/square.jpg", import.meta.url));
	assert.equal(rasterInfo(jpeg).mime_type, "image/jpeg");
	assert.equal(rasterInfo(jpeg).width, 256);
	assert.throws(
		() => rasterInfo(jpeg.subarray(0, jpeg.length - 2)),
		/complete PNG or JPEG/,
	);
	assert.throws(() => rasterInfo(Buffer.alloc(9 * 1024 * 1024)), /8 MiB/);
});
test("BYOK adapters use fixed endpoints, one square image and no redirects or fallback", async () => {
	for (const provider of ["openai", "gemini", "openrouter"] as const) {
		let calls = 0;
		const result = await generateAPIImage(
			provider,
			"chosen-model",
			"private-test-key",
			"quiet cover",
			async (url, options) => {
				calls++;
				assert.ok(String(url).startsWith("https://"));
				assert.equal(options?.redirect, "error");
				const body = JSON.parse(String(options?.body));
				assert.equal(body.model, "chosen-model");
				assert.equal(body.n ?? 1, 1);
				if (provider === "gemini") {
					assert.equal(body.store, false);
					assert.deepEqual(body.response_format, {
						type: "image",
						aspect_ratio: "1:1",
						image_size: "1K",
					});
					return Response.json({
						status: "completed",
						steps: [
							{
								type: "model_output",
								content: [
									{
										type: "image",
										data: pngHeader().toString("base64"),
										mime_type: "image/png",
									},
								],
							},
						],
					});
				}
				if (provider === "openrouter")
					assert.equal(body.provider.allow_fallbacks, false);
				return Response.json({
					data: [{ b64_json: pngHeader().toString("base64") }],
				});
			},
		);
		assert.equal(calls, 1);
		assert.deepEqual(result, pngHeader());
	}
});
test("API errors redact provider bodies, rate limits are not retried, URL outputs are refused", async () => {
	let calls = 0;
	await assert.rejects(
		() =>
			generateAPIImage("openai", "model", "sensitive", "brief", async () => {
				calls++;
				return new Response("sensitive echoed key", { status: 401 });
			}),
		(e) => !String(e).includes("sensitive") && /401/.test(String(e)),
	);
	assert.equal(calls, 1);
	await assert.rejects(
		() =>
			generateAPIImage(
				"gemini",
				"model",
				"key",
				"brief",
				async () =>
					new Response(null, {
						status: 429,
						headers: { "retry-after": "600" },
					}),
			),
		(e) => e instanceof ArtworkRateLimit && e.retryAt > Date.now() + 500000,
	);
	await assert.rejects(
		() =>
			generateAPIImage("openrouter", "model", "key", "brief", async () =>
				Response.json({ data: [{ url: "https://elsewhere.example/private" }] }),
			),
		/inline image/,
	);
});
test("provider/model are pinned to the request; stored credentials never enter public jobs", async () => {
	let calls = 0,
		model = "";
	const directory = root(),
		art = new Artwork(directory, async (_url, options) => {
			calls++;
			model = JSON.parse(String(options?.body)).model;
			return Response.json({
				data: [{ b64_json: pngHeader().toString("base64") }],
			});
		});
	art.configureProvider("openai", {
		model: "original-model",
		key: "private-test-key",
		daily_limit: 1,
	});
	const request = randomUUID(),
		job = art.create("cover", request, () => {}, undefined, "openai");
	art.configureProvider("openai", { model: "new-model", daily_limit: 1 });
	await art.run(job.artwork_id);
	assert.equal(art.get(job.artwork_id).state, "complete");
	assert.equal(model, "original-model");
	assert.equal(calls, 1);
	assert.equal(art.image(job.artwork_id).mimeType, "image/png");
	assert.ok(
		!JSON.stringify(art.get(job.artwork_id)).includes("private-test-key"),
	);
	assert.throws(
		() => art.create("another", randomUUID(), () => {}, undefined, "openai"),
		/daily cap/,
	);
	assert.equal(
		art.create(
			"cover",
			request,
			() => {
				throw new Error("replay");
			},
			undefined,
			"openai",
		).artwork_id,
		job.artwork_id,
	);
	const config = readFileSync(join(directory, "artwork-provider.json"), "utf8");
	assert.ok(!config.includes("private-test-key"));
});
test("429 saves cooldown, consumes one local attempt and cannot start another job", async () => {
	let calls = 0;
	const art = new Artwork(root(), async () => {
		calls++;
		return new Response(null, {
			status: 429,
			headers: { "retry-after": "3600" },
		});
	});
	art.configureProvider("openrouter", {
		model: "test-model",
		key: "private-test-key",
	});
	const job = art.create("cover", randomUUID(), () => {});
	await art.run(job.artwork_id);
	assert.equal(calls, 1);
	assert.equal(art.get(job.artwork_id).state, "failed");
	assert.ok(art.readiness().cooldown_until);
	assert.equal(art.readiness().attempts_last_24h, 1);
	await art.run(job.artwork_id);
	assert.equal(calls, 1);
	assert.throws(() => art.create("cover", randomUUID(), () => {}), /cooldown/);
});
test("agy gets a smaller default local cap without changing the default provider", () => {
	const art = new Artwork(root());
	art.configure(process.execPath);
	art.configureProvider("agy-cli", {
		executable: process.execPath,
		select: false,
	});
	assert.equal(art.readiness().provider, "codex-cli");
	assert.equal(
		art.readiness().providers.find((p) => p.provider === "agy-cli")
			?.local_daily_limit,
		3,
	);
});
