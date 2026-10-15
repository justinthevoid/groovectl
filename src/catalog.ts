import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { SignJWT, importPKCS8 } from "jose";
import { z } from "zod";
import { dataDir, loadPrivate } from "./storage.js";
import {
	apiId,
	Track,
	TrackRef,
	type Playlist,
	type PlaylistBackend,
} from "./models.js";

export const MusicKitConfig = z.object({
	key_path: z.string().optional(),
	key_id: z
		.string()
		.regex(/^[A-Z0-9]{10}$/)
		.optional(),
	team_id: z
		.string()
		.regex(/^[A-Z0-9]{10}$/)
		.optional(),
	storefront: z
		.string()
		.regex(/^[a-z]{2}$/)
		.default("us"),
});
const Attributes = z
	.object({
		name: z.string().optional(),
		artistName: z.string().optional(),
		albumName: z.string().optional(),
		durationInMillis: z.number().nonnegative().optional(),
		isrc: z.string().optional(),
		contentRating: z.string().optional(),
		url: z.string().optional(),
		genreNames: z.array(z.string()).optional(),
		releaseDate: z.string().optional(),
		canEdit: z.boolean().optional(),
		playParams: z
			.object({ catalogId: z.string().optional() })
			.passthrough()
			.optional(),
	})
	.passthrough();
