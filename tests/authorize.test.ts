import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { request, createServer } from "node:http";
import { AppleCatalog } from "../src/catalog.js";
import { AuthorizationOptions, startAuthorization } from "../src/authorize.js";
import { root } from "./helpers.js";
test("headless authorization validates callback settings before accessing credentials", async () => {
	const catalog = new AppleCatalog(root());
	let accessed = false;
	catalog.developerToken = async () => {
		accessed = true;
		throw new Error("unexpected");
	};
	for (const port of [-1, 80, 65536, NaN, 8080.5]) {
		await assert.rejects(startAuthorization(catalog, { port }));
	}
	assert.equal(accessed, false);
	assert.equal(AuthorizationOptions.parse({}).port, 0);
	assert.throws(() => AuthorizationOptions.parse({ timeoutMs: 600001 }));
});
test("a fixed SSH-forwardable callback stays on IPv4 loopback and closes without saving a token", async () => {
	const probe = createServer();
	await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
	const port = (probe.address() as { port: number }).port;
	await new Promise<void>((resolve) => probe.close(() => resolve()));
	const catalog = new AppleCatalog(root());
	catalog.developerToken = async () => "synthetic-developer-token";
	const auth = await startAuthorization(catalog, { port, timeoutMs: 1000 });
	try {
		assert.equal(new URL(auth.url).origin, `http://127.0.0.1:${port}`);
		assert.equal((await fetch(auth.url)).status, 200);
		auth.close();
		assert.equal(await auth.completed, false);
		assert.equal(existsSync(join(catalog.root, "user.json")), false);
	} finally {
		auth.close();
	}
});
test("authorization requires nonce, host, origin, bounded JSON and Apple verification", async () => {
	const directory = root(),
		catalog = new AppleCatalog(directory);
	catalog.developerToken = async () => "synthetic-developer-token";
	catalog.request = async () => ({ data: [{ id: "us", attributes: {} }] });
	const auth = await startAuthorization(catalog, { timeoutMs: 10000 });
	try {
		const origin = new URL(auth.url).origin;
		assert.equal((await fetch(`${origin}/wrong/config`)).status, 404);
		const badHost = await new Promise<number | undefined>((resolve, reject) => {
			const req = request(
				auth.url,
				{ headers: { Host: "evil.example" } },
				(res) => {
					res.resume();
					resolve(res.statusCode);
				},
			);
			req.on("error", reject);
			req.end();
		});
		assert.equal(badHost, 404);
		const config = await fetch(`${auth.url}config`);
		assert.equal(config.headers.get("cache-control"), "no-store");
		const body = JSON.stringify({ token: "synthetic-user-token" });
		assert.equal(
			(
				await fetch(`${auth.url}complete`, {
					method: "POST",
					body,
					headers: {
						Origin: "https://evil.example",
						"Content-Type": "application/json",
					},
				})
			).status,
			403,
		);
		assert.equal(existsSync(join(directory, "user.json")), false);
		const result = await fetch(`${auth.url}complete`, {
			method: "POST",
			body,
			headers: { Origin: origin, "Content-Type": "application/json" },
		});
		assert.equal(result.status, 200);
		assert.equal(await auth.completed, true);
		assert.equal(
			JSON.parse(readFileSync(join(directory, "user.json"), "utf8"))
				.music_user_token,
			"synthetic-user-token",
		);
	} finally {
		auth.close();
	}
});
