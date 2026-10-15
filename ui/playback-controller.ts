import { z } from "zod";
import type { ToolCall } from "./collection-controller.js";

const PlayerCapabilities = z.object({ available: z.boolean(), actions: z.array(z.string()) });
const PlayerId = z.enum(["native", "windows", "cider"]);
export const Player = z.object({
	running: z.boolean(), state: z.string(), selected_player: z.string().optional(),
	execution_platform: z.string().optional(),
	available_players: z.array(z.object({ id: PlayerId, label: z.string(), configured: z.boolean() })).optional(),
	position: z.number().nonnegative().optional(), volume: z.number().min(0).max(100).optional(),
	shuffle: z.boolean().optional(), repeat: z.enum(["off", "one", "all"]).optional(),
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
export type PlayerState = { player: Player; pending: boolean; refreshing: boolean; needsRefresh: boolean; error?: string; observedAt?: number };
export class PlaybackController {
	private state: PlayerState = { player: { running: false, state: "unavailable", capabilities: undefined }, pending: false, refreshing: false, needsRefresh: false };
	private listeners = new Set<(state: PlayerState) => void>();
	private generation = 0;
	private target?: z.infer<typeof PlayerId>;
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
		if (player.state === "profile-limited" || player.state === "api-only" || player.available_players?.length === 0) this.target = undefined;
		else if (this.target && player.selected_player !== this.target) return;
		this.generation++;
		this.update({ player, refreshing: false, error: player.error, needsRefresh: !!player.error, observedAt: Date.now() });
	}
	async refresh() {
		if (this.state.pending || this.state.refreshing) return;
		const generation = ++this.generation;
		this.update({ refreshing: true });
		try {
			const player = Player.parse(await this.call("get_playback_state", this.target ? { player: this.target } : undefined));
			if (this.target && player.selected_player !== this.target) throw new Error("The playback host returned a different player. Refresh to reconnect.");
			if (generation === this.generation) this.update({ player, error: player.error, needsRefresh: !!player.error, observedAt: Date.now() });
		} catch (error) {
			if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : "Player read failed. Refresh to reconnect." });
		} finally { if (generation === this.generation) this.update({ refreshing: false }); }
	}
	async selectPlayer(value: string) {
		if (this.state.pending) return;
		const target = PlayerId.parse(value);
		if (!this.state.player.available_players?.some(p => p.id === target && p.configured)) return;
		const { execution_platform, available_players } = this.state.player;
		this.target = target;
		this.generation++;
		this.update({ player: { running: false, state: "unavailable", selected_player: target, execution_platform, available_players, capabilities: undefined }, refreshing: false, needsRefresh: true, error: undefined });
		await this.refresh();
	}
	queue() {
		return this.call("get_playback_queue", this.target ? { player: this.target } : undefined);
	}
	async command(action: string, value?: number, track_id?: string) {
		if (this.state.pending || this.state.needsRefresh) return;
		if (!this.state.player.capabilities?.available || !this.state.player.capabilities.actions.includes(action)) { this.update({ error: "This command is unavailable on the current player." }); return; }
		const generation = ++this.generation;
		this.update({ pending: true, refreshing: false, error: undefined });
		try {
			// Each adapter returns its observed state after the command. Do not repeat
			// that read or replay the command if its response is lost or malformed.
			const player = Player.parse(await this.call("control_playback", { action, ...(this.target ? { player: this.target } : {}), ...(value === undefined ? {} : { value }), ...(track_id ? { track_id } : {}) }));
			if (this.target && player.selected_player !== this.target) throw new Error("The playback host returned a different player.");
			if (generation === this.generation) this.observe(player);
		} catch (error) {
			if (generation === this.generation) this.update({ needsRefresh: true, error: `${error instanceof Error ? error.message : "Player command failed."} Refresh the player to inspect its state before trying again.` });
		} finally { this.update({ pending: false }); }
	}
}
