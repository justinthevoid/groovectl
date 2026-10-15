#!/usr/bin/env node
import { parseArgs } from "node:util";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { z } from "zod";
import { importPKCS8 } from "jose";
import { dataDir, savePrivate, loadPrivate } from "./storage.js";
import { AppleCatalog, MusicKitConfig } from "./catalog.js";
import {
	players,
	playerConfig,
	packageRoot,
	loopbackURL,
	PlayerName,
} from "./players.js";
import { MusicService } from "./service.js";
import { createTools } from "./tools.js";
import { ArtworkProvider } from "./artwork-providers.js";
import { Artwork } from "./artwork.js";
import { VERSION } from "./version.js";

const help = `Groovectl ${VERSION} — Apple Music for agents

  groovectl setup                  Guided MusicKit setup (native playback needs no key)
  groovectl configure --key-path PATH --key-id ID --team-id ID [--storefront us]
  groovectl authorize [--port PORT] [--no-open] Connect Apple Music locally or through an SSH tunnel
  groovectl setup-cider [--player cider] [--url http://127.0.0.1:10767] [--token-stdin]
  groovectl select-player native|windows|cider|none
  groovectl setup-artwork --codex-path PATH
  groovectl setup-artwork --provider agy-cli --executable PATH [--daily-limit 3]
  groovectl setup-artwork --provider openai|gemini|openrouter --model MODEL --key-env NAME
                         [--api-key-stdin] [--daily-limit 5] [--no-select]
  groovectl export-artwork ID --output PATH Export a completed PNG/JPEG (never overwrites)
  groovectl install-helper         Build/test and install the macOS Swift helper
  groovectl doctor [--probe]       Check configuration; --probe also contacts the player
  groovectl tools [--profile full|catalog|curator|player]
  groovectl call TOOL [--input JSON] [--input-file PATH]
  groovectl serve [--profile full|catalog|curator|player]

Requires Node 24+. Never put private-key contents or account tokens in chat/config shared with agents.
MusicKit guide: docs/musickit.md. The old apple-music-hybrid command remains an alias.`;
function print(value: unknown) {
	console.log(JSON.stringify(value, null, 2));
}
async function prompt(question: string, secret = false) {
	if (!process.stdin.isTTY)
		throw new Error(
			"Interactive setup needs a terminal. Use configure flags or --token-stdin for Cider.",
		);
	const sink = new Writable({
		write(_chunk, _encoding, callback) {
			callback();
		},
	});
	const rl = createInterface({
		input: process.stdin,
		output: secret ? sink : process.stdout,
		terminal: true,
	});
	try {
		if (secret) process.stdout.write(question);
		const answer = await rl.question(secret ? "" : question);
		if (secret) process.stdout.write("\n");
		return answer.trim();
	} finally {
		rl.close();
	}
}
async function stdinText() {
	let text = "";
	for await (const chunk of process.stdin) {
		text += chunk;
		if (text.length > 32768) throw new Error("Secret input exceeds the limit.");
	}
	return text.trim();
}
async function configure(input: {
	key_path?: string;
	key_id?: string;
	team_id?: string;
	storefront?: string;
}) {
	const config = MusicKitConfig.required({
		key_path: true,
		key_id: true,
		team_id: true,
	}).parse({
		...input,
		key_path: input.key_path
			? resolve(input.key_path.replace(/^~(?=[/\\])/, homedir()))
			: undefined,
	});
	if (process.platform !== "win32" && statSync(config.key_path).mode & 0o077)
		throw new Error(
			"Set the private key file to permissions 0600 before configuring it.",
		);
	await importPKCS8(readFileSync(config.key_path, "utf8"), "ES256");
	savePrivate(join(dataDir(), "musickit.json"), config);
	print({
		configured: true,
		storefront: config.storefront,
		next: "groovectl authorize",
	});
}
async function main() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: {
			help: { type: "boolean", short: "h" },
			version: { type: "boolean", short: "v" },
			profile: { type: "string" },
			"key-path": { type: "string" },
			"key-id": { type: "string" },
			"team-id": { type: "string" },
			storefront: { type: "string" },
			input: { type: "string" },
			"input-file": { type: "string" },
			probe: { type: "boolean" },
			"token-stdin": { type: "boolean" },
			player: { type: "string" },
			url: { type: "string" },
			"codex-path": { type: "string" },
			provider: { type: "string" },
			executable: { type: "string" },
			model: { type: "string" },
			"key-env": { type: "string" },
			"api-key-stdin": { type: "boolean" },
			"daily-limit": { type: "string" },
			"no-select": { type: "boolean" },
			output: { type: "string" },
			port: { type: "string" },
			"no-open": { type: "boolean" },
		},
	});
	if (values.version) {
		console.log(VERSION);
		return;
	}
	const command = positionals[0];
	if (command === "artwork-worker") {
		await new Artwork().run(z.string().uuid().parse(positionals[1]));
		return;
	}
	if (command === "setup-artwork") {
		if (values.help) {
			console.log(help);
			return;
		}
		const provider = ArtworkProvider.parse(values.provider ?? "codex-cli");
		print(
			new Artwork().configureProvider(provider, {
				executable: values.executable ?? values["codex-path"],
				model: values.model,
				key_env: values["key-env"],
				key: values["api-key-stdin"] ? await stdinText() : undefined,
				daily_limit: values["daily-limit"]
					? Number(values["daily-limit"])
					: undefined,
				select: !values["no-select"],
			}),
		);
		return;
	}

	if (command === "export-artwork") {
		if (!values.output)
			throw new Error("Pass --output for the image destination.");
		const image = new Artwork().image(z.string().uuid().parse(positionals[1]));
		const { writeFileSync } = await import("node:fs");
		writeFileSync(resolve(values.output), Buffer.from(image.data, "base64"), {
			flag: "wx",
			mode: 0o600,
		});
		print({ exported: true, mime_type: image.mimeType });
		return;
	}
	if (values.help || !command) {
		console.log(help);
		return;
	}
	const profile = z
		.enum(["full", "catalog", "curator", "player"])
		.parse(values.profile ?? process.env.GROOVECTL_PROFILE ?? "full");
	if (command === "serve") {
		if (values.profile) process.env.GROOVECTL_PROFILE = profile;
		await (await import("./server.js")).serve();
		return;
	}
	if (command === "configure")
		return configure({
			key_path: values["key-path"],
			key_id: values["key-id"],
			team_id: values["team-id"],
			storefront: values.storefront,
		});
	if (command === "setup") {
		console.log(
			"Native Music.app playback works without a developer key. Catalog and API library tools use your own MusicKit key.\nCreate a Media ID and a MusicKit-enabled key at https://developer.apple.com/account/resources/identifiers/list/mediaId\nSee docs/musickit.md. Groovectl does not request your Apple password or upload your .p8 key.",
		);
		await configure({
			key_path: await prompt("MusicKit .p8 key path: "),
			key_id: await prompt("Key ID (10 characters): "),
			team_id: await prompt("Team ID (10 characters): "),
			storefront: (await prompt("Storefront country code [us]: ")) || "us",
		});
		console.log(
			"Run groovectl authorize next. On macOS, run groovectl install-helper for native library access and playback.",
		);
		return;
	}
	if (command === "authorize") {
		const auth = await (await import("./authorize.js")).startAuthorization(
			undefined,
			{
				port: values.port === undefined ? undefined : Number(values.port),
			},
		);
		console.log(`Open this local setup link in your browser:\n${auth.url}`);
		const opener =
			process.platform === "darwin"
				? "/usr/bin/open"
				: process.platform === "win32"
					? "explorer.exe"
					: "xdg-open";
		if (!values["no-open"])
			execFile(opener, [auth.url], { timeout: 10000 }, () => {});
		if (!(await auth.completed))
			throw new Error(
				"Authorization timed out or was cancelled. No account token was saved.",
			);
		print({ connected: true });
		return;
	}
	if (command === "setup-cider") {
		const url = loopbackURL(values.url ?? playerConfig().cider_url).origin;
		console.log(
			"Create a Cider token in Settings → Connectivity → Manage External Application Access. Keep API authentication enabled.",
		);
		const token = values["token-stdin"]
			? await stdinText()
			: (process.env.CIDER_API_TOKEN ??
				(await prompt("Cider application token (hidden): ", true)));
		z.string().min(8).max(4096).parse(token);
		const player = z
			.enum(["native", "windows", "cider"])
			.parse(values.player ?? "cider");
		savePrivate(join(dataDir(), "player.json"), {
			...playerConfig(),
			cider_url: url,
			cider_token: token,
			player,
		});
		print({ configured: true, player, next: "groovectl doctor --probe" });
		return;
	}
	if (command === "select-player") {
		const player = PlayerName.parse(positionals[1]);
		savePrivate(join(dataDir(), "player.json"), { ...playerConfig(), player });
		print({ player });
		return;
	}
	if (command === "install-helper") {
		const { spawnSync } = await import("node:child_process");
		const r = spawnSync(
			process.execPath,
			[join(packageRoot, "scripts/install-helper.mjs")],
			{ stdio: "inherit", env: process.env },
		);
		process.exitCode = r.status ?? 1;
		return;
	}
	const adapters = players(),
		catalog = new AppleCatalog();
	if (command === "doctor") {
		const status: Record<string, unknown> = {
			version: VERSION,
			node: process.versions.node,
			platform: process.platform,
			player: adapters.selected.name,
			data_directory: dataDir(),
			auth: catalog.readiness(),
			artwork: new Artwork().readiness(),
			helper_installed:
				process.platform === "darwin"
					? existsSync(join(homedir(), "Applications/Groovectl Helper.app"))
					: null,
			legacy_configuration_reused: dataDir().endsWith("apple-music-hybrid"),
			diagnostics: [],
		};
		if (catalog.readiness().developer_key_configured) {
			try {
				await catalog.developerToken();
				status.developer_key_valid = true;
			} catch {
				status.developer_key_valid = false;
				status.diagnostics = [
					"MusicKit private key could not be loaded or signed. Check its path, format and permissions.",
				];
			}
		}
		if (values.probe) {
			try {
				status.playback = await adapters.selected.status();
			} catch (e) {
				status.playback = {
					error: e instanceof Error ? e.message : "Player probe failed.",
				};
			}
		}
		print(status);
		return;
	}
	const music = new MusicService(adapters.native, catalog),
		tools = createTools(music, adapters.selected, adapters.cider, profile);
	try {
		if (command === "tools") {
			print({
				profile,
				count: tools.length,
				tools: tools.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: z.toJSONSchema(t.schema, { io: "input" }),
				})),
			});
			return;
		}
		if (command === "call") {
			const tool = tools.find((t) => t.name === positionals[1]);
			if (!tool)
				throw new Error(
					"Unknown tool or tool excluded by this profile. Run groovectl tools.",
				);
			if (values.input && values["input-file"])
				throw new Error("Use --input or --input-file, not both.");
			const input: unknown = JSON.parse(
				values["input-file"]
					? readFileSync(values["input-file"], "utf8")
					: (values.input ?? "{}"),
			);
			print(await tool.execute(input));
			return;
		}
		throw new Error(`Unknown command ${command}. Run groovectl --help.`);
	} finally {
		music.plans.close();
	}
}
main().catch((e) => {
	const message =
		e instanceof z.ZodError
			? e.issues
					.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
					.join("; ")
			: e instanceof Error
				? e.message
				: "Operation failed.";
	console.error(`Groovectl: ${message}`);
	process.exitCode = 1;
});
