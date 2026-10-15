import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
	AudioFeature,
	TrackRef,
	Playlist,
	Track,
	type Source,
} from "./models.js";
import { MusicService, fingerprint } from "./service.js";
import { auditTracks, checkPair, foldTempo, normalize } from "./flow.js";
import { savePrivate } from "./storage.js";
import { ListeningStory, validateStory, storyReport } from "./mixtape.js";
import { recordingAliases } from "./identity.js";

export function comparePlaylists(a: Playlist, b: Playlist) {
	const key = (t: Track) => `${t.source}:${t.id}`;
	const left = new Set(a.tracks.map(key)),
		right = new Set(b.tracks.map(key));
	const positions = new Map(a.tracks.map((t, i) => [key(t), i + 1]));
	return {
		source_names: [a.name, b.name],
		same_order:
			JSON.stringify(a.tracks.map(key)) === JSON.stringify(b.tracks.map(key)),
		only_in_first: a.tracks.filter((t) => !right.has(key(t))),
		only_in_second: b.tracks.filter((t) => !left.has(key(t))),
		moved: b.tracks.flatMap((t, i) =>
			positions.has(key(t)) && positions.get(key(t)) !== i + 1
				? [{ track: t, from: positions.get(key(t)), to: i + 1 }]
				: [],
		),
		duplicate_note:
			"Membership uses recording IDs; positions show the last occurrence when a playlist repeats a recording.",
	};
}
export function sequenceTracks(
	tracks: Track[],
	options: {
		artist_gap: number;
		features?: AudioFeature[];
		energy_arc?: "rise" | "fall" | "peak";
		story?: ListeningStory;
	},
): Record<string, unknown> {
	const story = options.story
		? validateStory(options.story, tracks, false)
		: undefined;
	const pins = new Map(
		(story?.anchors ?? []).map((anchor) => [
			anchor.position,
			tracks.findIndex((t) =>
				recordingAliases(t).includes(
					`${anchor.track.source}:${anchor.track.id}`,
				),
			),
		]),
	);
	const reserved = new Set(pins.values());
	const features = new Map(
		(options.features ?? []).map((f) => [
			f.id,
			{ ...f, bpm: f.bpm ? foldTempo(f.bpm) : f.bpm },
		]),
	);
	if (
		options.energy_arc &&
		!tracks.some((t) => features.get(t.id)?.energy != null)
	)
		throw new Error("An energy arc requires user-supplied energy estimates.");
	const remaining = tracks.map((track, index) => ({ track, index })),
		ordered: Track[] = [];
	while (remaining.length) {
		const previous = ordered.at(-1),
			recent = ordered
				.slice(-options.artist_gap)
				.map((t) => normalize(t.artist));
		const fraction = ordered.length / Math.max(1, tracks.length - 1);
		const target =
			options.energy_arc === "rise"
				? fraction
				: options.energy_arc === "fall"
					? 1 - fraction
					: 1 - Math.abs(2 * fraction - 1);
		let chosen = 0,
			best = Infinity;
		const position = ordered.length + 1;
		const chapter = story?.chapters.find(
			(c) => position >= c.start && position <= c.end,
		);
		for (let i = 0; i < remaining.length; i++) {
			const { track, index } = remaining[i]!,
				f = features.get(track.id);
			if (chapter && (index + 1 < chapter.start || index + 1 > chapter.end))
				continue;
			if (chapter?.ordering === "preserve" && index + 1 !== position) continue;
			if (
				pins.has(position) ? index !== pins.get(position) : reserved.has(index)
			)
				continue;
			const artistPenalty =
				options.artist_gap && recent.includes(normalize(track.artist)) ? 20 : 0;
			const adjacency = previous
				? checkPair(features.get(previous.id), f).length
				: 0;
			const arc =
				options.energy_arc && f?.energy != null
					? Math.abs(f.energy - target) * 5
					: 0;
			const cost = artistPenalty + adjacency + arc + index / 100000;
			if (cost < best) {
				best = cost;
				chosen = i;
			}
		}
		if (!Number.isFinite(best))
			throw new Error(
				"No recording satisfies the chapter and anchor constraints.",
			);
		ordered.push(remaining.splice(chosen, 1)[0]!.track);
	}
	const conflicts = ordered.flatMap((t, i) =>
		options.artist_gap &&
		ordered
			.slice(Math.max(0, i - options.artist_gap), i)
			.some((p) => normalize(p.artist) === normalize(t.artist))
			? [{ position: i + 1, artist: t.artist }]
			: [],
	);
	return {
		tracks: ordered,
		...(story
			? {
					story: validateStory(story, ordered),
					listening_story: storyReport(ordered, story),
				}
			: {}),
		original_positions: ordered.map((t) => tracks.indexOf(t) + 1),
		artist_spacing_conflicts: conflicts,
		audit: auditTracks(ordered, options.features),
		method:
			"Deterministic heuristic using artist spacing and supplied estimates. This suggests an order; it does not change a playlist or measure musical taste.",
	};
}
export class Curation {
	constructor(private music: MusicService) {}
	private snapshotDir() {
		const root = join(this.music.plans.root, "snapshots");
		mkdirSync(root, { recursive: true, mode: 0o700 });
		return root;
	}
	async snapshot(source: Source, id: string) {
		const playlist = await this.music.getPlaylist(source, id),
			snapshot_id = randomUUID();
		const snapshot = {
			snapshot_id,
			created_at: new Date().toISOString(),
			fingerprint: fingerprint(playlist),
			playlist,
		};
		savePrivate(join(this.snapshotDir(), `${snapshot_id}.json`), snapshot);
		return snapshot;
	}
	snapshots() {
		return {
			snapshots: readdirSync(this.snapshotDir())
				.filter((n) => /^[\da-f-]{36}\.json$/.test(n))
				.sort()
				.map((n) => {
					const s = this.readSnapshot(n.slice(0, -5));
					return {
						snapshot_id: s.snapshot_id,
						created_at: s.created_at,
						name: s.playlist.name,
						track_count: s.playlist.tracks.length,
					};
				}),
		};
	}
	readSnapshot(id: string) {
		z.string().uuid().parse(id);
		const file = join(this.snapshotDir(), `${id}.json`);
		if (!existsSync(file)) throw new Error("Snapshot not found.");
		return z
			.object({
				snapshot_id: z.string().uuid(),
				created_at: z.string(),
				fingerprint: z.string(),
				playlist: Playlist,
			})
			.parse(JSON.parse(readFileSync(file, "utf8")));
	}
	restore(id: string, name: string) {
		const s = this.readSnapshot(id);
		const refs = s.playlist.tracks.map((t) =>
			TrackRef.parse({ source: t.source, id: t.id }),
		);
		return this.music.preview(
			name,
			refs,
			`Restored from local snapshot ${id}.`,
			undefined,
			[],
			undefined,
			s.playlist.story === undefined
				? undefined
				: ListeningStory.parse(s.playlist.story),
		);
	}
	async export(source: Source, id: string, format: "json" | "m3u8") {
		const playlist = await this.music.getPlaylist(source, id);
		if (format === "json")
			return {
				filename: "playlist.groovectl.json",
				mime_type: "application/json",
				content: JSON.stringify(
					{ format: "groovectl-playlist", version: 1, playlist },
					null,
					2,
				),
			};
		const link = (track: Track) => {
			if (!track.url || /[\r\n\0]/.test(track.url)) return undefined;
			try {
				const url = new URL(track.url);
				return url.origin === "https://music.apple.com" &&
					!url.username &&
					!url.password
					? url.href
					: undefined;
			} catch {
				return undefined;
			}
		};
		const exportable = playlist.tracks.flatMap((track) => {
			const url = link(track);
			return url ? [{ track, url }] : [];
		});
		const clean = (s: string) => s.replace(/[\r\n]/g, " ");
		const content =
			[
				"#EXTM3U",
				...(playlist.story
					? ListeningStory.parse(playlist.story).chapters.map(
							(c) => `#GROOVECTL-CHAPTER:${c.start}-${c.end}:${clean(c.title)}`,
						)
					: []),
				...exportable.flatMap(({ track, url }) => [
					`#EXTINF:${Math.round(track.duration_ms / 1000)},${clean(track.artist)} - ${clean(track.name)}`,
					url,
				]),
			].join("\n") + "\n";
		return {
			filename: "playlist.m3u8",
			mime_type: "audio/x-mpegurl",
			content,
			omitted_tracks_without_catalog_url:
				playlist.tracks.length - exportable.length,
			note: "Apple Music links require a compatible player and subscription. These are not downloadable audio files. GROOVECTL-CHAPTER comments describe original 1-based ranges; generic players may ignore them. JSON retains the complete story.",
		};
	}
	async importPreview(name: string, input: string) {
		if (input.length > 1_048_576) throw new Error("Import exceeds 1 MiB.");
		const parsed: unknown = JSON.parse(input);
		const document = z
			.object({
				format: z.literal("groovectl-playlist"),
				version: z.literal(1),
				playlist: Playlist,
			})
			.parse(parsed);
		const refs = document.playlist.tracks.map((t) =>
			TrackRef.parse({ source: t.source, id: t.id }),
		);
		return this.music.preview(
			name,
			refs,
			"Imported with every recording revalidated.",
			undefined,
			[],
			undefined,
			document.playlist.story === undefined
				? undefined
				: ListeningStory.parse(document.playlist.story),
		);
	}
	async pool(
		queries: string[],
		excludedArtists: string[],
		excludeExplicit: boolean,
	) {
		const seen = new Set<string>(),
			tracks: Track[] = [];
		const excluded = new Set(excludedArtists.map(normalize));
		for (const query of queries)
			for (const t of await this.music.catalog.search(query, 25)) {
				if (
					seen.has(t.id) ||
					excluded.has(normalize(t.artist)) ||
					(excludeExplicit && t.explicit)
				)
					continue;
				seen.add(t.id);
				tracks.push(t);
			}
		return {
			tracks,
			queries,
			count: tracks.length,
			note: "Catalog-verified candidates from your search terms. The host agent selects music for the listening brief; search ranking is not a taste score.",
		};
	}
	async profile(source: Source, maxTracks: number) {
		const tracks: Track[] = [];
		let total: number | undefined;
		if (source === "native")
			for (let offset = 0; tracks.length < maxTracks; offset += 100) {
				const page = z
					.object({ tracks: z.array(Track), total: z.number() })
					.parse(
						await this.music.native.search(
							"",
							Math.min(100, maxTracks - tracks.length),
							offset,
						),
					);
				total = page.total;
				tracks.push(...page.tracks);
				if (!page.tracks.length || tracks.length >= page.total) break;
			}
		else
			for (let offset = 0; tracks.length < maxTracks; offset += 100) {
				const page = await this.music.catalog.library("songs", offset);
				for (const r of page.data ?? []) {
					if (tracks.length >= maxTracks) break;
					tracks.push(
						Track.parse({
							source: "library-api",
							id: r.id,
							name: r.attributes.name ?? "",
							artist: r.attributes.artistName ?? "",
							album: r.attributes.albumName ?? "",
							duration_ms: r.attributes.durationInMillis ?? 0,
						}),
					);
				}
				if (!page.next) break;
			}
		const counts = new Map<string, number>();
		for (const t of tracks)
			counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1);
		return {
			source,
			sampled_tracks: tracks.length,
			total_library_tracks: total ?? null,
			sample_limit: maxTracks,
			sampling:
				"First library pages, not a random sample or complete listening history.",
			top_artists_in_sample: [...counts]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 20)
				.map(([artist, tracks]) => ({ artist, tracks })),
			audit: auditTracks(tracks),
		};
	}
}
