/** Operator/CI smoke: pass a stdio command using an isolated persistent data directory. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const [command, ...args] = process.argv.slice(2);
if (!command)
	throw new Error(
		"Pass an API-only stdio command with isolated persistent storage. Example: node scripts/smoke-headless.mjs ssh -T your-host /path/to/headless-groovectl",
	);
const marker = `Synthetic package qualification ${randomUUID()}`;
let draftId;
for (let run = 0; run < 2; run++) {
	const transport = new StdioClientTransport({ command, args, stderr: "pipe" });
	const client = new Client({
		name: "groovectl-headless-smoke",
		version: "1.0.0",
	});
	try {
		await client.connect(transport);
		const tools = await client.listTools();
		assert.ok(
			!tools.tools.some((t) => t.name === "control_playback"),
			"Headless mode must omit playback tools.",
		);
		const caps = await client.callTool({
			name: "get_capabilities",
			arguments: {},
		});
		assert.equal(caps.isError, undefined);
		assert.equal(caps.structuredContent?.player, "none");
		if (run === 0) {
			const result = await client.callTool({
				name: "save_listening_brief",
				arguments: {
					brief: {
						title: marker,
						intent:
							"Synthetic qualification only. No music account writes, playback or image generation.",
					},
				},
			});
			assert.equal(result.isError, undefined);
			draftId = result.structuredContent?.draft_id;
			assert.equal(typeof draftId, "string");
		} else {
			const result = await client.callTool({
				name: "get_playlist_studio",
				arguments: { draft_id: draftId, include_recipes: true },
			});
			assert.equal(result.isError, undefined);
			assert.ok(
				result.structuredContent?.drafts.some(
					(d) => d.draft_id === draftId && d.title === marker,
				),
				"Private draft did not survive process replacement.",
			);
			assert.equal(result.structuredContent?.draft.brief.title, marker);
			assert.equal(
				result.structuredContent?.draft.brief.intent,
				"Synthetic qualification only. No music account writes, playback or image generation.",
			);
			assert.equal(result.structuredContent?.recipes.length, 6);
		}
		const ui = await client.readResource({
			uri: "ui://apple-music-hybrid/workspace",
		});
		assert.ok(
			ui.contents.some(
				(c) => typeof c.text === "string" && c.text.includes("Groovectl"),
			),
		);
		console.log(
			JSON.stringify({
				run: run + 1,
				tools: tools.tools.length,
				headless_stdio: true,
				bundled_ui: true,
				...(run ? { persistent_draft: true } : {}),
			}),
		);
	} finally {
		await client.close();
	}
}
