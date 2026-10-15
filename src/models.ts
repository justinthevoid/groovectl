import { z } from "zod";

export const AppleResourceId = z
	.string()
	.regex(/^[\w.-]{1,100}$/)
	.refine(
		(id) => id !== "." && !id.includes(".."),
		"Invalid Apple resource ID.",
	);

export const Source = z.enum(["native", "catalog"]);
export type Source = z.infer<typeof Source>;
export const TrackRef = z.discriminatedUnion("source", [
	z
		.object({
			source: z.literal("library-api"),
			id: AppleResourceId,
		})
		.strict(),
	z
		.object({
			source: z.literal("catalog"),
			id: z.string().regex(/^\d{1,20}$/),
		})
		.strict(),
	z
		.object({
			source: z.literal("native"),
			id: z
				.string()
				.regex(/^[\da-fA-F]{16}$/)
				.transform((s) => s.toUpperCase()),
		})
		.strict(),
]);
export type TrackRef = z.infer<typeof TrackRef>;
export const AudioFeature = z
	.object({
		id: z.string(),
		bpm: z.number().positive().max(400).nullish(),
		key: z
			.string()
			.regex(/^(?:[1-9]|1[0-2])[AB]$/)
			.nullish(),
		energy: z.number().min(0).max(1).nullish(),
	})
	.strict();
export type AudioFeature = z.infer<typeof AudioFeature>;
export const Track = z
	.object({
		source: z.enum(["native", "catalog", "library-api"]),
		id: z.string().min(1),
		name: z.string(),
		artist: z.string(),
		album: z.string().default(""),
		duration_ms: z.number().nonnegative().default(0),
		isrc: z.string().nullish(),
		explicit: z.boolean().optional(),
		url: z.string().optional(),
		genres: z.array(z.string()).optional(),
		release_date: z.string().optional(),
		playable: z.boolean().optional(),
	})
	.passthrough();
export type Track = z.infer<typeof Track>;
export const Playlist = z
	.object({
		source: Source,
		id: z.string(),
		name: z.string(),
		tracks: z.array(Track),
		editable: z.boolean().optional(),
		smart: z.boolean().optional(),
	})
	.passthrough();
export type Playlist = z.infer<typeof Playlist>;
export type Playback = {
	running: boolean;
	state: string;
	volume?: number;
	position?: number;
	track?: Track | null;
	[key: string]: unknown;
};
export const PlaybackAction = z.enum([
	"play",
	"pause",
	"stop",
	"next",
	"previous",
	"volume",
	"seek",
	"shuffle",
	"repeat",
]);
export const PlaybackRequest = z
	.object({
		action: PlaybackAction,
		value: z.number().optional(),
		playlist_id: z.string().optional(),
		track_id: z.string().optional(),
	})
	.strict()
	.superRefine((r, ctx) => {
		const error = (message: string) =>
			ctx.addIssue({ code: "custom", message });
		if (r.playlist_id && r.track_id)
			error("Select a playlist or a track, not both.");
		if (r.action !== "play" && (r.playlist_id || r.track_id))
			error("IDs are only valid for play.");
		if (
			r.action === "volume" &&
			(r.value == null ||
				!Number.isInteger(r.value) ||
				r.value < 0 ||
				r.value > 100)
		)
			error("Volume must be an integer from 0 to 100.");
		if (
			r.action === "seek" &&
			(r.value == null || r.value < 0 || r.value > 86400)
		)
			error("Seek position must be between 0 and 86400 seconds.");
		if (r.action === "shuffle" && r.value !== 0 && r.value !== 1)
			error("Shuffle must be 0 or 1.");
		if (r.action === "repeat" && ![0, 1, 2].includes(r.value ?? -1))
			error("Repeat must be 0 (off), 1 (one), or 2 (all).");
	});
export type PlaybackRequest = z.infer<typeof PlaybackRequest>;
export const nativeId = (id: string) =>
	TrackRef.parse({ source: "native", id }).id;
export const apiId = (id: string) => AppleResourceId.parse(id);
export interface PlaylistBackend {
	tracks(ids: string[]): Promise<Track[]>;
	playlist(id: string): Promise<Playlist>;
	create(
		name: string,
		ids: string[],
		description?: string,
		accepted?: (id: string) => void,
	): Promise<Playlist>;
	append(id: string, ids: string[]): Promise<Playlist>;
}
export interface NativeBackend extends PlaylistBackend {
	bridge?(): "compatibility" | "swift-helper";
	status(): Promise<Playback>;
	search(
		query: string,
		limit: number,
		offset: number,
	): Promise<Record<string, unknown>>;
	playlists(): Promise<{
		playlists: Array<{ id: string; name: string; [key: string]: unknown }>;
	}>;
	playback(request: PlaybackRequest): Promise<Playback>;
	deleteOwned(id: string, expectedName: string): Promise<void>;
}
