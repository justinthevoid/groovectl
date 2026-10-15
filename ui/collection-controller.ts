import { z } from "zod";
import { collectionPage, resourceItem, Recording, recordingKey, type Category, type CollectionItem, type LibrarySource } from "./music-model.js";

export type ToolCall = (name: string, args?: Record<string, unknown>) => Promise<unknown>;
export type CollectionDetail = {
	item: CollectionItem; tracks: Recording[]; children: CollectionItem[];
	loading: boolean; error?: string; nextPage?: string; parents: CollectionItem[];
};
export type CollectionState = {
	source: LibrarySource; category: Category; items: CollectionItem[];
	loading: boolean; error?: string; hasMore: boolean; offset: number;
	detail?: CollectionDetail;
	selected: Recording[];
};
export class CollectionController {
	private state: CollectionState = { source: "catalog", category: "playlists", items: [], loading: false, hasMore: false, offset: 0, selected: [] };
	private listeners = new Set<(state: CollectionState) => void>();
	private generation = 0;
	private detailGeneration = 0;
	private history: CollectionDetail[] = [];
	subscribe = (listener: (state: CollectionState) => void) => {
		this.listeners.add(listener); listener(this.state);
		return () => { this.listeners.delete(listener); };
	};
	constructor(private call: ToolCall) {}
	private update(change: Partial<CollectionState>) {
		this.state = { ...this.state, ...change };
		for (const listener of this.listeners) listener(this.state);
	}
	async load(category = this.state.category, source = this.state.source, more = false) {
		if (more && (this.state.loading || !this.state.hasMore)) return;
		const generation = ++this.generation;
		this.detailGeneration++;
		this.history = [];
		const offset = more ? this.state.offset + 100 : 0;
		this.update({ category, source, loading: true, error: undefined, detail: undefined,
			...(more ? {} : { items: [], hasMore: false, offset: 0 }) });
		try {
			const result = source === "native"
				? await this.call("list_playlists", { source: "native", offset: 0 })
				: await this.call("browse_api_library", { type: category, offset });
			const page = collectionPage(result, source);
			if (generation !== this.generation) return;
			const items = more ? [...this.state.items, ...page.items] : page.items;
			const unique = [...new Map(items.map(item => [`${item.source}:${item.id}`, item])).values()];
			this.update({ items: unique.slice(0, 1000), offset, hasMore: page.hasMore && unique.length < 1000, loading: false });
		} catch (error) {
			if (generation === this.generation) this.update({ loading: false, error: error instanceof Error ? error.message : "Collection read failed. Try refresh." });
		}
	}
	async open(item: CollectionItem, nested = false) {
		if (nested && this.state.detail) this.history.push({ ...this.state.detail, loading: false });
		else this.history = [];
		this.detailGeneration++;
		const detail: CollectionDetail = { item, tracks: item.recording ? [item.recording] : [], children: [],
			parents: this.history.map(d => d.item), loading: !item.recording };
		this.update({ detail });
		if (item.recording) return;
		await this.fetchDetail(detail);
	}
	private async readDetail(detail: CollectionDetail, page?: string): Promise<CollectionDetail> {
		const item = detail.item;
		if (item.kind.endsWith("playlists")) {
			const playlist = z.object({ tracks: z.array(Recording).max(2000) }).parse(await this.call("get_playlist", {
				source: item.source === "native" ? "native" : "catalog", playlist_id: item.id,
			}));
			return { ...detail, tracks: playlist.tracks, loading: false };
		}
		if (item.source !== "library-api" || !["library-albums", "library-artists"].includes(item.kind))
			throw new Error("This library resource has no supported detail view. Browse Songs, Albums, Artists or Playlists.");
		const result = z.object({ items: z.array(z.unknown()).max(100), next_page: z.string().nullable() }).parse(
			await this.call("inspect_api_library", { type: item.kind === "library-albums" ? "albums" : "artists", id: item.id, ...(page ? { page } : {}) }));
		const items = result.items.map(resourceItem);
		if (items.some(child => child.kind !== (item.kind === "library-albums" ? "library-songs" : "library-albums")))
			throw new Error("Unexpected library detail resource type.");
		const tracks = [...(page ? detail.tracks : []), ...items.flatMap(i => i.recording ? [i.recording] : [])];
		const children = [...(page ? detail.children : []), ...items.filter(i => !i.recording)];
		return { ...detail, tracks: [...new Map(tracks.map(t => [recordingKey(t), t])).values()],
			children: [...new Map(children.map(c => [`${c.kind}:${c.id}`, c])).values()],
			nextPage: result.next_page ?? undefined, loading: false, error: undefined };
	}
	async moreDetail() {
		const detail = this.state.detail;
		if (!detail?.nextPage || detail.loading || detail.tracks.length + detail.children.length >= 1000) return;
		await this.fetchDetail(detail, detail.nextPage);
	}
	async retryDetail() {
		const detail = this.state.detail;
		if (!detail || detail.loading) return;
		await this.fetchDetail(detail, detail.nextPage);
	}
	private async fetchDetail(detail: CollectionDetail, page?: string) {
		const generation = ++this.detailGeneration;
		this.update({ detail: { ...detail, loading: true, error: undefined } });
		try {
			const result = await this.readDetail(detail, page);
			if (generation === this.detailGeneration) this.update({ detail: result });
		} catch (error) {
			if (generation === this.detailGeneration) this.update({ detail: { ...detail, loading: false,
				error: error instanceof Error ? error.message : "Collection detail read failed. Try again." } });
		}
	}
	back() { this.detailGeneration++; this.update({ detail: this.history.pop() }); }
	close() { this.detailGeneration++; this.history = []; this.update({ detail: undefined }); }
	toggle(track: Recording) {
		const key = recordingKey(track), exists = this.state.selected.some(t => recordingKey(t) === key);
		if (!exists && this.state.selected.length >= 200) throw new Error("Studio accepts at most 200 selected recordings.");
		this.update({ selected: exists ? this.state.selected.filter(t => recordingKey(t) !== key) : [...this.state.selected, track] });
	}
	clear() { this.update({ selected: [] }); }
}
