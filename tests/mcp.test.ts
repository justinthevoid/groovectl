import { test } from "node:test";
import assert from "node:assert/strict";
import { Client as LegacyClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport as LegacyTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { root } from "./helpers.js";
import { UI_URI } from "../src/server.js";
import { resolve } from "node:path";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Artwork, rasterInfo } from "../src/artwork.js";
import { savePrivate } from "../src/storage.js";

for (const modern of [false, true])
	test(`${modern ? "SDK 2" : "legacy"} stdio client discovers tools, structured results and the MCP App`, {
		timeout: 20000,
	}, async () => {
		const env = Object.fromEntries(
			Object.entries(process.env).filter(
				(entry): entry is [string, string] => entry[1] !== undefined,
			),
		);
		env.GROOVECTL_DATA = root();
		const artwork = new Artwork(env.GROOVECTL_DATA);
		artwork.configure(process.execPath);
		const art = artwork.create("Synthetic test cover", randomUUID(), () => {}),
			folder = join(env.GROOVECTL_DATA, "artwork", art.artwork_id);
		const bytes = readFileSync(
			new URL("./fixtures/square.jpg", import.meta.url),
		);
		writeFileSync(join(folder, "cover.jpg"), bytes);
		savePrivate(join(folder, "job.json"), {
			...JSON.parse(readFileSync(join(folder, "job.json"), "utf8")),
			...rasterInfo(bytes),
			state: "complete",
		});
		env.GROOVECTL_PLAYER = "windows";
		const options = {
			command: process.execPath,
			args: [resolve("dist/cli.js"), "serve"],
			env,
			stderr: "pipe" as const,
		};
		const transport = modern
			? new StdioClientTransport(options)
			: new LegacyTransport(options);
		const client = modern
			? new Client({ name: "groovectl-test", version: "1.0.0" })
			: new LegacyClient({ name: "groovectl-test", version: "1.0.0" });
		try {
			await client.connect(transport);
			const tools = await client.listTools();
			assert.equal(tools.tools.length, 51);
			assert.ok(tools.tools.some((t) => t.name === "preview_music_change"));
			assert.ok(tools.tools.some((t) => t.name === "preview_playlist"));
			const result = await client.callTool({
				name: "get_capabilities",
				arguments: {},
			});
			assert.equal(result.isError, undefined);
			assert.equal(result.structuredContent?.player, "windows");
			const recipeCatalog = await client.callTool({
				name: "get_playlist_studio",
				arguments: { include_recipes: true },
			});
			assert.equal((recipeCatalog.structuredContent?.recipes as unknown[]).length, 6);
			const invalid = await client.callTool({
				name: "control_playback",
				arguments: { action: "volume", value: 101 },
			});
			assert.equal(invalid.isError, true);
			assert.match(
				JSON.stringify(invalid.content),
				/Volume must be an integer from 0 to 100/,
			);
			const ui = await client.readResource({ uri: UI_URI });
			assert.ok(
				ui.contents.some((c) => "text" in c && c.text.includes("Groovectl")),
			);
			const open = await client.callTool({ name: "open_music", arguments: {} });
			assert.ok(open.structuredContent?.auth);
			const cover = await client.callTool({
				name: "get_playlist_artwork",
				arguments: { artwork_id: art.artwork_id },
			});
			assert.ok(
				Array.isArray(cover.content) &&
					cover.content.some(
						(c) => c.type === "image" && c.mimeType === "image/jpeg",
					),
			);
			const coverUI = await client.callTool({
				name: "get_playlist_artwork",
				arguments: { artwork_id: art.artwork_id, include_image: false },
			});
			assert.ok(
				String(coverUI._meta?.artwork).startsWith("data:image/jpeg;base64,"),
			);
			const resource = await client.readResource({
				uri: `groovectl://artwork/${art.artwork_id}`,
			});
			assert.equal(resource.contents[0]?.mimeType, "image/jpeg");
			const saved = await client.callTool({
				name: "save_listening_brief",
				arguments: {
					brief: {
						title: "Dinner",
						intent: "45 minutes of soul",
						duration_minutes: 45,
						explicit: "avoid",
						exclude: ["live versions"],
					},
				},
			});
			assert.equal(saved.isError, undefined);
			const draftId = String(saved.structuredContent?.draft_id);
			const ideas = await client.callTool({
				name: "get_playlist_studio",
				arguments: { draft_id: draftId, field: "mood", seed: 12 },
			});
			assert.equal(ideas.isError, undefined);
			assert.equal(
				(ideas.structuredContent?.inspiration as { choices: unknown[] }).choices
					.length,
				6,
			);
			const remix = await client.callTool({
				name: "save_listening_brief",
				arguments: {
					draft_id: draftId,
					brief: {},
					locked: ["title"],
					randomize: { field: "unlocked", only_empty: false },
					seed: 18,
				},
			});
			assert.equal(remix.isError, undefined);
			assert.equal(
				(remix.structuredContent?.brief as { explicit: string }).explicit,
				"avoid",
			);
			const studio = await client.callTool({
				name: "get_playlist_studio",
				arguments: {},
			});
			const drafts = studio.structuredContent?.drafts as Array<{
				brief: { explicit: string; exclude: string[] };
			}>;
			assert.equal(drafts[0]?.brief.explicit, "avoid");
			assert.deepEqual(drafts[0]?.brief.exclude, ["live versions"]);
			assert.equal(
				studio.structuredContent?.provider &&
					typeof studio.structuredContent.provider,
				"object",
			);
		} finally {
			await client.close();
		}
	});