const Resource = z
	.object({
		id: z.string().min(1),
		type: z.string().optional(),
		attributes: Attributes.default({}),
		relationships: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();
export type Resource = z.infer<typeof Resource>;
const Page = z
	.object({
		data: z.array(Resource).optional(),
		next: z.string().optional(),
		results: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();
export function song(item: Resource): Track {
	const a = item.attributes;
	return Track.parse({
		source: "catalog",
		id: item.id,
		name: a.name ?? "",
		artist: a.artistName ?? "",
		album: a.albumName ?? "",
		duration_ms: a.durationInMillis ?? 0,
		isrc: a.isrc,
		explicit: a.contentRating === "explicit",
		url: a.url,
		genres: a.genreNames ?? [],
		release_date: a.releaseDate,
		playable: !!a.playParams,
	});
}
export class AppleCatalog implements PlaylistBackend {
	private cached?: { token: string; expiry: number };
	constructor(
		readonly root = dataDir(),
		private fetcher: typeof fetch = fetch,
	) {}
	config() {
		return MusicKitConfig.parse(loadPrivate(join(this.root, "musickit.json")));
	}
	userToken(): string | undefined {
		return z
			.object({ music_user_token: z.string().optional() })
			.parse(loadPrivate(join(this.root, "user.json"))).music_user_token;
	}
	readiness() {
		const c = this.config();
		return {
			developer_key_configured: !!(c.key_id && c.team_id && c.key_path),
			user_authorized: !!this.userToken(),
			storefront: c.storefront,
		};
	}
	async developerToken(): Promise<string> {
		const now = Math.floor(Date.now() / 1000);
		if (this.cached && this.cached.expiry > now + 60) return this.cached.token;
		const c = this.config();
		if (!c.key_path || !c.key_id || !c.team_id)
			throw new Error(
				"MusicKit setup is pending. Run `groovectl setup`. Native playback remains available.",
			);
		const file = resolve(c.key_path.replace(/^~(?=[/\\])/, homedir()));
		if (process.platform !== "win32" && statSync(file).mode & 0o077)
			throw new Error("MusicKit private key must have file permissions 0600.");
		const key = await importPKCS8(readFileSync(file, "utf8"), "ES256");
		const expiry = now + 3600;
		const token = await new SignJWT({ iss: c.team_id })
			.setProtectedHeader({ alg: "ES256", kid: c.key_id })
			.setIssuedAt(now)
			.setExpirationTime(expiry)
			.sign(key);
		this.cached = { token, expiry };
		return token;
	}
	storefront() {
		return this.config().storefront;
	}
	async request(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		options: {
			personal?: boolean;
			params?: Record<string, string>;
			body?: unknown;
			userToken?: string;
		} = {},
	) {
		if (!/^\/v1\/[\w/.-]+$/.test(path) || path.includes(".."))
			throw new Error("Invalid Apple API path.");
		const headers: Record<string, string> = {
			Authorization: `Bearer ${await this.developerToken()}`,
		};
		if (options.personal) {
			const token = options.userToken ?? this.userToken();
			if (!token)
				throw new Error(
					"Run `groovectl authorize` to connect your Apple Music account.",
				);
			headers["Music-User-Token"] = token;
		}
		if (options.body) headers["Content-Type"] = "application/json";
		const url = new URL(path, "https://api.music.apple.com");
		url.search = new URLSearchParams(options.params).toString();
		let response: Response;
		try {
			response = await this.fetcher(url, {
				method,
				headers,
				body: options.body ? JSON.stringify(options.body) : undefined,
				redirect: "error",
				signal: AbortSignal.timeout(25000),
			});
		} catch {
			throw new Error(
				`Apple Music ${method} request failed or timed out. Writes are not retried automatically.`,
			);
		}
		if (!response.ok)
			throw new Error(
				`Apple Music API returned HTTP ${response.status} for ${method} ${path}. Writes are not retried automatically.`,
			);
		if (response.status === 204 || response.status === 202)
			return Page.parse({ http_status: response.status });
		return Page.parse(await response.json());
	}
	async search(query: string, limit = 20): Promise<Track[]> {
		const r = await this.searchAll(query, ["songs"], limit);
		return Page.parse(r.results?.songs ?? {}).data?.map(song) ?? [];
	}
	async searchAll(query: string, types: string[], limit = 20, offset = 0) {
		return this.request("GET", `/v1/catalog/${this.storefront()}/search`, {
			params: {
				term: query,
				types: types.join(","),
				limit: String(limit),
				offset: String(offset),
			},
		});
	}
	async tracks(ids: string[]): Promise<Track[]> {
		const valid = ids.map((id) =>
			z
				.string()
				.regex(/^\d{1,20}$/)
				.parse(id),
		);
		const found = new Map<string, Track>();
		for (let i = 0; i < valid.length; i += 100) {
			const result = await this.request(
				"GET",
				`/v1/catalog/${this.storefront()}/songs`,
				{ params: { ids: valid.slice(i, i + 100).join(",") } },
			);
			for (const r of result.data ?? []) found.set(r.id, song(r));
		}
		return valid.map((id) => {
			const t = found.get(id);
			if (!t)
				throw new Error(
					`Catalog song ${id} is unavailable in this storefront.`,
				);
			return t;
		});
	}
	async playlists(offset = 0) {
		return this.request("GET", "/v1/me/library/playlists", {
			personal: true,
			params: { limit: "100", offset: String(offset) },
		});
	}
	async playlist(id: string): Promise<Playlist> {
		const pid = apiId(id),
			response = await this.request("GET", `/v1/me/library/playlists/${pid}`, {
				personal: true,
			}),
			item = response.data?.[0];
		// Personal endpoints always need the Music-User-Token, including the playlist header.
		if (!item) throw new Error("Playlist was not returned by Apple.");
		const tracks: Track[] = [];
		let next: URL | undefined = new URL(
			`/v1/me/library/playlists/${pid}/tracks?limit=100`,
			"https://api.music.apple.com",
		);
		const visited = new Set<string>();
		while (next) {
			if (
				next.origin !== "https://api.music.apple.com" ||
				next.pathname !== `/v1/me/library/playlists/${pid}/tracks` ||
				visited.has(next.href)
			)
				throw new Error("Unexpected Apple pagination URL.");
			visited.add(next.href);
			const page = await this.request("GET", next.pathname, {
				personal: true,
				params: Object.fromEntries(next.searchParams),
			});
			for (const t of page.data ?? []) {
				const a = t.attributes,
					isLibrary = t.type !== "songs" && t.type !== "music-videos",
					catalogId = isLibrary ? a.playParams?.catalogId : t.id;
				tracks.push(
					Track.parse({
						source: catalogId ? "catalog" : "library-api",
						id: catalogId ?? t.id,
						library_id: isLibrary ? t.id : undefined,
						catalog_id: catalogId,
						resource_type: t.type,
						name: a.name ?? "",
						artist: a.artistName ?? "",
						album: a.albumName ?? "",
						duration_ms: a.durationInMillis ?? 0,
						explicit: a.contentRating === "explicit",
					}),
				);
			}
			if (tracks.length > 2000 || visited.size > 100)
				throw new Error("Playlist exceeds the bounded pagination limit.");
			next = page.next
				? new URL(page.next, "https://api.music.apple.com")
				: undefined;
		}
		return {
			source: "catalog",
			id: pid,
			name: item.attributes.name ?? "",
			editable: item.attributes.canEdit ?? false,
			tracks,
		};
	}
	async create(
		name: string,
		ids: string[],
		description = "",
		accepted?: (id: string) => void,
	): Promise<Playlist> {
		return this.createWithRefs(
			name,
			ids.map((id) => ({ source: "catalog", id })),
			description,
			accepted,
		);
	}
	async resolveRefs(input: TrackRef[]): Promise<Track[]> {
		const refs = input.map((ref) => TrackRef.parse(ref));
		if (refs.some((ref) => ref.source === "native"))
			throw new Error(
				"Native persistent IDs cannot be sent to the Apple Music API.",
			);
		const catalogIds = refs
			.filter((ref) => ref.source === "catalog")
			.map((ref) => ref.id);
		const found = new Map<string, Track>(
			(catalogIds.length ? await this.tracks(catalogIds) : []).map((track) => [
				`catalog:${track.id}`,
				track,
			]),
		);
		const libraryIds = [
			...new Set(
				refs.filter((ref) => ref.source === "library-api").map((ref) => ref.id),
			),
		];
		for (let offset = 0; offset < libraryIds.length; offset += 100) {
			const response = await this.request("GET", "/v1/me/library/songs", {
				personal: true,
				params: { ids: libraryIds.slice(offset, offset + 100).join(",") },
			});
			for (const item of response.data ?? []) {
				if (item.type && item.type !== "library-songs")
					throw new Error("Apple returned a different library resource type.");
				const attributes = item.attributes;
				found.set(
					`library-api:${item.id}`,
					Track.parse({
						...song(item),
						source: "library-api",
						id: item.id,
						library_id: item.id,
						catalog_id: attributes.playParams?.catalogId,
						resource_type: item.type,
					}),
				);
			}
		}
		return refs.map((ref) => {
			const track = found.get(`${ref.source}:${ref.id}`);
			if (!track)
				throw new Error(
					`Requested ${ref.source} song ${ref.id} is unavailable.`,
				);
			return track;
		});
	}
	private apiTracks(input: TrackRef[]) {
		return input.map((ref) => {
			const value = TrackRef.parse(ref);
			if (value.source === "native")
				throw new Error(
					"Native persistent IDs cannot be sent to the Apple Music API.",
				);
			return {
				id: value.id,
				type: value.source === "library-api" ? "library-songs" : "songs",
			};
		});
	}
	async createWithRefs(
		name: string,
		refs: TrackRef[],
		description = "",
		accepted?: (id: string) => void,
		parentFolderId?: string,
	): Promise<Playlist> {
		const response = await this.request("POST", "/v1/me/library/playlists", {
			personal: true,
			body: {
				attributes: { name, description },
				relationships: {
					tracks: { data: this.apiTracks(refs) },
					...(parentFolderId
						? {
								parent: {
									data: [
										{
											id: apiId(parentFolderId),
											type: "library-playlist-folders",
										},
									],
								},
							}
						: {}),
				},
			},
		});
		const id = response.data?.[0]?.id;
		if (!id)
			throw new Error(
				"Apple accepted the write without returning a playlist ID. Inspect your library.",
			);
		accepted?.(id); // Persist the accepted ID before readback, even if readback fails.
		return this.playlist(id);
	}
	async append(id: string, ids: string[]) {
		return this.appendWithRefs(
			id,
			ids.map((id) => ({ source: "catalog", id })),
		);
	}
	async appendWithRefs(id: string, refs: TrackRef[]) {
		const pid = apiId(id);
		await this.request("POST", `/v1/me/library/playlists/${pid}/tracks`, {
			personal: true,
			body: { data: this.apiTracks(refs) },
		});
		return this.playlist(pid);
	}
	async browse(
		kind: "albums" | "artists" | "playlists" | "stations" | "music-videos",
		id: string,
		relationship?: "tracks" | "albums" | "top-songs",
		offset = 0,
	) {
		const suffix =
			relationship === "top-songs"
				? "/view/top-songs"
				: relationship
					? `/${relationship}`
					: "";
		return this.request(
			"GET",
			`/v1/catalog/${this.storefront()}/${kind}/${apiId(id)}${suffix}`,
			relationship ? { params: { limit: "25", offset: String(offset) } } : {},
		);
	}
	async library(
		kind: "songs" | "albums" | "artists" | "playlists" | "recently-added",
		offset = 0,
	) {
		return this.request("GET", `/v1/me/library/${kind}`, {
			personal: true,
			params: { limit: "100", offset: String(offset) },
		});
	}
	async librarySearch(query: string, limit = 25) {
		return this.request("GET", "/v1/me/library/search", {
			personal: true,
			params: {
				term: query,
				types: "library-songs,library-albums,library-artists,library-playlists",
				limit: String(limit),
			},
		});
	}
	async recommendations() {
		return this.request("GET", "/v1/me/recommendations", {
			personal: true,
			params: { limit: "25" },
		});
	}
	async recent() {
		return this.request("GET", "/v1/me/recent/played/tracks", {
			personal: true,
			params: { limit: "30", types: "songs,library-songs" },
		});
	}
	async heavyRotation() {
		return this.request("GET", "/v1/me/history/heavy-rotation", {
			personal: true,
		});
	}
	async replay() {
		return this.request("GET", "/v1/me/music-summaries", {
			personal: true,
			params: {
				"filter[year]": "latest",
				views: "top-artists,top-albums,top-songs",
			},
		});
	}
	async recordingAlternatives(input: {
		isrcs?: string[];
		equivalent_ids?: string[];
	}) {
		const params: Record<string, string> = input.isrcs
			? { "filter[isrc]": input.isrcs.join(",") }
			: { "filter[equivalents]": input.equivalent_ids!.join(",") };
		const result = await this.request(
			"GET",
			`/v1/catalog/${this.storefront()}/songs`,
			{ params },
		);
		return {
			storefront: this.storefront(),
			songs: (result.data ?? []).map(song),
			mapping: result.meta ?? null,
			guidance:
				"An ISRC may match multiple releases. Review album/version and availability before replacing a recording.",
		};
	}
	async charts(genre?: string) {
		return this.request("GET", `/v1/catalog/${this.storefront()}/charts`, {
			params: {
				types: "songs,albums,playlists",
				limit: "25",
				...(genre ? { genre: apiId(genre) } : {}),
			},
		});
	}
}
