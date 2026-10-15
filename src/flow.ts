// Adjacency rules and catalog matching are derived from Z-Han-Z/apple-music-playlists (MIT).
// See THIRD_PARTY_NOTICES.md for the pinned source and retained license.
import type { AudioFeature, Track } from "./models.js";
export function foldTempo(bpm: number): number {
	if (!Number.isFinite(bpm) || bpm <= 0) return 0;
	while (bpm >= 160) bpm /= 2;
	while (bpm < 70) bpm *= 2;
	return Math.round(bpm * 10) / 10;
}
export function harmonicOK(a = "?", b = "?"): boolean {
	if (!/^(?:[1-9]|1[0-2])[AB]$/.test(a) || !/^(?:[1-9]|1[0-2])[AB]$/.test(b))
		return false;
	const na = parseInt(a),
		nb = parseInt(b),
		diff = Math.abs(na - nb);
	return na === nb || (a.at(-1) === b.at(-1) && (diff === 1 || diff === 11));
}
export function checkPair(a?: AudioFeature, b?: AudioFeature): string[] {
	if (!a?.bpm || !b?.bpm) return [];
	const pct = ((b.bpm - a.bpm) / a.bpm) * 100,
		ok = harmonicOK(a.key ?? "?", b.key ?? "?");
	return [
		a.bpm < 100 && b.bpm < 100 && "two_slow",
		pct < 0 && -pct < 12 && "small_drop",
		Math.abs(pct) < 6 && ok && "both_similar",
		Math.abs(pct) > 40 && "big_jump",
		a.energy != null &&
			b.energy != null &&
			Math.abs(a.energy - b.energy) > 0.35 &&
			!ok &&
			"energy_clash",
	]
		.filter((s): s is string => typeof s === "string")
		.sort();
}
const latin =
	"remastered|instrumental|acoustic|karaoke|remaster|reprise|deluxe|stereo|version|remix|re-mix|mixed|bonus|cover|live|demo|edit|mono";
export function versionNoise(title: string): string[] {
	const lower = title.toLowerCase();
	return [
		...["现场", "演唱会", "伴奏", "翻唱", "重制", "纯音乐"].filter((s) =>
			lower.includes(s),
		),
		...lower.matchAll(new RegExp(`\\b(?:${latin})\\b`, "g")),
	].map((v) => (typeof v === "string" ? v : v[0]));
}
export const normalize = (s: string) =>
	s
		.toLowerCase()
		.replaceAll("ß", "ss")
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N}]/gu, "");
export function suffixReview(wanted: string, actual: string): boolean {
	if (
		actual.toLowerCase() === wanted.toLowerCase() ||
		!actual.toLowerCase().startsWith(wanted.toLowerCase())
	)
		return false;
	return (
		/^[([\-–—]/.test(actual.slice(wanted.length).trimStart()) &&
		!versionNoise(wanted).some((v) => versionNoise(actual).includes(v))
	);
}
export function bestMatch(
	title: string,
	artist: string,
	songs: Track[],
): Track | null {
	const nt = normalize(title),
		na = normalize(artist),
		requested = new Set(versionNoise(title));
	if (!nt) return null;
	return (
		songs
			.map((t, index) => {
				const n = normalize(t.name),
					a = normalize(t.artist);
				const valid =
					!!n &&
					(nt.includes(n) || n.includes(nt)) &&
					(!na || (!!a && (na.includes(a) || a.includes(na))));
				const score =
					(nt === n ? 3 : 2) +
					(na ? (na === a ? 2 : 1.5) : 0) -
					(versionNoise(t.name).some((v) => !requested.has(v)) ? 1.2 : 0);
				return { t, index, valid, score };
			})
			.filter((t) => t.valid)
			.sort((a, b) => b.score - a.score || a.index - b.index)[0]?.t ?? null
	);
}
export function auditTracks(
	tracks: Track[],
	features: AudioFeature[] = [],
): Record<string, unknown> {
	const counts = new Map<string, number>(),
		artists = new Map<string, number>();
	for (const t of tracks) {
		const k = `${t.source}:${t.id}`;
		counts.set(k, (counts.get(k) ?? 0) + 1);
		artists.set(t.artist, (artists.get(t.artist) ?? 0) + 1);
	}
	const supplied = new Map(
		features.map((f) => [
			f.id,
			{ ...f, bpm: f.bpm ? foldTempo(f.bpm) : f.bpm },
		]),
	);
	return {
		track_count: tracks.length,
		duration_minutes:
			Math.round(tracks.reduce((n, t) => n + t.duration_ms, 0) / 6000) / 10,
		duplicates: [...counts]
			.filter(([, c]) => c > 1)
			.map(([k, count]) => {
				const [source, id] = k.split(":");
				return { source, id, count };
			}),
		repeated_artists: [...artists]
			.filter(([, c]) => c > 2)
			.map(([artist, count]) => ({ artist, count })),
		version_qualifiers: tracks.flatMap((t, i) =>
			versionNoise(t.name).length
				? [{ position: i + 1, name: t.name, markers: versionNoise(t.name) }]
				: [],
		),
		audio_feature_coverage: {
			available: tracks.filter((t) => supplied.get(t.id)?.bpm).length,
			total: tracks.length,
			source: "user-supplied estimates",
		},
		adjacency_warnings: tracks.flatMap((t, i) => {
			const rules = i
				? checkPair(supplied.get(tracks[i - 1]!.id), supplied.get(t.id))
				: [];
			return rules.length
				? [{ from_position: i, to_position: i + 1, rules }]
				: [];
		}),
		note: "Musical taste and listening flow remain the host agent's judgment. Missing audio features are not scored.",
	};
}
