/** Check an unpacked release without importing dependencies from this checkout. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve(process.argv[2] ?? "dist/cli.js");
const expectedVersion = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const root = mkdtempSync(join(tmpdir(), "groovectl-package-"));
const child = spawn(process.execPath, [cli, "serve"], {
	cwd: root,
	env: { ...process.env, GROOVECTL_DATA: root, GROOVECTL_PLAYER: "windows" },
	stdio: ["pipe", "pipe", "pipe"],
});
let next = 0,
	buffer = "",
	errors = "";
const pending = new Map();
child.stderr.on("data", (chunk) => {
	errors += chunk.toString();
});
child.stdout.on("data", (chunk) => {
	buffer += chunk.toString();
	while (buffer.includes("\n")) {
		const end = buffer.indexOf("\n"),
			line = buffer.slice(0, end);
		buffer = buffer.slice(end + 1);
		try {
			const message = JSON.parse(line),
				entry = pending.get(message.id);
			if (entry) {
				pending.delete(message.id);
				clearTimeout(entry.timer);
				message.error
					? entry.reject(new Error(JSON.stringify(message.error)))
					: entry.resolve(message.result);
			}
		} catch (error) {
			for (const entry of pending.values()) entry.reject(error);
		}
	}
});
child.on("error", (error) => {
	for (const entry of pending.values()) entry.reject(error);
});
child.on("exit", () => {
	for (const entry of pending.values())
		entry.reject(new Error(`Server exited before replying. ${errors}`));
});
function call(method, params = {}) {
	const id = ++next;
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error(`Timed out: ${method}. ${errors}`));
		}, 60000);
		pending.set(id, { resolve, reject, timer });
		child.stdin.write(
			JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
		);
	});
}
try {
	const initialized = await call("initialize", {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "groovectl-release-smoke", version: "1.0.0" },
	});
	child.stdin.write(
		JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
			"\n",
	);
	assert.equal(initialized.serverInfo.version, expectedVersion);
	const tools = await call("tools/list");
	assert.ok(tools.tools.length >= 40);
	const caps = await call("tools/call", {
		name: "get_capabilities",
		arguments: {},
	});
	assert.equal(caps.structuredContent.player, "windows");
	const invalid = await call("tools/call", {
		name: "control_playback",
		arguments: { action: "volume", value: 101 },
	});
	assert.equal(invalid.isError, true);
	const ui = await call("resources/read", {
		uri: "ui://apple-music-hybrid/workspace",
	});
	assert.ok(ui.contents.some((item) => item.text?.includes("Groovectl")));
	const studio = await call("tools/call", {
		name: "get_playlist_studio",
		arguments: { include_recipes: true },
	});
	assert.ok(studio.structuredContent.recipes.length >= 6);
	console.log(
		JSON.stringify({
			node: process.versions.node,
			version: initialized.serverInfo.version,
			platform: process.platform,
			protocol: initialized.protocolVersion,
			tools: tools.tools.length,
			standalone_stdio: true,
			input_validation: true,
			bundled_ui: true,
		}),
	);
} finally {
	for (const entry of pending.values()) clearTimeout(entry.timer);
	if (child.exitCode === null && child.signalCode === null) {
		child.kill();
		await new Promise((resolve) => child.once("close", resolve));
	}
	rmSync(root, { recursive: true, force: true });
}
