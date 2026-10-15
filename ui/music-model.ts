import { z } from "zod";

export const Recording = z.object({
	source: z.enum(["catalog", "native", "library-api"]),
	id: z.string().min(1),
	name: z.string(),
	artist: z.string(),
	album: z.string().default(""),
	duration_ms: z.number().nonnegative().default(0),
	explicit: z.boolean().optional(),
	playable: z.boolean().optional(),
});
export type Recording = z.infer<typeof Recording>;
export type Category = "recently-added" | "playlists" | "songs" | "albums" | "artists";
export type LibrarySource = "catalog" | "native";
export type CollectionItem = {
	id: string;
	source: "library-api" | "native";
	kind: string;
	name: string;
	artist: string;
	artwork?: string;
	recording?: Recording;
};
export type CollectionPage = { items: CollectionItem[]; hasMore: boolean };

const Resource = z.object({
	id: z.string().min(1), type: z.string().min(1),
	attributes: z.object({
		name: z.string().optional(), artistName: z.string().optional(),
		albumName: z.string().optional(), durationInMillis: z.number().nonnegative().optional(),
		contentRating: z.string().optional(), playParams: z.record(z.string(), z.unknown()).optional(),
		artwork: z.object({ url: z.string() }).optional(),
	}).default({}),
});

// The app's CSP permits only Apple's artwork CDN. Do not load arbitrary URLs from metadata.
export function artworkUrl(value: string | undefined): string | undefined {
	if (!value) return;
	try {
		const url = new URL(value.replaceAll("{w}", "360").replaceAll("{h}", "360").replaceAll("{f}", "jpg"));
		if (url.protocol === "https:" && !url.username && !url.password && !url.port && /(^|\.)mzstatic\.com$/.test(url.hostname)) return url.href;
	} catch { /* Missing or unsupported artwork uses the named fallback. */ }
}
export function resourceItem(value: unknown): CollectionItem {
	const r = Resource.parse(value), a = r.attributes;
	const kind = r.type;
	return {
		id: r.id, source: "library-api", kind,
		name: a.name || "Untitled item", artist: a.artistName || "",
		artwork: artworkUrl(a.artwork?.url),
		...(kind === "library-songs" ? { recording: {
			source: "library-api" as const, id: r.id, name: a.name || "Untitled recording",
			artist: a.artistName || "", album: a.albumName || "", duration_ms: a.durationInMillis ?? 0,
			explicit: a.contentRating === "explicit", playable: !!a.playParams,
		} } : {}),
	};
}
export function collectionPage(value: unknown, source: LibrarySource): CollectionPage {
	if (source === "native") {
		const page = z.object({ playlists: z.array(z.object({ id: z.string().min(1), name: z.string() })) }).parse(value);
		return { items: page.playlists.map(p => ({ ...p, source: "native", kind: "native-playlists", artist: "Music.app" })), hasMore: false };
	}
	const page = z.object({ data: z.array(z.unknown()), next: z.string().optional() }).parse(value);
	return { items: page.data.map(resourceItem), hasMore: !!page.next };
}
export function recordingKey(track: Pick<Recording, "source" | "id">) { return `${track.source}:${track.id}`; }
export function formatTime(seconds: number | undefined): string {
	if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
	return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function targetFor(recording: Recording, player: string | undefined): string | undefined {
	if (recording.playable === false) return;
	if (player === "native" && recording.source === "native" && /^[0-9a-f]{16}$/i.test(recording.id)) return recording.id;
	if (player === "cider" && recording.source === "catalog" && /^\d+$/.test(recording.id)) return recording.id;
}
