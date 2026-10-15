import { z } from "zod";
import { AudioFeature, TrackRef, Source, PlaybackRequest } from "./models.js";
import { MusicService } from "./service.js";
import { Curation, comparePlaylists, sequenceTracks } from "./curation.js";
import { auditTracks } from "./flow.js";
import {
	Cider,
	playerCapabilities,
	sessionCapabilities,
	type Player,
} from "./players.js";
import {
	Studio,
	ListeningBrief,
	BriefPatch,
	surpriseBrief,
	coverPrompt,
	remixBrief,
} from "./studio.js";
import {
	InterviewField,
	Suggestions,
	questionOptions,
	suggestionCatalog,
} from "./interview.js";
import { Artwork } from "./artwork.js";
import { ArtworkProvider } from "./artwork-providers.js";
import {
	Preferences,
	MusicChange,
	RatingResource,
	ratings,
} from "./preferences.js";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { packageRoot } from "./players.js";
import { LibraryFolders } from "./organization.js";
import { ListeningStory, recipes } from "./mixtape.js";
import { summarizePlan, summarizeDraft } from "./workspace-models.js";

type Group = "common" | "catalog" | "library" | "curation" | "playback";
export type Profile = "full" | "catalog" | "curator" | "player";
export interface ToolDefinition {
	name: string;
	description: string;
	schema: z.ZodObject<z.ZodRawShape>;
	group: Group;
	annotations: {
		readOnlyHint: boolean;
		destructiveHint: boolean;
		idempotentHint: boolean;
		openWorldHint: boolean;
	};
	execute(input: unknown): Promise<Record<string, unknown>>;
}
const query = z.string().min(1).max(200),
	limit = z.number().int().min(1).max(25).default(20);
const offset = z.number().int().min(0).max(100000).default(0);
const refs = z.array(TrackRef).min(1).max(200),
	name = z.string().min(1).max(120),
	id = z.string().min(1).max(100);
