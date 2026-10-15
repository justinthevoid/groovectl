import { z } from "zod";
import type { AppleCatalog, Resource } from "./catalog.js";
import { apiId, AppleResourceId } from "./models.js";
import type { Plans } from "./storage.js";

export const FolderChange = z
	.object({
		action: z.literal("create_folder"),
		name: z.string().trim().min(1).max(120),
		parent_folder_id: AppleResourceId.optional(),
	})
	.strict();
export type FolderChange = z.infer<typeof FolderChange>;
const descriptor = (item: Resource) => {
	if (item.type !== "library-playlist-folders")
		throw new Error("Apple did not return a library playlist folder.");
	return {
		id: apiId(item.id),
		type: item.type,
		name: item.attributes.name ?? "",
	};
};

/** Fixed folder endpoints, with the same durable mutation journal as playlist writes. */
export class LibraryFolders {
	constructor(
		readonly catalog: AppleCatalog,
		readonly plans: Plans,
	) {}
	async get(id: string) {
		const result = await this.catalog.request(
			"GET",
			`/v1/me/library/playlist-folders/${apiId(id)}`,
			{ personal: true },
		);
		const item = result.data?.find((item) => item.id === id);
		if (!item)
			throw new Error("Library playlist folder was not returned by Apple.");
		return descriptor(item);
	}
	async root() {
		const result = await this.catalog.request(
			"GET",
			"/v1/me/library/playlist-folders",
			{ personal: true, params: { "filter[identity]": "playlistsroot" } },
		);
		// Apple may return the root identity only in meta.filters while data is empty.
		const mapping = z
			.object({
				filters: z.object({
					identity: z.object({
						playlistsroot: z.array(
							z.object({ id: z.string(), type: z.string() }),
						),
					}),
				}),
			})
			.safeParse(result.meta);
		const item =
			result.data?.find((item) => item.type === "library-playlist-folders") ??
			(mapping.success
				? mapping.data.filters.identity.playlistsroot.find(
						(item) => item.type === "library-playlist-folders",
					)
				: undefined);
		if (!item) return null;
		return this.get(item.id);
	}
	private page(path: string, page?: string) {
		if (!page) return { limit: "100" };
		const url = new URL(page, "https://api.music.apple.com");
		if (
			url.origin !== "https://api.music.apple.com" ||
			url.pathname !== path ||
			url.username ||
			url.password ||
			url.hash ||
			[...url.searchParams.keys()].some(
				(key) => !["limit", "offset", "cursor"].includes(key),
			) ||
			url.searchParams.toString().length > 2048
		)
			throw new Error("Unexpected Apple folder pagination URL.");
		const limit = url.searchParams.get("limit");
		const offset = url.searchParams.get("offset");
		if (
			(limit !== null && !/^(?:[1-9]|[1-9]\d|100)$/.test(limit)) ||
			(offset !== null && !/^\d{1,9}$/.test(offset))
		)
			throw new Error("Invalid folder pagination bounds.");
		return Object.fromEntries(url.searchParams);
	}
	async browse(input: {
		folder_id?: string;
		view?: "folder" | "children" | "parent";
		page?: string;
	}) {
		const folder = input.folder_id
			? await this.get(apiId(input.folder_id))
			: await this.root();
		const view = input.view ?? "children";
		if (!folder)
			return {
				folder: null,
				view,
				items: [],
				next_page: null,
				complete: false,
				availability: "root_not_returned",
				message:
					"Apple did not expose a root playlist folder for this account. No folder content can be inferred.",
			};
		if (view === "folder") {
			if (input.page)
				throw new Error("A folder detail read has no page cursor.");
			return { folder };
		}
		const path = `/v1/me/library/playlist-folders/${folder.id}/${view}`;
		const result = await this.catalog.request("GET", path, {
			personal: true,
			params: this.page(path, input.page),
		});
		if (result.next) this.page(path, result.next);
		return {
			folder,
			view,
			items: result.data ?? [],
			next_page: result.next ?? null,
			complete: !result.next,
		};
	}
	async contains(folderId: string, childId: string) {
		const path = `/v1/me/library/playlist-folders/${apiId(folderId)}/children`;
		let page: string | undefined;
		const seen = new Set<string>();
		for (let count = 0; count < 20; count++) {
			const result = await this.catalog.request("GET", path, {
				personal: true,
				params: this.page(path, page),
			});
			if (
				result.data?.some(
					(item) => item.id === childId && item.type === "library-playlists",
				)
			)
				return true;
			if (!result.next) return false;
			this.page(path, result.next);
			if (seen.has(result.next))
				throw new Error("Apple repeated a folder pagination URL.");
			seen.add(result.next);
			page = result.next;
		}
		return false; // Bounded inspection, never a claim that an omitted item does not exist.
	}
	async preview(input: FolderChange) {
		const change = FolderChange.parse(input);
		const parent = change.parent_folder_id
			? await this.get(change.parent_folder_id)
			: await this.root();
		if (!parent)
			throw new Error(
				"Apple did not expose a root playlist folder. Supply an existing parent_folder_id from your library before planning folder creation.",
			);
		return this.plans.create({
			operation: "change",
			source: "catalog",
			name: `Create folder “${change.name}” in “${parent.name || "Playlists"}”`,
			description:
				"Creates one library playlist folder. No general move or delete operation is exposed; inspect the parent and name before applying.",
			tracks: [],
			expected_ids: [],
			duplicates_removed: 0,
			audit: { duration_minutes: 0, version_qualifiers: [] },
			change: { ...change, parent_folder_id: parent.id },
			parent_folder: parent,
		});
	}
	async apply(id: string) {
		return this.plans.mutation(async () => {
			const plan = this.plans.get(id);
			if (plan.payload.operation !== "change")
				throw new Error("This is not a folder creation plan.");
			const change = FolderChange.parse(plan.payload.change);
			if (plan.state === "applied") return plan;
			if (plan.state !== "ready")
				throw new Error(
					`Plan state is ${plan.state}; inspect before another change.`,
				);
			const parent = await this.get(change.parent_folder_id!);
			if (JSON.stringify(parent) !== JSON.stringify(plan.payload.parent_folder))
				throw new Error(
					"Parent folder changed since preview; make a fresh plan.",
				);
			if (!this.catalog.readiness().user_authorized)
				throw new Error("Apple Music authorization is required.");
			await this.catalog.developerToken();
			this.plans.claim(id);
			let acceptedId: string | undefined;
			try {
				const result = await this.catalog.request(
					"POST",
					"/v1/me/library/playlist-folders",
					{
						personal: true,
						body: {
							attributes: { name: change.name },
							relationships: {
								parent: {
									data: [{ id: parent.id, type: "library-playlist-folders" }],
								},
							},
						},
					},
				);
				const created = result.data?.[0];
				if (!created) throw new Error("Apple returned no created folder ID.");
				// Persist identity before parsing metadata or performing any potentially delayed read.
				acceptedId = apiId(created.id);
				this.plans.finish(id, "applying", { accepted_folder_id: acceptedId });
				const folder = await this.get(acceptedId);
				const parents = await this.catalog.request(
					"GET",
					`/v1/me/library/playlist-folders/${acceptedId}/parent`,
					{ personal: true },
				);
				const verified =
					folder.name === change.name &&
					parents.data?.length === 1 &&
					parents.data[0]?.type === "library-playlist-folders" &&
					parents.data[0]?.id === parent.id;
				this.plans.finish(id, verified ? "applied" : "needs_review", {
					folder,
					accepted_folder_id: acceptedId,
					verified: !!verified,
					message: verified
						? "Folder name and parent verified."
						: "Apple accepted creation but name or parent did not match readback. Inspect; do not retry.",
				});
			} catch {
				this.plans.finish(id, "unknown", {
					accepted_folder_id: acceptedId,
					retry_safe: false,
					message:
						"Folder creation outcome needs inspection. This plan is blocked from automatic retry.",
				});
				throw new Error(
					"Folder creation outcome needs inspection. This plan is blocked from automatic retry.",
				);
			}
			return this.plans.get(id);
		});
	}
}
