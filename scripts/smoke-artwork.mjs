// Read-only qualification against a completed local artwork job; no generation.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const id = process.argv[2];
if (!id || !process.env.GROOVECTL_DATA)
	throw new Error(
		"Supply a completed artwork UUID and explicit GROOVECTL_DATA.",
	);
for (const modern of [false, true]) {
	const options = {
		command: process.execPath,
		args: [resolve("dist/cli.js"), "serve"],
		env: { ...process.env, GROOVECTL_PLAYER: "windows" },
		stderr: "pipe",
	};
	const client = modern
		? new Client({ name: "artwork-smoke", version: "1.0.0" })
		: new LegacyClient({ name: "artwork-smoke", version: "1.0.0" });
	const transport = modern
		? new StdioClientTransport(options)
		: new LegacyTransport(options);
	try {
		await client.connect(transport);
		const result = await client.callTool({
			name: "get_playlist_artwork",
			arguments: { artwork_id: id },
		});
		assert.equal(result.isError, undefined);
		assert.equal(result.structuredContent.state, "complete");
		const image = result.content.find((c) => c.type === "image");
		assert.ok(image);
		const digest = createHash("sha256")
			.update(Buffer.from(image.data, "base64"))
			.digest("hex");
		assert.equal(digest, result.structuredContent.sha256);
		const resource = await client.readResource({
			uri: result.structuredContent.uri,
		});
		assert.equal(resource.contents[0].blob, image.data);
		const ui = await client.callTool({
			name: "get_playlist_artwork",
			arguments: { artwork_id: id, include_image: false },
		});
		assert.equal(
			ui.content.some((c) => c.type === "image"),
			false,
		);
		assert.equal(ui._meta.artwork, `data:image/png;base64,${image.data}`);
		console.log(
			JSON.stringify({
				client: modern ? "SDK2" : "SDK1",
				standard_image: true,
				resource_read: true,
				ui_metadata: true,
				sha256: digest,
			}),
		);
	} finally {
		await client.close();
	}
}
