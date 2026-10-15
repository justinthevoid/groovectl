import { z } from "zod";
import type { AppleCatalog } from "./catalog.js";
import type { Plans } from "./storage.js";
import { FolderChange, LibraryFolders } from "./organization.js";
import { AppleResourceId } from "./models.js";

export const RatingResource = z.enum([
	"songs",
	"albums",
	"playlists",
	"music-videos",
	"stations",
	"library-songs",
	"library-albums",
	"library-playlists",
	"library-music-videos",
]);
const ids = z
	.array(AppleResourceId)
	.min(1)
	.max(25)
	.refine(
		(v) => new Set(v).size === v.length,
		"Duplicate resource IDs are not allowed.",
	);
const PreferenceChange = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("rating"),
			resource: RatingResource,
			ids,
			value: z.union([z.literal(1), z.literal(-1), z.literal("clear")]),
		})
		.strict(),
	z
		.object({
			action: z.literal("favorite"),
			resource: z.enum(["songs", "albums", "playlists"]),
			ids,
		})
		.strict(),
	z
		.object({
			action: z.literal("add_library"),
			resource: z.enum(["songs", "albums", "playlists", "music-videos"]),
			ids,
		})
		.strict(),
]);
export const MusicChange = z.discriminatedUnion("action", [
	...PreferenceChange.options,
	FolderChange,
]);
export type MusicChange = z.infer<typeof MusicChange>;
export async function ratings(
	catalog: AppleCatalog,
	resource: z.infer<typeof RatingResource>,
	input: string[],
) {
	resource = RatingResource.parse(resource);
	const requested = ids.parse(input);
	const result = await catalog.request("GET", `/v1/me/ratings/${resource}`, {
		personal: true,
		params: { ids: requested.join(",") },
	});
	if (!Array.isArray(result.data))
		throw new Error(
			"Apple returned no ratings collection; absence cannot be verified from this response.",
		);
	const found = new Map(
		(result.data ?? []).map((r) => [
			r.id,
			z.union([z.literal(1), z.literal(-1)]).parse(r.attributes.value),
		]),
	);
	return {
		resource,
		ratings: requested.map((id) => ({ id, value: found.get(id) ?? null })),
		meaning:
			"Like/dislike ratings are separate from favorites and native star ratings.",
	};
}
export class Preferences {
	constructor(
		readonly catalog: AppleCatalog,
		readonly plans: Plans,
	) {}
	private async targets(change: z.infer<typeof PreferenceChange>) {
		const library = change.resource.startsWith("library-");
		const result = await this.catalog.request(
			"GET",
			library
				? `/v1/me/library/${change.resource.slice(8)}`
				: `/v1/catalog/${this.catalog.storefront()}/${change.resource}`,
			{ personal: library, params: { ids: change.ids.join(",") } },
		);
		return change.ids.map((id) => {
			const item = result.data?.find((r) => r.id === id);
			if (!item)
				throw new Error(
					`Resource ${id} is unavailable; no change was planned.`,
				);
			return {
				id,
				type: change.resource,
				name: item.attributes.name ?? id,
				artist: item.attributes.artistName,
			};
		});
	}
	async preview(input: MusicChange) {
		const change = MusicChange.parse(input);
		if (change.action === "create_folder")
			return new LibraryFolders(this.catalog, this.plans).preview(change);
		const targets = await this.targets(change);
		const before =
			change.action === "rating"
				? (await ratings(this.catalog, change.resource, change.ids)).ratings
				: undefined;
		const effect =
			change.action === "rating"
				? `${change.value === "clear" ? "Clear" : change.value === 1 ? "Like" : "Dislike"} ${targets.length} ${change.resource}`
				: change.action === "favorite"
					? `Favorite ${targets.length} ${change.resource}`
					: `Add ${targets.length} ${change.resource} to your library`;
		return this.plans.create({
			operation: "change",
			source: "catalog",
			name: effect,
			description:
				change.action === "rating"
					? "Affects your music preferences; does not start playback."
					: "Apple returns acceptance before completion and may ignore unavailable IDs. This is not a verified library update.",
			tracks: [],
			expected_ids: [],
			duplicates_removed: 0,
			audit: { duration_minutes: 0, version_qualifiers: [] },
			change,
			targets,
			before_ratings: before,
		});
	}
	async apply(id: string) {
		const existing = this.plans.get(id);
		if (
			existing.payload.operation === "change" &&
			MusicChange.parse(existing.payload.change).action === "create_folder"
		)
			return new LibraryFolders(this.catalog, this.plans).apply(id);
		return this.plans.mutation(async () => {
			const plan = this.plans.get(id);
			if (plan.payload.operation !== "change")
				throw new Error("This is not a music preference/library plan.");
			if (plan.state === "applied" || plan.state === "accepted") return plan;
			if (plan.state !== "ready")
				throw new Error(
					`Plan state is ${plan.state}; inspect it before making another change.`,
				);
			const change = PreferenceChange.parse(plan.payload.change);
			if (!this.catalog.readiness().user_authorized)
				throw new Error("Apple Music authorization is required.");
			await this.catalog.developerToken();
			if (change.action === "rating") {
				const current = (
					await ratings(this.catalog, change.resource, change.ids)
				).ratings;
				if (
					JSON.stringify(current) !==
					JSON.stringify(plan.payload.before_ratings)
				)
					throw new Error("Ratings changed since preview; make a fresh plan.");
			}
			this.plans.claim(id);
			const completed: string[] = [];
			let attempting: string | undefined;
			try {
				if (change.action === "rating") {
					for (const resourceId of change.ids) {
						attempting = resourceId;
						this.plans.finish(id, "applying", {
							completed_ids: [...completed],
							attempting_id: resourceId,
						});
						await this.catalog.request(
							change.value === "clear" ? "DELETE" : "PUT",
							`/v1/me/ratings/${change.resource}/${resourceId}`,
							{
								personal: true,
								...(change.value === "clear"
									? {}
									: {
											body: {
												type: "ratings",
												attributes: { value: change.value },
											},
										}),
							},
						);
						completed.push(resourceId);
					}
					const after = (
							await ratings(this.catalog, change.resource, change.ids)
						).ratings,
						expected = change.value === "clear" ? null : change.value;
					const verified = after.every((r) => r.value === expected);
					this.plans.finish(id, verified ? "applied" : "needs_review", {
						verified,
						ratings: after,
						completed_ids: completed,
						message: verified
							? "Ratings verified by a fresh read."
							: "Apple accepted the writes but ratings did not match readback. Inspect before any further action; do not retry this plan.",
					});
				} else {
					const receipt = await this.catalog.request(
						"POST",
						change.action === "favorite"
							? "/v1/me/favorites"
							: "/v1/me/library",
						{
							personal: true,
							params: { [`ids[${change.resource}]`]: change.ids.join(",") },
						},
					);
					if (receipt.http_status !== 202)
						throw new Error(
							"Apple did not return the expected acceptance receipt.",
						);
					this.plans.finish(id, "accepted", {
						accepted: true,
						verified: false,
						requested_ids: change.ids,
						message:
							"Apple accepted the request. Processing may be delayed and IDs may be ignored; completion is unverified. This plan will not be replayed.",
					});
				}
			} catch {
				this.plans.finish(id, "unknown", {
					completed_ids: completed,
					attempting_id: attempting,
					retry_safe: false,
					message:
						"Change outcome needs inspection. Some writes may have completed; this plan is blocked from automatic retry.",
				});
				throw new Error(
					"Change outcome needs inspection. This plan is blocked from automatic retry.",
				);
			}
			return this.plans.get(id);
		});
	}
}
