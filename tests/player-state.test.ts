import { test } from "node:test";
import assert from "node:assert/strict";
import {
	playerPresentation,
	catalogConnectionLabel,
} from "../ui/player-state.js";

test("Windows playback stays truthful when SMTC returns empty track metadata", () => {
	const player = {
		running: true,
		state: "playing",
		selected_player: "windows",
		track: null,
		media: { title: "", artist: "", album: "" },
	};
	const view = playerPresentation(player);
	assert.equal(view.title, "Track details unavailable");
	assert.equal(view.status, "Playing on Apple Music for Windows");
	assert.ok(!Object.values(view).includes("Nothing playing"));
	assert.equal(player.state, "playing");
	assert.equal(
		catalogConnectionLabel({
			developer_key_configured: false,
			user_authorized: false,
		}),
		"Catalog and library not connected",
	);
	assert.equal(
		playerPresentation({ ...player, state: "paused" }).status,
		"Paused on Apple Music for Windows",
	);
	assert.equal(
		playerPresentation({
			...player,
			media: { title: "Recording", artist: "Artist", album: "Album" },
		}).title,
		"Recording",
	);
});

test("native metadata and disconnected modes remain distinct from missing metadata", () => {
	const native = playerPresentation({
		running: true,
		state: "playing",
		selected_player: "native",
		track: { name: "Recording", artist: "Artist", album: "Album" },
	});
	assert.deepEqual(native, {
		title: "Recording",
		subtitle: "Artist · Album",
		status: "Playing on Music.app",
	});
	assert.equal(
		playerPresentation({ running: false, state: "stopped", selected_player: "cider" }).title,
		"No active player",
	);
	for (const [state, title] of [
		["unavailable", "Player unavailable"],
		["api-only", "No playback device"],
		["profile-limited", "Playback excluded by this profile"],
	])
		assert.equal(playerPresentation({ running: false, state }).title, title);
	assert.equal(
		catalogConnectionLabel({ developer_key_configured: true, user_authorized: false }),
		"Catalog configured · Library sign-in needed",
	);
	assert.equal(
		catalogConnectionLabel({ developer_key_configured: true, user_authorized: true }),
		"Catalog and library configured",
	);
});
