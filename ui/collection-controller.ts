import { z } from "zod";
import { collectionPage, Recording, recordingKey, type Category, type CollectionItem, type LibrarySource } from "./music-model.js";

export type ToolCall = (name: string, args?: Record<string, unknown>) => Promise<unknown>;
export type CollectionState = {
	source: LibrarySource; category: Category; items: CollectionItem[];
	loading: boolean; error?: string; hasMore: boolean; offset: number;
	detail?: { item: CollectionItem; tracks: Recording[]; loading: boolean; error?: string };
	selected: Recording[];
};
export class CollectionController {
	private state: CollectionState = { source: "catalog", category: "playlists", items: [], loading: false, hasMore: false, offset: 0, selected: [] };
	private listeners = new Set<(state: CollectionState) => void>();
	private generation = 0;
	private detailGeneration = 0;
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
	async open(item: CollectionItem) {
		const generation = ++this.detailGeneration;
		this.update({ detail: { item, tracks: item.recording ? [item.recording] : [], loading: !item.recording } });
		if (item.recording) return;
		if (!item.kind.endsWith("playlists")) {
			this.update({ detail: { item, tracks: [], loading: false, error: "Details for this library resource are not available in this version. Browse Songs or open a playlist to choose exact recordings." } });
			return;
		}
		try {
			const playlist = z.object({ tracks: z.array(Recording).max(2000) }).parse(await this.call("get_playlist", {
				source: item.source === "native" ? "native" : "catalog", playlist_id: item.id,
			}));
			if (generation === this.detailGeneration) this.update({ detail: { item, tracks: playlist.tracks, loading: false } });
		} catch (error) {
			if (generation === this.detailGeneration) this.update({ detail: { item, tracks: [], loading: false,
				error: error instanceof Error ? error.message : "Playlist read failed." } });
		}
	}
	close() { this.detailGeneration++; this.update({ detail: undefined }); }
	toggle(track: Recording) {
		const key = recordingKey(track), exists = this.state.selected.some(t => recordingKey(t) === key);
		if (!exists && this.state.selected.length >= 200) throw new Error("Studio accepts at most 200 selected recordings.");
		this.update({ selected: exists ? this.state.selected.filter(t => recordingKey(t) !== key) : [...this.state.selected, track] });
	}
	clear() { this.update({ selected: [] }); }
}
