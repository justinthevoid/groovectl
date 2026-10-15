import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { dataDir, loadPrivate } from "./storage.js";
import {
	nativeId,
	Playlist,
	Track,
	PlaybackRequest,
	type NativeBackend,
	type Playback,
} from "./models.js";
const exec = promisify(execFile);
export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PlayerName = z.enum(["native", "cider", "windows", "none"]);
export type PlayerName = z.infer<typeof PlayerName>;
const PlayerConfig = z.object({
	player: PlayerName.optional(),
	cider_url: z.string().default("http://127.0.0.1:10767"),
	cider_token: z.string().optional(),
});
export function playerConfig(root = dataDir()) {
	return PlayerConfig.parse(loadPrivate(join(root, "player.json")));
}
const optionalNumber = z.preprocess(
	(v) => (v === null ? undefined : v),
	z.number().optional(),
);
const playbackSchema = z
	.object({
		running: z.boolean(),
		state: z.string(),
		volume: optionalNumber,
		position: optionalNumber,
		track: Track.nullish(),
	})
	.passthrough();
export interface Player {
	name: PlayerName;
	status(): Promise<Playback>;
	playback(request: PlaybackRequest): Promise<Playback>;
}
export class NoPlayer implements Player {
	name = "none" as const;
	async status(): Promise<Playback> {
		return {
			running: false,
			state: "api-only",
			message: "Catalog, library and curation work without a desktop player.",
		};
	}
	async playback(_request: PlaybackRequest): Promise<Playback> {
		throw new Error(
			"No desktop player is selected. Choose native, windows or cider on its playback host.",
		);
	}
}
export function playerCapabilities(
	name: PlayerName,
	platform: NodeJS.Platform = process.platform,
) {
	const available =
		name === "cider" ||
		(name === "native" && platform === "darwin") ||
		(name === "windows" && platform === "win32");
	const actions = !available
		? []
		: name === "windows"
			? ["play", "pause", "stop", "next", "previous", "seek"]
			: [
					"play",
					"pause",
					"stop",
					"next",
					"previous",
					"seek",
					"volume",
					"shuffle",
					"repeat",
				];
	return {
		available,
		actions,
		targeted_play: available && name !== "windows",
		volume: available && name !== "windows",
		queue: name === "cider",
		qualification:
			name === "none"
				? "API-only; no desktop playback."
				: !available
					? "The selected adapter requires its desktop operating system."
					: name === "windows"
						? "Experimental SMTC; commands check the active Apple Music session capability."
						: name === "cider"
							? "Requires a running Cider instance and its application token; this is adapter support, not a connection check."
							: "Requires Music.app automation permission on this Mac.",
	};
}
export class MacMusic implements NativeBackend, Player {
	name = "native" as const;
	private launching?: Promise<void>;
	readonly socket = join(
		homedir(),
		"Library/Application Support/Groovectl/run/helper.sock",
	);
	bridge(): "swift-helper" | "compatibility" {
		const mode = process.env.GROOVECTL_NATIVE_MODE ?? "auto";
		if (!["auto", "helper", "compatibility"].includes(mode))
			throw new Error(
				"GROOVECTL_NATIVE_MODE must be auto, helper or compatibility.",
			);
		return mode === "compatibility" ||
			(mode === "auto" &&
				!existsSync(
					process.env.GROOVECTL_HELPER_APP ??
						join(homedir(), "Applications/Groovectl Helper.app"),
				))
			? "compatibility"
			: "swift-helper";
	}
	private async script(source: string): Promise<string> {
		try {
			return (
				await exec(
					"/usr/bin/osascript",
					["-e", `with timeout of 40 seconds\n${source}\nend timeout`],
					{ timeout: 45000, maxBuffer: 4_194_304 },
				)
			).stdout.trim();
		} catch (error) {
			const stderr =
				typeof error === "object" &&
				error !== null &&
				"stderr" in error &&
				typeof error.stderr === "string"
					? error.stderr
					: "";
			const code = stderr.match(/\((-?\d{1,6})\)\s*$/m)?.[1];
			throw new Error(
				`Music.app automation failed or timed out${code ? ` (Apple Event ${code})` : ""}. Check this agent host’s Automation permission; inspect any attempted write before retrying.`,
			);
		}
	}
	private quoted(value: string) {
		return (
			'"' +
			value
				.replaceAll("\\", "\\\\")
				.replaceAll('"', '\\"')
				.replaceAll("\r", "\\r")
				.replaceAll("\n", "\\n") +
			'"'
		);
	}
	private async compatibility(
		op: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		if (process.platform !== "darwin")
			throw new Error(
				"Native Music.app access requires macOS. Select Cider or use the official catalog/library API.",
			);
		if (["status", "search", "playlists", "playlist", "tracks"].includes(op)) {
			const { stdout } = await exec(
				"/usr/bin/osascript",
				[
					"-l",
					"JavaScript",
					join(packageRoot, "native/Sources/MusicBridge/music.js"),
					JSON.stringify({ op, ...args }),
				],
				{ timeout: 45000, maxBuffer: 4_194_304 },
			);
			const reply = z
				.object({ error: z.string().optional() })
				.passthrough()
				.parse(JSON.parse(stdout));
			if (reply.error) throw new Error(reply.error);
			return op === "status" ? { ...reply, bridge: "compatibility" } : reply;
		}
		if (op === "create" || op === "append") {
			const ids = z
				.array(z.string())
				.min(1)
				.max(200)
				.parse(args.ids)
				.map(nativeId);
			const name = z
				.string()
				.max(120)
				.parse(args.name ?? "");
			if (op === "create" && !name.trim())
				throw new Error("A playlist name is required.");
			const resolves = ids
				.map(
					(id, i) =>
						`set t${i} to first track of library playlist 1 whose persistent ID is "${id}"`,
				)
				.join("\n");
			const target =
				op === "create"
					? `set p to make new user playlist with properties {name:${this.quoted(name)}}`
					: `set p to first user playlist whose persistent ID is "${nativeId(String(args.id))}"`;
			// Creation returns its identity first; the caller journals it before adding.
			const adds =
				op === "append"
					? ids.map((_id, i) => `duplicate t${i} to p`).join("\n")
					: "";
			const id = await this.script(
				`tell application "Music"\n${resolves}\n${target}\n${adds}\nreturn persistent ID of p\nend tell`,
			);
			return { id: nativeId(id) };
		}
		if (op === "playback") {
			const r = PlaybackRequest.parse(args);
			let command: string;
			if (r.action === "play" && (r.track_id || r.playlist_id))
				command = `play (first ${r.playlist_id ? "user playlist" : "track of library playlist 1"} whose persistent ID is "${nativeId(r.track_id ?? r.playlist_id!)}")`;
			else if (r.action === "volume")
				command = `set sound volume to ${r.value}`;
			else if (r.action === "seek")
				command = `set player position to ${r.value}`;
			else if (r.action === "shuffle")
				command = `set shuffle enabled to ${r.value === 1 ? "true" : "false"}`;
			else if (r.action === "repeat")
				command = `set song repeat to ${["off", "one", "all"][r.value!]}`;
			else
				command = (
					{
						play: "play",
						pause: "pause",
						stop: "stop",
						next: "next track",
						previous: "previous track",
					} as const
				)[r.action];
			await this.script(`tell application "Music" to ${command}`);
			return this.compatibility("status", {});
		}
		if (op === "delete_owned") {
			const id = nativeId(String(args.id)),
				name = z.string().min(1).max(120).parse(args.name);
			await this.script(
				`tell application "Music"\nset p to first user playlist whose persistent ID is "${id}"\nif name of p is not ${this.quoted(name)} then error "Playlist name changed; refusing deletion"\ndelete p\nend tell`,
			);
			return { deleted: true };
		}
		throw new Error("Unsupported native operation.");
	}
	private async connect(request: Record<string, unknown>): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const socket = createConnection(this.socket);
			let data = "";
			socket.setTimeout(45000, () =>
				socket.destroy(
					new Error(
						"Groovectl Helper timed out. Inspect any pending write before retrying.",
					),
				),
			);
			socket.once("error", reject);
			socket.once("connect", () =>
				socket.write(JSON.stringify(request) + "\n"),
			);
			socket.on("data", (chunk) => {
				data += chunk.toString("utf8");
				if (data.length > 4_194_304) {
					socket.destroy(new Error("Helper response exceeded the limit."));
					return;
				}
				const end = data.indexOf("\n");
				if (end < 0) return;
				socket.end();
				try {
					const reply = z
						.object({
							result: z.unknown().optional(),
							error: z.string().optional(),
						})
						.parse(JSON.parse(data.slice(0, end)));
					if (reply.error) reject(new Error(reply.error));
					else resolve(reply.result);
				} catch (e) {
					reject(e);
				}
			});
			socket.on("end", () => {
				if (!data.includes("\n"))
					reject(new Error("Helper closed without a complete response."));
			});
		});
	}
	private async ensureHost(): Promise<void> {
		if (process.platform !== "darwin")
			throw new Error(
				"Native Music.app library access requires macOS. Use the catalog API or Cider on this platform.",
			);
		try {
			await this.connect({ op: "ping" });
			return;
		} catch {
			/* A ping has no side effects; launching does not replay the requested operation. */
		}
		const app =
			process.env.GROOVECTL_HELPER_APP ??
			join(homedir(), "Applications/Groovectl Helper.app");
		if (!existsSync(app))
			throw new Error(
				"Groovectl Helper is not installed. Run `groovectl install-helper` on your Mac.",
			);
		if (!this.launching)
			this.launching = (async () => {
				await exec("/usr/bin/open", ["-gj", app], { timeout: 10000 });
				for (let i = 0; i < 40; i++) {
					try {
						await this.connect({ op: "ping" });
						return;
					} catch {
						await new Promise((r) => setTimeout(r, 100));
					}
				}
				throw new Error(
					"Groovectl Helper did not start. Check the signed app and macOS security settings.",
				);
			})().finally(() => {
				this.launching = undefined;
			});
		return this.launching;
	}
	async request(
		op: string,
		args: Record<string, unknown> = {},
	): Promise<unknown> {
		if (this.bridge() === "compatibility") return this.compatibility(op, args);
		await this.ensureHost();
		return this.connect({ op, ...args });
	}
	async status() {
		return playbackSchema.parse(await this.request("status"));
	}
	async playlists() {
		return z
			.object({
				playlists: z.array(
					z.object({ id: z.string(), name: z.string() }).passthrough(),
				),
			})
			.parse(await this.request("playlists"));
	}
	async playlist(id: string) {
		return Playlist.parse(await this.request("playlist", { id: nativeId(id) }));
	}
	async tracks(ids: string[]) {
		return z
			.object({ tracks: z.array(Track) })
			.parse(await this.request("tracks", { ids: ids.map(nativeId) })).tracks;
	}
	async search(query: string, limit: number, offset: number) {
		return z
			.object({ tracks: z.array(Track), total: z.number(), offset: z.number() })
			.parse(await this.request("search", { query, limit, offset }));
	}
	async create(
		name: string,
		ids: string[],
		_description = "",
		accepted?: (id: string) => void,
	) {
		const { id } = z
			.object({ id: z.string() })
			.parse(await this.request("create", { name, ids: ids.map(nativeId) }));
		accepted?.(id);
		return this.append(id, ids);
	}
	async append(id: string, ids: string[]) {
		await this.request("append", { id: nativeId(id), ids: ids.map(nativeId) });
		return this.playlist(id);
	}
	async playback(input: PlaybackRequest) {
		const r = PlaybackRequest.parse(input);
		if (r.track_id) r.track_id = nativeId(r.track_id);
		if (r.playlist_id) r.playlist_id = nativeId(r.playlist_id);
		return playbackSchema.parse(await this.request("playback", r));
	}
	async deleteOwned(id: string, expectedName: string) {
		await this.request("delete_owned", {
			id: nativeId(id),
			name: expectedName,
		});
	}
}

