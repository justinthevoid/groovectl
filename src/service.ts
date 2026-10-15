import { createHash } from "node:crypto";
import { z } from "zod";
import { AppleCatalog } from "./catalog.js";
import {
	TrackRef,
	AudioFeature,
	type NativeBackend,
	type Track,
	type Playlist,
	type Source,
} from "./models.js";
import { Plans, resultPlaylist } from "./storage.js";
import {
	auditTracks,
	bestMatch,
	suffixReview,
	versionNoise,
	normalize,
} from "./flow.js";
import { recordingAliases, sameRecordingOrder } from "./identity.js";
import { LibraryFolders } from "./organization.js";
import {
	ListeningStory,
	validateStory,
	storyReport,
	PlaylistStories,
} from "./mixtape.js";

export function fingerprint(p: Playlist): string {
	// Match Python json.dumps' default separators/ASCII escaping for existing plan receipts.
	const data = JSON.stringify([
		p.id,
		p.name,
		p.tracks.map((t) => [t.source, t.id]),
	]);
	const spaced = data
		.replace(
			/("(?:[^"\\]|\\.)*")|([,:])/g,
			(_m, quoted: string | undefined, sep: string) => quoted ?? `${sep} `,
		)
		.replace(
			/[\u007f-\uffff]/g,
			(c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
		);
	return createHash("sha256").update(spaced).digest("hex");
}
export class MusicService {
	readonly stories: PlaylistStories;
	constructor(
		readonly native: NativeBackend,
		readonly catalog = new AppleCatalog(),
		readonly plans = new Plans(),
	) {
		this.stories = new PlaylistStories(plans.root);
	}
	async resolve(title: string, artist: string) {
		const candidates = await this.catalog.search(`${title} ${artist}`, 25),
			match = bestMatch(title, artist, candidates);
		return {
			query: { title, artist },
			match,
			needs_review:
				!!match &&
				(normalize(title) !== normalize(match.name) ||
					normalize(artist) !== normalize(match.artist) ||
					suffixReview(title, match.name) ||
					versionNoise(match.name).some(
						(m) => !versionNoise(title).includes(m),
					)),
			candidates: candidates.slice(0, 10),
		};
	}
	async grounded(input: TrackRef[]): Promise<Track[]> {
		const refs = z.array(TrackRef).min(1).max(200).parse(input);
		if (
			new Set(refs.map((r) => (r.source === "native" ? "native" : "api")))
				.size !== 1
		)
			throw new Error(
				"Use one source backend per plan: native tracks, or Apple Music catalog and API-library songs.",
			);
		const backend = refs[0]!.source === "native" ? this.native : this.catalog;
		const tracks = refs.some((ref) => ref.source === "library-api")
			? await this.catalog.resolveRefs(refs)
			: await backend.tracks(refs.map((r) => r.id));
		if (
			tracks.length !== refs.length ||
			tracks.some(
				(t, i) => t.id !== refs[i]!.id || t.source !== refs[i]!.source,
			)
		)
			throw new Error(
				"Resolved recordings did not match every requested ID in order.",
			);
		return tracks;
	}
	async getPlaylist(source: Source, id: string): Promise<Playlist> {
		const playlist = await (source === "native"
			? this.native
			: this.catalog
		).playlist(id);
		return { ...playlist, ...this.stories.read(playlist) };
	}
	async preview(
		name: string,
		refs: TrackRef[],
		description = "",
		playlistId?: string,
		features: AudioFeature[] = [],
		parentFolderId?: string,
		storyInput?: ListeningStory,
	) {
		z.string().max(120).parse(name);
		z.string().max(2000).parse(description);
		features = z.array(AudioFeature).max(200).parse(features);
		if (!playlistId && !name.trim())
			throw new Error("A playlist name is required.");
		const tracks = await this.grounded(refs),
			source = refs[0]!.source === "native" ? "native" : "catalog";
		const story = storyInput ? validateStory(storyInput, tracks) : undefined;
		if (story && playlistId)
			throw new Error(
				"A listening story can be assigned only to a new playlist; additions would change its chapter ranges.",
			);
		const target = playlistId
			? await this.getPlaylist(source, playlistId)
			: undefined;
		if (parentFolderId && (source !== "catalog" || target))
			throw new Error(
				"A parent folder can be chosen only for a new API playlist.",
			);
		const parent = parentFolderId
			? await new LibraryFolders(this.catalog, this.plans).get(parentFolderId)
			: undefined;
		if (target?.smart || target?.editable === false)
			throw new Error("Target playlist is not editable.");
		const seen = new Set(target?.tracks.flatMap(recordingAliases));
		const additions = tracks.filter((t) => {
			const keys = recordingAliases(t);
			if (keys.some((key) => seen.has(key))) return false;
			for (const key of keys) seen.add(key);
			return true;
		});
		if (!additions.length)
			throw new Error(
				"No new tracks; every selected recording is already included.",
			);
		return this.plans.create({
			operation: target ? "append" : "create",
			source,
			name: target?.name ?? name,
			description,
			tracks: additions,
			playlist_id: playlistId ?? null,
			before_fingerprint: target ? fingerprint(target) : null,
			expected_ids: target?.tracks.map((t) => t.id) ?? [],
			expected_tracks: [...(target?.tracks ?? []), ...additions],
			...(parent ? { parent_folder: parent } : {}),
			audit: auditTracks([...(target?.tracks ?? []), ...additions], features),
			duplicates_removed: tracks.length - additions.length,
			...(story
				? { story, listening_story: storyReport(additions, story) }
				: {}),
		});
	}
	async apply(id: string) {
		return this.plans.mutation(async () => {
			const plan = this.plans.get(id);
			if (plan.payload.operation === "change")
				throw new Error(
					"Use apply_music_change for this reviewed preference/library change.",
				);
			if (plan.state === "applied") return plan;
			if (plan.state !== "ready")
				throw new Error(
					`Plan state is ${plan.state}; inspect the saved result before taking another action.`,
				);
			const p = plan.payload,
				backend = p.source === "native" ? this.native : this.catalog;
			if (p.story) validateStory(p.story, p.tracks);
			const parent = p.parent_folder
				? z
						.object({
							id: z.string(),
							type: z.literal("library-playlist-folders"),
							name: z.string(),
						})
						.parse(p.parent_folder)
				: undefined;
			if (
				parent &&
				JSON.stringify(
					await new LibraryFolders(this.catalog, this.plans).get(parent.id),
				) !== JSON.stringify(parent)
			)
				throw new Error(
					"Parent folder changed since preview; make a fresh plan.",
				);
			if (
				p.operation === "append" &&
				fingerprint(await backend.playlist(p.playlist_id!)) !==
					p.before_fingerprint
			)
				throw new Error("Playlist changed since preview; make a fresh plan.");
			if (p.source === "catalog") {
				if (!this.catalog.readiness().user_authorized)
					throw new Error(
						"Apple Music user authorization is required before applying catalog plans.",
					);
				await this.catalog.developerToken();
			}
			this.plans.claim(id);
			let acceptedId: string | undefined;
			try {
				const ids = p.tracks.map((t) => t.id);
				const accepted = (pid: string) => {
					acceptedId = pid;
					this.plans.finish(id, "applying", { accepted_playlist_id: pid });
				};
				let result: Playlist;
				if (parent || p.tracks.some((t) => t.source === "library-api")) {
					const refs = p.tracks.map((t) =>
						TrackRef.parse({ source: t.source, id: t.id }),
					);
					result =
						p.operation === "append"
							? await this.catalog.appendWithRefs(p.playlist_id!, refs)
							: await this.catalog.createWithRefs(
									p.name,
									refs,
									p.description,
									accepted,
									parent?.id,
								);
				} else {
					result =
						p.operation === "append"
							? await backend.append(p.playlist_id!, ids)
							: await backend.create(p.name, ids, p.description, accepted);
				}
				const expected = [...p.expected_ids, ...ids],
					actual = result.tracks.map((t) => t.id);
				const orderVerified = p.expected_tracks
					? sameRecordingOrder(p.expected_tracks, result.tracks)
					: JSON.stringify(actual) === JSON.stringify(expected);
				const parentVerified = parent
					? await new LibraryFolders(this.catalog, this.plans).contains(
							parent.id,
							result.id,
						)
					: undefined;
				if (!orderVerified || parentVerified === false)
					this.plans.finish(id, "needs_review", {
						playlist: result,
						expected_ids: expected,
						order_verified: orderVerified,
						parent_verified: parentVerified,
						message:
							"Write completed but track order/count or chosen folder did not verify. Do not retry.",
					});
				else {
					let storyStorage: Record<string, unknown> | undefined;
					if (p.story) {
						try {
							this.stories.remember(result, p.story);
							storyStorage = { saved: true };
						} catch {
							storyStorage = {
								saved: false,
								message:
									"Playlist verified, but local story metadata could not be saved. Keep this plan's story; do not repeat the music write.",
							};
						}
					}
					this.plans.finish(id, "applied", {
						playlist: result,
						verified: true,
						...(parent ? { parent_verified: true } : {}),
						...(storyStorage ? { story_storage: storyStorage } : {}),
					});
				}
			} catch {
				this.plans.finish(id, "unknown", {
					...(acceptedId ? { accepted_playlist_id: acceptedId } : {}),
					message:
						"Write outcome needs inspection. This plan is blocked from automatic retry.",
					retry_safe: false,
				});
				throw new Error(
					"Write outcome needs inspection. This plan is blocked from automatic retry.",
				);
			}
			return this.plans.get(id);
		});
	}
	async deleteCreated(id: string, confirmation: string) {
		return this.plans.mutation(async () => {
			const plan = this.plans.get(id),
				p = plan.payload;
			if (
				plan.state !== "applied" ||
				p.operation !== "create" ||
				p.source !== "native"
			)
				throw new Error(
					"Only a native playlist created by an applied plan can be removed here.",
				);
			const item = resultPlaylist(plan);
			if (confirmation !== item.name)
				throw new Error(
					"Confirmation must exactly match the created playlist name.",
				);
			if (
				fingerprint(await this.native.playlist(item.id)) !== fingerprint(item)
			)
				throw new Error("Playlist changed after creation; refusing deletion.");
			this.plans.finish(id, "deleting", { playlist: item });
			try {
				await this.native.deleteOwned(item.id, item.name);
				if (
					(await this.native.playlists()).playlists.some(
						(p) => p.id === item.id,
					)
				)
					throw new Error("Playlist still exists.");
				this.plans.finish(id, "deleted", {
					playlist_id: item.id,
					verified: true,
				});
			} catch {
				this.plans.finish(id, "unknown", {
					message: "Deletion outcome needs inspection.",
					retry_safe: false,
				});
				throw new Error("Deletion outcome needs inspection; do not retry.");
			}
			return this.plans.get(id);
		});
	}
}
