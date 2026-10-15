import { z } from "zod";
import type { ToolCall } from "./collection-controller.js";

const PlayerCapabilities = z.object({ available: z.boolean(), actions: z.array(z.string()) });
export const Player = z.object({
	running: z.boolean(), state: z.string(), selected_player: z.string().optional(),
	position: z.number().nonnegative().optional(), volume: z.number().min(0).max(100).optional(),
	track: z.object({ name: z.string(), artist: z.string(), album: z.string().default(""), duration_ms: z.number().nonnegative().optional() }).nullish(),
	media: z.object({ title: z.string(), artist: z.string(), album: z.string() }).optional(),
	capabilities: z.unknown().optional(),
	player_capabilities: PlayerCapabilities.optional(),
	error: z.string().optional(),
}).transform(value => {
	const capabilities = PlayerCapabilities.safeParse(value.capabilities);
	return { ...value, capabilities: value.player_capabilities ?? (capabilities.success ? capabilities.data : undefined) };
});
export type Player = z.infer<typeof Player>;
export type PlayerState = { player: Player; pending: boolean; refreshing: boolean; error?: string; observedAt?: number };
export class PlaybackController {
	private state: PlayerState = { player: { running: false, state: "unavailable", capabilities: undefined }, pending: false, refreshing: false };
	private listeners = new Set<(state: PlayerState) => void>();
	private generation = 0;
	subscribe = (listener: (state: PlayerState) => void) => {
		this.listeners.add(listener); listener(this.state);
		return () => { this.listeners.delete(listener); };
	};
	constructor(private call: ToolCall) {}
	private update(change: Partial<PlayerState>) {
		this.state = { ...this.state, ...change };
		for (const listener of this.listeners) listener(this.state);
	}
	observe(value: unknown) {
		const player = Player.parse(value);
		this.generation++;
		this.update({ player, error: player.error, observedAt: Date.now() });
	}
	async refresh() {
		if (this.state.pending || this.state.refreshing) return;
		const generation = ++this.generation;
		this.update({ refreshing: true });
		try {
			const player = Player.parse(await this.call("get_playback_state"));
			if (generation === this.generation) this.update({ player, error: player.error, observedAt: Date.now() });
		} catch (error) {
			if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : "Player read failed. Refresh to reconnect." });
		} finally { this.update({ refreshing: false }); }
	}
	async command(action: string, value?: number, track_id?: string) {
		if (this.state.pending) return;
		if (!this.state.player.capabilities?.actions.includes(action)) { this.update({ error: "This command is unavailable on the current player." }); return; }
		this.generation++;
		this.update({ pending: true, error: undefined });
		try {
			// Each adapter returns its observed state after the command. Do not repeat
			// that read or replay the command if its response is lost or malformed.
			const player = Player.parse(await this.call("control_playback", { action, ...(value === undefined ? {} : { value }), ...(track_id ? { track_id } : {}) }));
			this.observe(player);
		} catch (error) {
			this.update({ error: `${error instanceof Error ? error.message : "Player command failed."} Refresh the player to inspect its state before trying again.` });
		} finally { this.update({ pending: false }); }
	}
}
