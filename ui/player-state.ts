export type PlayerSummary = {
	running: boolean;
	state: string;
	selected_player?: string;
	track?: { name: string; artist: string; album: string } | null;
	media?: { title: string; artist: string; album: string };
};

export function playerPresentation(player: PlayerSummary) {
	const device =
		player.selected_player === "windows"
			? "Apple Music for Windows"
			: player.selected_player === "cider"
				? "Cider"
				: "Music.app";
	if (player.state === "api-only")
		return {
			title: "No playback device",
			subtitle: "Select a local player to enable playback.",
			status: "API-only mode",
		};
	if (player.state === "profile-limited")
		return {
			title: "Playback excluded by this profile",
			subtitle: "Your catalog and playlist tools are separate.",
			status: "Playback unavailable",
		};
	if (player.state === "unavailable")
		return {
			title: "Player unavailable",
			subtitle: device,
			status: "Reconnect the player",
		};
	if (!player.running)
		return {
			title: "No active player",
			subtitle: device,
			status: "Player is closed",
		};
	const name = (player.track?.name || player.media?.title || "").trim();
	const artist = player.track?.artist || player.media?.artist || "";
	const album = player.track?.album || player.media?.album || "";
	const status =
		player.state === "playing"
			? `Playing on ${device}`
			: player.state === "paused"
				? `Paused on ${device}`
				: player.state === "stopped"
					? `Stopped on ${device}`
					: `Player open · ${device}`;
	return {
		title:
			name ||
			(player.state === "playing" || player.state === "paused"
				? "Track details unavailable"
				: "Nothing playing"),
		subtitle:
			[artist, album].filter((value) => value.trim()).join(" · ") ||
			(name ? device : "The player did not return track details."),
		status,
	};
}

export function catalogConnectionLabel(auth: {
	developer_key_configured: boolean;
	user_authorized: boolean;
}) {
	return auth.user_authorized
		? "Catalog and library configured"
		: auth.developer_key_configured
			? "Catalog configured · Library sign-in needed"
			: "Catalog and library not connected";
}
