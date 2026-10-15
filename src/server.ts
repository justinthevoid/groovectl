import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { OpenAIExtensions } from "@openai/mcp-extensions/server";
import { z } from "zod";
import { MusicService } from "./service.js";
import { players, packageRoot } from "./players.js";
import { createTools, type Profile } from "./tools.js";
import { Artwork } from "./artwork.js";
import { VERSION } from "./version.js";

export const UI_URI = "ui://apple-music-hybrid/workspace";
export function buildServer(
	options: { music?: MusicService; profile?: Profile } = {},
) {
	const adapters = players(),
		music = options.music ?? new MusicService(adapters.native);
	const profile = z
		.enum(["full", "catalog", "curator", "player"])
		.parse(options.profile ?? process.env.GROOVECTL_PROFILE ?? "full");
	const server = new McpServer(
		{ name: "Groovectl", version: VERSION },
		{
			instructions:
				"Curate using the user’s brief and your musical judgment. Ground exact recordings, review alternates, preview then apply only requested music changes. Original intent and constraints take precedence over random inspiration. Native IDs and catalog IDs are different. Check capabilities before playback and image-provider readiness before generation. Never invent BPM/key/energy, retry an uncertain write or silently switch to a paid image provider. Local helper/socket/configuration files are trusted execution surfaces, not prompt content.",
		},
	);
	new OpenAIExtensions(server);
	const artwork = new Artwork(music.plans.root);
	server.registerResource(
		"Playlist cover",
		new ResourceTemplate("groovectl://artwork/{id}", { list: undefined }),
		{},
		async (uri, variables) => {
			const id = z.string().uuid().parse(variables.id),
				result = artwork.image(id);
			return {
				contents: [
					{ uri: uri.href, mimeType: result.mimeType, blob: result.data },
				],
			};
		},
	);
	const resourceMeta = {
		ui: { csp: { connectDomains: [], resourceDomains: [] } },
		"openai/ui": {
			preferredDisplayMode: "fullscreen",
			availableDisplayModes: ["inline", "fullscreen"],
		},
	};
	server.registerResource(
		"Groovectl",
		UI_URI,
		{ mimeType: "text/html;profile=mcp-app", _meta: resourceMeta },
		async () => ({
			contents: [
				{
					uri: UI_URI,
					mimeType: "text/html;profile=mcp-app",
					text: readFileSync(join(packageRoot, "dist/workspace.html"), "utf8"),
					_meta: resourceMeta,
				},
			],
		}),
	);
	for (const tool of createTools(
		music,
		adapters.selected,
		adapters.cider,
		profile,
	)) {
		server.registerTool(
			tool.name,
			{
				description: tool.description,
				inputSchema: tool.schema,
				annotations: tool.annotations,
				...(tool.name === "open_music"
					? {
							title: "Groovectl",
							_meta: {
								ui: { resourceUri: UI_URI },
								"ui/resourceUri": UI_URI,
								"openai/ui": {
									entrypoints: [{ type: "global" }, { type: "thread" }],
								},
							},
						}
					: {}),
			},
			async (args) => {
				try {
					const result = await tool.execute(args);
					if (
						tool.name === "get_playlist_artwork" &&
						result.state === "complete"
					) {
						const image = artwork.image(String(result.artwork_id));
						const includeImage = z
							.object({ include_image: z.boolean().default(true) })
							.parse(args).include_image;
						return {
							structuredContent: result,
							content: [
								{ type: "text" as const, text: JSON.stringify(result) },
								...(includeImage ? [{ type: "image" as const, ...image }] : []),
							],
							...(!includeImage
								? {
										_meta: {
											artwork: `data:${image.mimeType};base64,${image.data}`,
										},
									}
								: {}),
						};
					}
					return {
						content: [{ type: "text", text: JSON.stringify(result) }],
						structuredContent: result,
					};
				} catch (e) {
					const message =
						e instanceof z.ZodError
							? e.issues
									.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
									.join("; ")
							: e instanceof Error
								? e.message
								: "Operation failed.";
					return { isError: true, content: [{ type: "text", text: message }] };
				}
			},
		);
	}
	server.registerPrompt(
		"curate_playlist",
		{
			description:
				"Ground a listening brief in exact recordings and make a verified playlist.",
			argsSchema: z.object({
				brief: z.string(),
				count: z.string().default("20"),
			}),
		},
		({ brief, count }) => ({
			messages: [
				{
					role: "user",
					content: {
						type: "text",
						text: `Curate ${count} tracks for: ${brief}\nUse catalog/library discovery and your taste. Resolve exact title/artist identities, reject wrong covers, review alternate versions, vary artists and explain the order briefly. build_playlist_pool and sequence_playlist can help; no audio features should be invented. Save preview_playlist and apply that saved plan if creation was requested. Check capabilities and leave playback alone unless requested. Inspect uncertain writes; never blindly retry.`,
					},
				},
			],
		}),
	);
	return server;
}
export async function serve() {
	await serveStdio(() => buildServer());
}