export function createTools(
	music: MusicService,
	player: Player,
	cider: Cider,
	profile: Profile = "full",
): ToolDefinition[] {
	const curation = new Curation(music),
		tools: ToolDefinition[] = [];
	const studio = new Studio(music.plans.root),
		artwork = new Artwork(music.plans.root);
	const preferences = new Preferences(music.catalog, music.plans);
	const playbackEnabled = profile === "full" || profile === "player";
	const toolIncluded = (t: ToolDefinition) =>
		(player.name !== "none" || t.group !== "playback") &&
		(profile === "full" ||
			t.group === "common" ||
			(profile === "player" && t.group === "playback") ||
			(profile === "catalog" && ["catalog", "library"].includes(t.group)) ||
			(profile === "curator" && t.group !== "playback"));
	const playbackCapabilities = () =>
		playbackEnabled
			? playerCapabilities(player.name)
			: {
					...playerCapabilities(player.name),
					available: false,
					actions: [],
					targeted_play: false,
					volume: false,
					queue: false,
					qualification: `Playback tools are not exposed by the ${profile} profile.`,
				};
	function add<S extends z.ZodRawShape>(
		name: string,
		description: string,
		group: Group,
		shape: S,
		run: (
			args: z.infer<z.ZodObject<S>>,
		) => Promise<Record<string, unknown>> | Record<string, unknown>,
		write = false,
		remote = true,
		destructive = false,
	) {
		const schema = z.object(shape).strict();
		tools.push({
			name,
			description,
			group,
			schema,
			annotations: {
				readOnlyHint: !write,
				destructiveHint: destructive,
				idempotentHint: !write,
				openWorldHint: remote,
			},
			execute: async (input) => run(schema.parse(input)),
		});
	}
	const workspace = async () => {
		let status: Record<string, unknown>;
		try {
			status =
				playbackEnabled || player.name === "none"
					? await player.status()
					: { running: false, state: "profile-limited" };
		} catch (e) {
			status = {
				running: false,
				state: "unavailable",
				error: e instanceof Error ? e.message : "Player unavailable.",
			};
		}
		return {
			tool_profile: profile,
			available_tools: tools.filter(toolIncluded).map((t) => t.name),
			player: {
				...status,
				selected_player: player.name,
				capabilities: playbackEnabled
					? sessionCapabilities(player.name, status)
					: playbackCapabilities(),
			},
			auth: music.catalog.readiness(),
			plans: music.plans
				.recent()
				.filter((p) => !["deleted", "cancelled"].includes(p.state))
				.map(summarizePlan),
			plan_details_tool: "inspect_playlist_plan",
			studio: {
				drafts: studio.list().map(summarizeDraft),
				artwork: artwork
					.list()
					.map(({ artwork_id, state, draft_id, request_id }) => ({
						artwork_id,
						state,
						draft_id,
						request_id,
					})),
				provider: artwork.readiness(),
			},
		};
	};
	add(
		"open_music",
		"Open Groovectl’s playlist studio: listening brief, exact recordings, sequence, artwork and a compact player. Does not start playback.",
		"common",
		{},
		workspace,
		false,
		false,
	);
	add(
		"get_music_workspace",
		"Refresh player/readiness and compact summaries of the last 20 plans/drafts. Use inspect_playlist_plan for full recordings/receipts or get_playlist_studio with draft_id for a full brief.",
		"common",
		{},
		workspace,
		false,
		false,
	);
	add(
		"get_capabilities",
		"Discover platform, selected player, tool profile and supported operations before choosing a backend.",
		"common",
		{},
		() => ({
			platform: process.platform,
			player: player.name,
			profile,
			musickit: music.catalog.readiness(),
			native_library: process.platform === "darwin",
			native_bridge:
				process.platform === "darwin"
					? (music.native.bridge?.() ?? null)
					: null,
			playback: playbackCapabilities(),
			api_library: {
				mixed_song_references: true,
				folders: ["browse", "create"],
				videos_in_write_plans: false,
			},
			curation: {
				chapters: true,
				pinned_anchors: true,
				preserve_chapter_order: true,
				runtime_budgets: "report_only",
				recipes: recipes.map((r) => r.id),
			},
			catalog_library:
				"Official API; requires your MusicKit key and user authorization for personal data.",
			queue: playbackEnabled && player.name === "cider",
			artwork: artwork.readiness(),
			safety:
				"Preview -> apply once -> verify. Unknown outcomes never auto-retry. No raw scripts, shell tools or arbitrary HTTP proxy.",
		}),
		false,
		false,
	);
	add(
		"save_listening_brief",
		"Save a private brief, optional interview and cover direction. Quick asks at most two missing questions; deep up to five. Add fresh typed suggestions from your host reasoning without changing answers; preserve locked fields during randomize. Global randomization touches creative fields, never intent or hard policies. No music writes or playback.",
		"curation",
		{
			brief: BriefPatch,
			mode: z.enum(["quick", "deep", "surprise"]).default("quick"),
			draft_id: z.string().uuid().optional(),
			seed: z.number().int().min(0).max(2147483647).default(0),
			suggestions: Suggestions.optional(),
			locked: z.array(InterviewField).max(13).optional(),
			randomize: z
				.object({
					field: z
						.union([InterviewField, z.literal("unlocked")])
						.default("unlocked"),
					only_empty: z.boolean().default(true),
				})
				.strict()
				.optional(),
		},
		(r) => {
			const previous = r.draft_id ? studio.get(r.draft_id) : undefined;
			const existing = previous?.brief ?? {};
			const input = { ...existing, ...r.brief };
			let brief =
				r.mode === "surprise"
					? surpriseBrief(r.seed, input)
					: ListeningBrief.parse(input);
			if (r.randomize)
				brief = remixBrief(
					brief,
					r.seed,
					r.locked ?? previous?.locked,
					{ ...previous?.suggestions, ...r.suggestions },
					r.randomize.field,
					r.randomize.only_empty,
				);
			return studio.save(brief, r.mode, r.draft_id, {
				suggestions: r.suggestions,
				locked: r.locked,
				seed: r.seed,
			});
		},
		true,
		false,
	);
	add(
		"get_playlist_studio",
		"Read compact private draft/cover summaries and provider readiness; draft_id returns that full draft. Supply a field for six inspiration choices from 200+ starting points plus saved agent ideas; pass seen IDs and a new seed to browse without immediate repeats. include_questions returns form topics; include_recipes returns six listening-story starting points. Interviews remain optional.",
		"common",
		{
			draft_id: z.string().uuid().optional(),
			field: InterviewField.optional(),
			seed: z.number().int().min(0).max(2147483647).default(0),
			seen: z.array(z.string().max(100)).max(300).default([]),
			include_questions: z.boolean().default(false),
			include_recipes: z.boolean().default(false),
		},
		(r) => ({
			drafts: studio.list().map(summarizeDraft),
			artwork: artwork
				.list()
				.map(({ artwork_id, state, draft_id, request_id }) => ({
					artwork_id,
					state,
					draft_id,
					request_id,
				})),
			provider: artwork.readiness(),
			...(r.draft_id ? { draft: studio.get(r.draft_id) } : {}),
			...(r.include_recipes
				? {
						recipes,
						recipe_note:
							"Starting points for the host agent, not automatic selections or new account writes. Assign explicit chapter ranges and exact anchors after choosing recordings.",
					}
				: {}),
			...(r.field || r.include_questions
				? (() => {
						const draft = r.draft_id ? studio.get(r.draft_id) : undefined;
						return {
							inspiration: r.field
								? questionOptions(
										r.field,
										r.seed,
										r.seen,
										draft?.suggestions,
										draft?.brief.exclude,
									)
								: suggestionCatalog(
										r.seed,
										draft?.suggestions,
										draft?.brief.exclude,
									),
						};
					})()
				: {}),
		}),
		false,
		false,
	);
	add(
		"generate_playlist_artwork",
		"Start one original square cover using an explicitly configured Codex/agy CLI or BYOK OpenAI/Gemini/OpenRouter provider. Read provider readiness first. Local caps and cooldowns apply; no automatic retries or paid fallback. A fresh request_id authorizes one generation; reuse it only to inspect that same request. Does not apply artwork to a playlist.",
		"curation",
		{
			draft_id: z.string().uuid(),
			request_id: z.string().uuid(),
			provider: ArtworkProvider.optional(),
		},
		(r) =>
			artwork.create(
				coverPrompt(studio.get(r.draft_id).brief),
				r.request_id,
				(id) => {
					const child = spawn(
						process.execPath,
						[join(packageRoot, "dist/cli.js"), "artwork-worker", id],
						{
							detached: true,
							stdio: "ignore",
							windowsHide: true,
							env: { ...process.env, GROOVECTL_DATA: music.plans.root },
						},
					);
					child.on("error", () => {});
					child.unref();
				},
				r.draft_id,
				r.provider,
			),
		true,
		true,
	);
	add(
		"get_playlist_artwork",
		"Read a cover job. A completed job returns a standard MCP image and image resource; unfinished jobs return status. No generation retry or library change is performed.",
		"common",
		{ artwork_id: z.string().uuid(), include_image: z.boolean().default(true) },
		(r) => artwork.get(r.artwork_id),
		false,
		false,
	);
	add(
		"find_recording_alternatives",
		"Find releases by ISRC or available storefront equivalents of catalog song IDs. Supply exactly one list. Preserves Apple’s mapping and flags multiple releases for review; does not silently replace a recording.",
		"catalog",
		{
			isrcs: z
				.array(z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/))
				.min(1)
				.max(25)
				.optional(),
			equivalent_ids: z
				.array(z.string().regex(/^\d{1,20}$/))
				.min(1)
				.max(100)
				.optional(),
		},
		(r) => {
			if (!!r.isrcs === !!r.equivalent_ids)
				throw new Error("Supply either isrcs or equivalent_ids.");
			return music.catalog.recordingAlternatives(r);
		},
	);
	add(
		"get_music_preferences",
		"Read like/dislike ratings for catalog or API-library IDs. Ratings are separate from favorites and native star ratings.",
		"library",
		{ resource: RatingResource, ids: z.array(id).min(1).max(25) },
		(r) => ratings(music.catalog, r.resource, r.ids),
	);
	add(
		"preview_music_change",
		"Preview a favorite, like/dislike/clear rating, catalog-library addition or named playlist-folder creation. Resolves resources/parent first and saves an immutable plan. Does not write to Apple Music. Favorites and library additions have acceptance-only verification.",
		"library",
		{ change: MusicChange },
		(r) => preferences.preview(r.change),
		true,
		true,
	);
	add(
		"apply_music_change",
		"Apply an explicitly requested, reviewed music change once. Ratings and folder identity/parent are read back; favorites/library additions remain accepted and unverified. Unknown outcomes block retry.",
		"library",
		{ plan_id: z.string().uuid() },
		(r) => preferences.apply(r.plan_id),
		true,
		true,
		true,
	);
	add(
		"get_replay_summary",
		"Read Apple Music Replay for the latest eligible year, with top songs, albums and artists. Requires personal authorization and eligibility; this is not arbitrary-year or complete listening-history access.",
		"catalog",
		{},
		() => music.catalog.replay(),
	);
	add(
		"get_playback_state",
		"Read the selected player’s song and transport state. Does not start playback.",
		"playback",
		{},
		async () => {
 const status = await player.status();
 return { ...status, selected_player: player.name, player_capabilities: sessionCapabilities(player.name, status) };
 },
		false,
		false,
	);
	add(
		"control_playback",
		"Control the selected player only when requested. Mac play IDs are native persistent IDs; Cider play IDs are catalog IDs. Windows supports session transport only. Volume 0–100; seek seconds; shuffle 0/1; repeat 0/1/2.",
		"playback",
		PlaybackRequest.shape,
		(r) => music.plans.mutation(async () => {
			const status = await player.playback(PlaybackRequest.parse(r));
			return { ...status, selected_player: player.name, player_capabilities: sessionCapabilities(player.name, status) };
		}),
		true,
		false,
	);
	add(
		"search_library",
		"Search native Music.app library tracks by stable persistent ID. macOS only; use search_api_library on Windows.",
		"library",
		{
			query: z.string().max(200).default(""),
			limit: z.number().int().min(1).max(100).default(30),
			offset,
		},
		(r) => music.native.search(r.query, r.limit, r.offset),
		false,
		false,
	);
	add(
		"search_catalog",
		"Search catalog songs in the configured storefront. Requires a MusicKit key.",
		"catalog",
		{ query, limit },
		async (r) => ({
			storefront: music.catalog.storefront(),
			songs: await music.catalog.search(r.query, r.limit),
		}),
	);
	add(
		"search_catalog_entities",
		"Search songs, albums, artists, editorial playlists, stations or music videos with bounded pagination.",
		"catalog",
		{
			query,
			types: z
				.array(
					z.enum([
						"songs",
						"albums",
						"artists",
						"playlists",
						"stations",
						"music-videos",
					]),
				)
				.min(1)
				.max(6),
			limit,
			offset,
		},
		(r) => music.catalog.searchAll(r.query, r.types, r.limit, r.offset),
	);
	add(
		"get_catalog_recordings",
		"Fetch up to 100 exact song IDs, preserving input order and rejecting unavailable recordings.",
		"catalog",
		{
			ids: z
				.array(z.string().regex(/^\d{1,20}$/))
				.min(1)
				.max(100),
		},
		async (r) => ({ songs: await music.catalog.tracks(r.ids) }),
	);
	add(
		"resolve_recording",
		"Resolve a structured title and artist; reject unrelated covers and flag alternate/live/remastered versions.",
		"catalog",
		{ title: query, artist: query },
		(r) => music.resolve(r.title, r.artist),
	);
	add(
		"resolve_recordings",
		"Resolve up to 25 title/artist pairs. Returns unresolved or review-needed recordings individually; never silently substitutes one.",
		"curation",
		{
			recordings: z
				.array(z.object({ title: query, artist: query }).strict())
				.min(1)
				.max(25),
		},
		async (r) => {
			const results = [];
			for (const item of r.recordings)
				results.push(await music.resolve(item.title, item.artist));
			return {
				results,
				unresolved: results.filter((r) => !r.match).length,
				needs_review: results.filter((r) => r.needs_review).length,
			};
		},
	);
	add(
		"get_catalog_item",
		"Read an album, artist, editorial playlist, station or music video by catalog ID. This is distinct from a personal library playlist.",
		"catalog",
		{
			type: z.enum([
				"albums",
				"artists",
				"playlists",
				"stations",
				"music-videos",
			]),
			id,
		},
		(r) => music.catalog.browse(r.type, r.id),
	);
	add(
		"get_album_tracks",
		"Read an album’s ordered catalog tracks.",
		"catalog",
		{ album_id: id, offset },
		(r) => music.catalog.browse("albums", r.album_id, "tracks", r.offset),
	);
	add(
		"get_artist_albums",
		"Browse catalog albums for an artist.",
		"catalog",
		{ artist_id: id, offset },
		(r) => music.catalog.browse("artists", r.artist_id, "albums", r.offset),
	);
	add(
		"get_artist_top_songs",
		"Read Apple’s top songs for an artist in this storefront.",
		"catalog",
		{ artist_id: id },
		(r) => music.catalog.browse("artists", r.artist_id, "top-songs"),
	);
	add(
		"get_catalog_charts",
		"Read current song, album and playlist charts, optionally within a genre ID.",
		"catalog",
		{ genre_id: id.optional() },
		(r) => music.catalog.charts(r.genre_id),
	);
	add(
		"search_api_library",
		"Search your personal Apple Music library through the official API. Works on macOS, Windows and Linux.",
		"library",
		{ query, limit },
		(r) => music.catalog.librarySearch(r.query, r.limit),
	);
	add(
		"browse_api_library",
		"Browse library songs, albums, artists, playlists or recently added items, 100 per page.",
		"library",
		{
			type: z.enum([
				"songs",
				"albums",
				"artists",
				"playlists",
				"recently-added",
			]),
			offset,
		},
		(r) => music.catalog.library(r.type, r.offset),
	);
	add(
		"inspect_api_library",
		"Read a library album's exact songs or a library artist's albums, 100 per page. Follow next_page only for the same type and ID. Library IDs stay library IDs; this never plays music or writes to your account.",
		"library",
		{ type: z.enum(["albums", "artists"]), id, page: z.string().max(2048).optional() },
		(r) => music.catalog.libraryDetails(r.type, r.id, r.page),
	);
	add(
		"browse_library_folders",
		"Browse the root or a named library playlist folder, its children or parent. Follow next_page only for that same folder/view. No library writes.",
		"library",
		{
			folder_id: id.optional(),
			view: z.enum(["folder", "children", "parent"]).default("children"),
			page: z.string().max(2048).optional(),
		},
		(r) => new LibraryFolders(music.catalog, music.plans).browse(r),
	);
	add(
		"get_recommendations",
		"Read Apple Music’s personalized recommendations for the authorized account.",
		"catalog",
		{},
		() => music.catalog.recommendations(),
	);
	add(
		"get_recently_played",
		"Read recently played tracks available through Apple’s API. This is not a complete listening-history archive.",
		"catalog",
		{},
		() => music.catalog.recent(),
	);
	add(
		"get_heavy_rotation",
		"Read Apple Music heavy-rotation resources for the authorized account.",
		"catalog",
		{},
		() => music.catalog.heavyRotation(),
	);
	add(
		"list_playlists",
		"List native Music.app playlists or your official API library playlists. IDs belong to different namespaces.",
		"library",
		{
			source: Source.default(
				process.platform === "darwin" ? "native" : "catalog",
			),
			offset,
		},
		(r) =>
			r.source === "native"
				? music.native.playlists()
				: music.catalog.playlists(r.offset),
	);
	add(
		"get_playlist",
		"Read ordered tracks from a native or API library playlist. Bounded at 2,000 tracks.",
		"library",
		{ source: Source, playlist_id: id },
		(r) => music.getPlaylist(r.source, r.playlist_id),
	);
	add(
		"preview_playlist",
		"Ground 1–200 recordings, remove duplicate IDs and save a create preview with listening-flow audit. Does not change Apple Music.",
		"curation",
		{
			name,
			tracks: refs,
			description: z.string().max(2000).default(""),
			features: z.array(AudioFeature).max(200).optional(),
			parent_folder_id: id.optional(),
			story: ListeningStory.optional(),
		},
		(r) =>
			music.preview(
				r.name,
				r.tracks,
				r.description,
				undefined,
				r.features,
				r.parent_folder_id,
				r.story,
			),
	);
	add(
		"preview_playlist_additions",
		"Preview additions, omit recordings already present and fingerprint the target to detect edits before apply.",
		"curation",
		{ playlist_id: id, tracks: refs },
		(r) => music.preview("", r.tracks, "", r.playlist_id),
	);
	add(
		"apply_playlist_plan",
		"Apply a requested preview once and verify exact track order/count. Successful retries return the saved result. Uncertain outcomes block retry.",
		"curation",
		{ plan_id: id },
		(r) => music.apply(r.plan_id),
		true,
	);
	add(
		"inspect_playlist_plan",
		"Inspect preview, recordings, audit, state, accepted playlist ID and any saved write result.",
		"common",
		{ plan_id: id },
		(r) => music.plans.get(r.plan_id),
		false,
		false,
	);
	add(
		"cancel_playlist_plan",
		"Cancel a ready preview. Does not remove a playlist or change Apple Music.",
		"curation",
		{ plan_id: id },
		(r) => music.plans.cancel(r.plan_id),
		true,
		false,
	);
	add(
		"delete_created_playlist",
		"Delete ONLY an unchanged native playlist created by this server’s applied plan. Requires a user deletion request and exact playlist name. Cannot remove arbitrary playlists or library tracks.",
		"curation",
		{ plan_id: id, confirmation: name },
		(r) => music.deleteCreated(r.plan_id, r.confirmation),
		true,
		false,
		true,
	);
	add(
		"audit_playlist",
		"Audit a playlist’s duplicate recording IDs, artist repetition, alternate versions, duration and optional supplied audio estimates.",
		"curation",
		{
			source: Source,
			playlist_id: id,
			features: z.array(AudioFeature).max(2000).optional(),
		},
		async (r) => ({
			playlist_id: r.playlist_id,
			audit: auditTracks(
				(await music.getPlaylist(r.source, r.playlist_id)).tracks,
				r.features,
			),
		}),
	);
	add(
		"compare_playlists",
		"Compare ordered recording IDs and membership of two playlists in the same namespace; does not change either.",
		"curation",
		{ source: Source, first_id: id, second_id: id },
		async (r) =>
			comparePlaylists(
				await music.getPlaylist(r.source, r.first_id),
				await music.getPlaylist(r.source, r.second_id),
			),
	);
	add(
		"sequence_playlist",
		"Sequence verified recordings with artist spacing and supplied audio estimates. Optional story partitions the input into contiguous chapters and pins exact recordings to final positions within their chapter. Reports runtime budget and conflicts without dropping tracks or changing Apple Music. Pass the returned story and order into preview_playlist.",
		"curation",
		{
			tracks: refs,
			artist_gap: z.number().int().min(0).max(10).default(2),
			features: z.array(AudioFeature).max(200).optional(),
			energy_arc: z.enum(["rise", "fall", "peak"]).optional(),
			story: ListeningStory.optional(),
		},
		async (r) => sequenceTracks(await music.grounded(r.tracks), r),
	);
	add(
		"build_playlist_pool",
		"Build a deduplicated catalog candidate pool from up to eight host-written search terms, with explicit-content and artist exclusions. Taste remains the host agent’s judgment.",
		"curation",
		{
			queries: z.array(query).min(1).max(8),
			exclude_artists: z.array(query).max(100).default([]),
			exclude_explicit: z.boolean().default(false),
		},
		(r) => curation.pool(r.queries, r.exclude_artists, r.exclude_explicit),
	);
	add(
		"profile_library",
		"Summarize a bounded library sample to help curate from what the user owns. Reports sampling limits; never presents it as complete listening history.",
		"curation",
		{
			source: Source,
			max_tracks: z.number().int().min(1).max(1000).default(500),
		},
		(r) => curation.profile(r.source, r.max_tracks),
	);
	add(
		"snapshot_playlist",
		"Save an ordered playlist snapshot privately on this computer. Does not edit Apple Music.",
		"curation",
		{ source: Source, playlist_id: id },
		(r) => curation.snapshot(r.source, r.playlist_id),
		true,
		false,
	);
	add(
		"list_playlist_snapshots",
		"List local playlist snapshots and track counts.",
		"curation",
		{},
		() => curation.snapshots(),
		false,
		false,
	);
	add(
		"preview_snapshot_restore",
		"Preview a NEW playlist from a local snapshot, revalidating every ID. Leaves the original playlist intact. Maximum 200 tracks; uploaded tracks without catalog/native IDs cannot be restored through the API.",
		"curation",
		{ snapshot_id: z.string().uuid(), name },
		(r) => curation.restore(r.snapshot_id, r.name),
	);
	add(
		"export_playlist",
		"Return a portable JSON playlist or M3U8 with Apple Music links. No audio is downloaded; tracks lacking usable links are reported.",
		"curation",
		{
			source: Source,
			playlist_id: id,
			format: z.enum(["json", "m3u8"]).default("json"),
		},
		(r) => curation.export(r.source, r.playlist_id, r.format),
	);
	add(
		"preview_playlist_import",
		"Preview a Groovectl JSON export as a new playlist, revalidating each recording before any write.",
		"curation",
		{ name, content: z.string().max(1048576) },
		(r) => curation.importPreview(r.name, r.content),
	);
	add(
		"get_playback_queue",
		"Read Cider’s current queue with audio asset URLs and DRM metadata removed. Requires Cider as the selected player.",
		"playback",
		{},
		() => {
			if (player.name !== "cider")
				throw new Error("Queue access requires the Cider player adapter.");
			return cider.queue();
		},
		false,
		false,
	);
	add(
		"queue_catalog_song",
		"Queue one verified catalog recording next or later in Cider. Does not change a saved playlist. Use only when requested.",
		"playback",
		{
			catalog_id: z.string().regex(/^\d{1,20}$/),
			position: z.enum(["next", "later"]).default("later"),
		},
		(r) =>
			music.plans.mutation(async () => {
				if (player.name !== "cider")
					throw new Error("Queue access requires the Cider player adapter.");
				await music.catalog.tracks([r.catalog_id]);
				return cider.enqueue(r.catalog_id, r.position);
			}),
		true,
		false,
	);
	return tools.filter(toolIncluded);
}
