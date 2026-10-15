import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TrackRef, Playlist, type Track } from "./models.js";
import { recordingAliases, sameRecordingOrder } from "./identity.js";
import { savePrivate, loadPrivate } from "./storage.js";

import { ListeningStory } from "./listening-story.js";
export { ListeningStory, Recipe, recipes } from "./listening-story.js";
const matches = (track: Track, ref: TrackRef) =>
	recordingAliases(track).includes(`${ref.source}:${ref.id}`);

/** Chapter positions partition the supplied pool; pins may move only within that chapter. */
export function validateStory(
	input: unknown,
	tracks: Track[],
	finalOrder = true,
): ListeningStory {
	const story = ListeningStory.parse(input);
	if (!tracks.length || tracks.length > 200)
		throw new Error("A listening story needs 1–200 recordings.");
	const seen = new Set<string>();
	for (const track of tracks) {
		const aliases = recordingAliases(track);
		if (aliases.some((key) => seen.has(key)))
			throw new Error(
				"Resolve duplicate recordings before assigning a listening story.",
			);
		aliases.forEach((key) => seen.add(key));
	}
	if (story.chapters.length) {
		let next = 1;
		for (const chapter of story.chapters) {
			if (
				chapter.start !== next ||
				chapter.end < chapter.start ||
				chapter.end > tracks.length
			)
				throw new Error(
					"Chapters must cover every recording exactly once, in contiguous ordered ranges starting at 1.",
				);
			next = chapter.end + 1;
		}
		if (next !== tracks.length + 1)
			throw new Error("Chapters must cover every recording exactly once.");
	}
	const slots = new Set<number>(),
		pinned = new Set<number>();
	for (const anchor of story.anchors) {
		const index = tracks.findIndex((track) => matches(track, anchor.track));
		if (index < 0 || anchor.position > tracks.length)
			throw new Error(
				"Every anchor must identify a supplied recording and a valid final position.",
			);
		if (slots.has(anchor.position) || pinned.has(index))
			throw new Error(
				"Anchor recordings and final positions must each be unique.",
			);
		slots.add(anchor.position);
		pinned.add(index);
		if (finalOrder && !matches(tracks[anchor.position - 1]!, anchor.track))
			throw new Error(
				"Pinned anchors do not match this order; sequence again or correct the story.",
			);
		if (!finalOrder && story.chapters.length) {
			const chapter = story.chapters.find(
				(c) => index + 1 >= c.start && index + 1 <= c.end,
			)!;
			if (anchor.position < chapter.start || anchor.position > chapter.end)
				throw new Error("A pinned anchor cannot leave its assigned chapter.");
			if (chapter.ordering === "preserve" && anchor.position !== index + 1)
				throw new Error(
					"An anchor cannot reorder a chapter whose internal order is preserved.",
				);
		}
	}
	return story;
}

export function storyReport(tracks: Track[], story: ListeningStory) {
	const duration = (items: Track[]) =>
		Math.round(items.reduce((sum, t) => sum + t.duration_ms, 0) / 6000) / 10;
	const missing = tracks.filter((t) => !t.duration_ms).length;
	const actual = tracks.reduce((sum, t) => sum + t.duration_ms, 0) / 60000;
	const delta =
		story.runtime_budget_minutes === undefined
			? null
			: actual - story.runtime_budget_minutes;
	return {
		chapters: story.chapters.map((chapter) => ({
			...chapter,
			track_count: chapter.end - chapter.start + 1,
			duration_minutes: duration(tracks.slice(chapter.start - 1, chapter.end)),
		})),
		anchors: story.anchors,
		runtime: {
			known_duration_minutes: duration(tracks),
			missing_duration_count: missing,
			budget_minutes: story.runtime_budget_minutes ?? null,
			difference_minutes:
				delta === null || missing ? null : Math.round(delta * 10) / 10,
			status: missing
				? "incomplete"
				: delta === null
					? "unbudgeted"
					: Math.abs(delta) <= story.runtime_tolerance_minutes
						? "within_budget"
						: delta > 0
							? "over_budget"
							: "under_budget",
			note: "Runtime uses recording metadata. No tracks are shortened, dropped or substituted to meet a budget; missing durations are unknown.",
		},
	};
}

const SavedStory = z.object({ playlist: Playlist, story: ListeningStory });
export class PlaylistStories {
	constructor(readonly root: string) {}
	private path(playlist: Playlist) {
		const key = createHash("sha256")
			.update(`${playlist.source}:${playlist.id}`)
			.digest("hex");
		return join(this.root, "stories", key + ".json");
	}
	remember(playlist: Playlist, input: unknown) {
		const story = validateStory(input, playlist.tracks);
		savePrivate(this.path(playlist), { playlist, story });
	}
	read(playlist: Playlist): {
		story_status: "absent" | "stale" | "current" | "unavailable";
		story?: ListeningStory;
	} {
		const path = this.path(playlist);
		if (!existsSync(path)) return { story_status: "absent" };
		try {
			const saved = SavedStory.parse(loadPrivate(path));
			if (
				saved.playlist.source !== playlist.source ||
				saved.playlist.id !== playlist.id ||
				saved.playlist.name !== playlist.name ||
				!sameRecordingOrder(saved.playlist.tracks, playlist.tracks)
			)
				return { story_status: "stale" };
			return {
				story_status: "current",
				story: validateStory(saved.story, playlist.tracks),
			};
		} catch {
			return { story_status: "unavailable" };
		}
	}
}