export function loopbackURL(value: string): URL {
	const url = new URL(value);
	if (
		url.protocol !== "http:" ||
		!["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	)
		throw new Error(
			"Cider must use an HTTP loopback origin, such as http://127.0.0.1:10767.",
		);
	return url;
}
const CiderInfo = z
	.object({
		name: z.string().default(""),
		artistName: z.string().default(""),
		albumName: z.string().default(""),
		durationInMillis: z.number().default(0),
		currentPlaybackTime: z.number().optional(),
		playParams: z
			.object({ id: z.string().optional() })
			.passthrough()
			.optional(),
	})
	.passthrough();
function ciderTrack(value: unknown): Track {
	const a = CiderInfo.parse(value);
	return Track.parse({
		source: "catalog",
		id: a.playParams?.id ?? "unknown",
		name: a.name,
		artist: a.artistName,
		album: a.albumName,
		duration_ms: a.durationInMillis,
	});
}
export class Cider implements Player {
	name = "cider" as const;
	private url: URL;
	constructor(
		url: string,
		private token?: string,
		private fetcher: typeof fetch = fetch,
	) {
		this.url = loopbackURL(url);
	}
	async request(
		method: "GET" | "POST",
		endpoint: string,
		body?: unknown,
	): Promise<unknown> {
		const allowed = [
			"now-playing",
			"is-playing",
			"volume",
			"queue",
			"play",
			"pause",
			"stop",
			"next",
			"previous",
			"seek",
			"shuffle-mode",
			"repeat-mode",
			"toggle-shuffle",
			"toggle-repeat",
			"play-item",
			"play-next",
			"play-later",
		];
		if (!allowed.includes(endpoint))
			throw new Error("Unsupported Cider operation.");
		let response: Response;
		try {
			response = await this.fetcher(
				new URL(`/api/v1/playback/${endpoint}`, this.url),
				{
					method,
					headers: {
						...(this.token ? { apptoken: this.token } : {}),
						...(body ? { "Content-Type": "application/json" } : {}),
					},
					body: body ? JSON.stringify(body) : undefined,
					redirect: "error",
					signal: AbortSignal.timeout(5000),
				},
			);
		} catch {
			throw new Error(
				"Cider did not respond on the configured loopback address. Requests are not retried.",
			);
		}
		if (!response.ok)
			throw new Error(
				`Cider returned HTTP ${response.status}. For 401/403, configure an external application token with groovectl setup-cider.`,
			);
		const result: unknown = await response.json();
		const envelope = z
			.object({ status: z.string().optional(), error: z.unknown().optional() })
			.passthrough()
			.safeParse(result);
		if (
			envelope.success &&
			(envelope.data.error || envelope.data.status === "error")
		)
			throw new Error(
				"Cider rejected the operation. Inspect the player before retrying.",
			);
		return result;
	}
	async status(): Promise<Playback> {
		const [now, playing, volume] = await Promise.all([
			this.request("GET", "now-playing"),
			this.request("GET", "is-playing"),
			this.request("GET", "volume"),
		]);
		const { info } = z.object({ info: CiderInfo.nullish() }).parse(now);
		return {
			running: true,
			state: z.object({ is_playing: z.boolean() }).parse(playing).is_playing
				? "playing"
				: "paused",
			volume: Math.round(
				z.object({ volume: z.number().min(0).max(1) }).parse(volume).volume *
					100,
			),
			track: info?.playParams?.id ? ciderTrack(info) : null,
			position: info?.currentPlaybackTime,
		};
	}
	async playback(input: PlaybackRequest): Promise<Playback> {
		const r = PlaybackRequest.parse(input);
		if (r.track_id || r.playlist_id) {
			const id = r.track_id ?? r.playlist_id!;
			if (!/^[\w.-]{1,100}$/.test(id) || (r.track_id && !/^\d{1,20}$/.test(id)))
				throw new Error(
					"Cider play targets require catalog IDs. Native persistent IDs are a different namespace.",
				);
			await this.request("POST", "play-item", {
				type: r.track_id ? "songs" : "playlists",
				id,
			});
		} else if (r.action === "volume")
			await this.request("POST", "volume", { volume: r.value! / 100 });
		else if (r.action === "seek")
			await this.request("POST", "seek", { position: r.value });
		else if (r.action === "shuffle" || r.action === "repeat") {
			const field = r.action === "shuffle" ? "shuffle" : "repeat";
			// Cider's documented mode endpoints toggle, so serialize and read back each bounded step.
			for (let i = 0; i < (field === "shuffle" ? 2 : 3); i++) {
				const result = z
					.record(z.string(), z.unknown())
					.parse(await this.request("GET", `${field}-mode`));
				const value =
					result.value ??
					result.mode ??
					result[`${field}_mode`] ??
					result[field];
				if ((typeof value === "boolean" ? Number(value) : value) === r.value)
					return this.status();
				if (typeof value !== "number" && typeof value !== "boolean")
					throw new Error(
						"Cider returned an unrecognized mode; no toggle was sent.",
					);
				await this.request("POST", `toggle-${field}`);
			}
			throw new Error(
				"Cider mode did not converge. Inspect the player before changing it again.",
			);
		} else await this.request("POST", r.action);
		return this.status();
	}
	async queue() {
		const raw = await this.request("GET", "queue");
		const items = z
			.array(
				z
					.object({
						id: z.string().optional(),
						attributes: CiderInfo.optional(),
					})
					.passthrough(),
			)
			.parse(raw);
		// Never return Cider's raw queue: it can contain asset URLs, DRM metadata and keys.
		return {
			player: this.name,
			tracks: items.slice(0, 500).map((t, i) => ({
				position: i + 1,
				...ciderTrack({
					...t.attributes,
					playParams: { id: t.attributes?.playParams?.id ?? t.id },
				}),
			})),
			truncated: items.length > 500,
		};
	}
	async enqueue(id: string, position: "next" | "later") {
		z.string()
			.regex(/^\d{1,20}$/)
			.parse(id);
		await this.request("POST", `play-${position}`, { type: "songs", id });
		return { queued: true, catalog_id: id, position, player: this.name };
	}
}
export class WindowsMusic implements Player {
	name = "windows" as const;
	private async request(request: Record<string, unknown>): Promise<Playback> {
		if (process.platform !== "win32")
			throw new Error("Windows media sessions are available only on Windows.");
		const shell = join(
			process.env.SystemRoot ?? "C:\\Windows",
			"System32/WindowsPowerShell/v1.0/powershell.exe",
		);
		const script = join(packageRoot, "native/windows-media.ps1");
		const result = await new Promise<string>((resolve, reject) => {
			const child = execFile(
				shell,
				["-NoProfile", "-NonInteractive", "-File", script],
				{ windowsHide: true, timeout: 15000, maxBuffer: 1_048_576 },
				(error, stdout) => {
					if (error)
						reject(
							new Error(
								"Windows Apple Music media-session request failed. Check `groovectl doctor`.",
							),
						);
					else resolve(stdout);
				},
			);
			child.stdin?.end(JSON.stringify(request));
		});
		const decoded = z
			.object({ error: z.string().optional() })
			.passthrough()
			.parse(JSON.parse(result.trim().replace(/^\uFEFF/, "")));
		if (decoded.error) throw new Error(decoded.error);
		return playbackSchema.parse(decoded);
	}
	status() {
		return this.request({ action: "status" });
	}
	playback(request: PlaybackRequest) {
		return this.request(PlaybackRequest.parse(request));
	}
}
export function players(root = dataDir()): {
	native: MacMusic;
	selected: Player;
	cider: Cider;
} {
	const config = playerConfig(root),
		native = new MacMusic(),
		cider = new Cider(
			config.cider_url,
			process.env.CIDER_API_TOKEN ?? config.cider_token,
		);
	const name =
		process.env.GROOVECTL_PLAYER ??
		config.player ??
		(process.platform === "win32"
			? "windows"
			: process.platform === "darwin"
				? "native"
				: "none");
	PlayerName.parse(name);
	return {
		native,
		selected:
			name === "cider"
				? cider
				: name === "windows"
					? new WindowsMusic()
					: name === "none"
						? new NoPlayer()
						: native,
		cider,
	};
}
