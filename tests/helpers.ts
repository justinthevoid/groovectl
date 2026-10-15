import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Plans } from "../src/storage.js";
import { AppleCatalog } from "../src/catalog.js";
import { MusicService } from "../src/service.js";
import type {
	NativeBackend,
	Track,
	Playlist,
	PlaybackRequest,
} from "../src/models.js";
export const A = "0000000000000001",
	B = "0000000000000002",
	C = "0000000000000003",
	P = "FFFFFFFFFFFFFFFF";
export function track(id = A, name = "Alive", artist = "Pearl Jam"): Track {
	return {
		source: "native",
		id,
		name,
		artist,
		album: "Ten",
		duration_ms: 180000,
	};
}
export function root() {
	return mkdtempSync(join(tmpdir(), "groovectl-test-"));
}
export class FakeNative implements NativeBackend {
	songs = new Map(
		[
			track(A),
			track(B, "Dreams", "Fleetwood Mac"),
			track(C, "Go Your Own Way", "Fleetwood Mac"),
		].map((t) => [t.id, t]),
	);
	items = new Map<string, Playlist>();
	writes = 0;
	failAfterCreate = false;
	reverseReadback = false;
	async tracks(ids: string[]) {
		return ids.map((id) => {
			const t = this.songs.get(id);
			if (!t) throw new Error("Unknown recording");
			return structuredClone(t);
		});
	}
	async playlist(id: string) {
		const p = this.items.get(id);
		if (!p) throw new Error("Unknown playlist");
		return structuredClone(p);
	}
	async create(
		name: string,
		ids: string[],
		_description = "",
		accepted?: (id: string) => void,
	) {
		this.writes++;
		const p: Playlist = {
			source: "native",
			id: P,
			name,
			tracks: await this.tracks(ids),
			smart: false,
		};
		if (this.reverseReadback) p.tracks.reverse();
		this.items.set(P, p);
		accepted?.(P);
		if (this.failAfterCreate) throw new Error("Timeout after creation");
		return this.playlist(P);
	}
	async append(id: string, ids: string[]) {
		this.writes++;
		const p = this.items.get(id);
		if (!p) throw new Error("Unknown playlist");
		p.tracks.push(...(await this.tracks(ids)));
		return this.playlist(id);
	}
	async playlists() {
		return {
			playlists: [...this.items.values()].map(({ id, name }) => ({ id, name })),
		};
	}
	async search(_query: string, limit: number, offset: number) {
		return {
			total: this.songs.size,
			offset,
			tracks: [...this.songs.values()].slice(offset, offset + limit),
		};
	}
	async status() {
		return { running: false, state: "stopped" };
	}
	async playback(_r: PlaybackRequest) {
		return this.status();
	}
	async deleteOwned(id: string, name: string) {
		const p = this.items.get(id);
		if (p?.name !== name) throw new Error("Name changed");
		this.items.delete(id);
	}
}
export function fixture() {
	const directory = root(),
		native = new FakeNative(),
		plans = new Plans(directory),
		catalog = new AppleCatalog(directory);
	return {
		root: directory,
		native,
		plans,
		music: new MusicService(native, catalog, plans),
	};
}
