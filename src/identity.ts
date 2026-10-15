import type { Track } from "./models.js";

/** Apple-supplied catalog/library aliases only; ISRC/title similarity never proves equality. */
export function recordingAliases(track: Track): string[] {
	if (
		track.source !== "native" &&
		typeof track.resource_type === "string" &&
		!["songs", "library-songs"].includes(track.resource_type)
	)
		return [`apple-resource:${track.resource_type}:${track.id}`];
	const keys = [`${track.source}:${track.id}`];
	if (track.source !== "native") {
		if (typeof track.library_id === "string")
			keys.push(`library-api:${track.library_id}`);
		if (
			typeof track.catalog_id === "string" &&
			/^\d{1,20}$/.test(track.catalog_id)
		)
			keys.push(`catalog:${track.catalog_id}`);
	}
	return [...new Set(keys)];
}
export function sameRecording(left: Track, right: Track) {
	const aliases = new Set(recordingAliases(left));
	return recordingAliases(right).some((key) => aliases.has(key));
}
export function sameRecordingOrder(expected: Track[], actual: Track[]) {
	return (
		expected.length === actual.length &&
		expected.every((track, index) => sameRecording(track, actual[index]!))
	);
}
