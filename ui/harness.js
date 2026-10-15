// Development MCP Apps host. All music/account data and mutations are synthetic.
import {
	AppBridge,
	PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { VERSION } from "../src/version.ts";
import { summarizePlan, summarizeDraft } from "../src/workspace-models.ts";
const iframe = document.querySelector("iframe");
const id = "11111111-1111-4111-8111-111111111111",
	artId = "22222222-2222-4222-8222-222222222222";
const songs = [
	{
		source: "catalog",
		id: "101",
		name: "A House in the Trees",
		artist: "Mara Vale",
		album: "Afternoon Light",
		duration_ms: 220000,
	},
	{
		source: "catalog",
		id: "102",
		name: "The Long Way Around",
		artist: "Soft Weather",
		album: "Open Windows",
		duration_ms: 247000,
	},
	{
		source: "catalog",
		id: "103",
		name: "Honey / Blue",
		artist: "June Satellite",
		album: "Field Notes",
		duration_ms: 198000,
	},
];
const catalogSongs = [
	...songs,
	{
		source: "catalog",
		id: "104",
		name: "Still a Little Light",
		artist: "Evening Paper",
		album: "Side Streets",
		duration_ms: 213000,
	},
];
const story = {
	recipe: "side-a-side-b",
	chapters: [
		{
			title: "Side A — arrival",
			purpose: "Warm textures and an easy invitation",
			start: 1,
			end: 2,
			ordering: "flexible",
		},
		{ title: "Side B — open windows", start: 3, end: 3, ordering: "preserve" },
	],
	anchors: [{ track: { source: "catalog", id: "101" }, position: 1 }],
	runtime_budget_minutes: 12,
	runtime_tolerance_minutes: 2,
};
const state = {
	player: {
		running: true,
		state: "paused",
		volume: 30,
		selected_player: "cider",
 position: 42,
 capabilities: { available: true, actions: ["play", "pause", "previous", "next", "volume", "seek"] },
		track: {
			duration_ms: 220000,
 name: "A House in the Trees",
			artist: "Mara Vale",
			album: "Afternoon Light",
		},
	},
	auth: { developer_key_configured: true, user_authorized: true },
	plans: [
		{
			plan_id: "fixture-plan",
			state: "ready",
			payload: {
				name: "Open Windows",
				operation: "create",
				tracks: songs,
				story,
				audit: { duration_minutes: 11.1, version_qualifiers: [] },
			},
		},
	],
	studio: {
		drafts: [
			{
				draft_id: id,
				mode: "quick",
				brief: {
					title: "Open Windows",
					intent:
						"An unhurried afternoon. Warm textures, easy momentum, and a little room to breathe.",
					context: "An afternoon at home",
					duration_minutes: 12,
					anchors: ["Warm, spacious indie soul"],
					exclude: [],
					discovery: "balanced",
					explicit: "avoid",
					arc: "three-act",
					cover_direction:
						"Sunlit linen, an open window, olive and warm cream.",
				},
			},
		],
		artwork: [],
		provider: { enabled: true },
	},
};
state.studio.provider = {
	enabled: true,
	provider: "codex-cli",
	providers: [
		{
			provider: "codex-cli",
			enabled: true,
			remaining_local: 5,
			local_daily_limit: 5,
			cooldown_until: null,
		},
		{
			provider: "agy-cli",
			enabled: true,
			remaining_local: 2,
			local_daily_limit: 3,
			cooldown_until: null,
		},
		{
			provider: "openai",
			enabled: false,
			remaining_local: 5,
			local_daily_limit: 5,
			cooldown_until: null,
		},
	],
};
const parameters = new URLSearchParams(location.search);
if (parameters.get("mode") === "api-only") {
	state.player = {
		running: false,
		state: "api-only",
		selected_player: "none",
		capabilities: { available: false, actions: [] },
	};
}
if (parameters.get("profile") === "catalog") {
	state.tool_profile = "catalog";
	state.available_tools = [
		"open_music",
		"get_music_workspace",
		"get_capabilities",
		"get_playlist_studio",
		"search_catalog",
		"browse_api_library",
		"get_playlist",
	];
	state.player = {
		running: false,
		state: "profile-limited",
		selected_player: "native",
		capabilities: { available: false, actions: [] },
	};
}
if (parameters.get("profile") === "curator") {
 state.tool_profile = "curator";
 state.available_tools = ["open_music", "get_music_workspace", "get_playlist_studio", "browse_api_library", "get_playlist", "search_catalog", "save_listening_brief", "inspect_playlist_plan"];
 state.player = { running:false, state:"profile-limited", selected_player:"cider", capabilities:{available:false,actions:[]} };
}
if (parameters.get("player") === "windows-empty") {
	state.player = {
		running: true,
		state: "playing",
		selected_player: "windows",
		track: null,
		media: { title: "", artist: "", album: "" },
		capabilities: { available: true, actions: ["pause", "stop"] },
	};
}
if (parameters.get("auth") === "missing")
	state.auth = { developer_key_configured: false, user_authorized: false };
const bridge = new AppBridge(
	null,
	{ name: "Groovectl synthetic host", version: VERSION },
	{ serverTools: {}, logging: {} },
	{
		hostContext: {
			theme:
				new URLSearchParams(location.search).get("theme") === "dark"
					? "dark"
					: "light",
			displayMode: "fullscreen",
		},
	},
);
state.plans.push({
	plan_id: "fixture-change",
	state: "ready",
	payload: {
		name: "Favorite 1 albums",
		description:
			"Apple acceptance may be delayed; completion remains unverified.",
		operation: "change",
		tracks: [],
		targets: [
			{ id: "fixture-album", name: "Afternoon Light", artist: "Mara Vale" },
		],
		audit: { duration_minutes: 0, version_qualifiers: [] },
	},
});
for (const plan of state.plans) {
	plan.expires_at = Date.now() / 1000 + 7200;
	plan.payload.source = "catalog";
}
for (const draft of state.studio.drafts)
	draft.updated_at = new Date().toISOString();
const workspace = () => ({
	...state,
	plans: state.plans
		.filter((p) => !["cancelled", "deleted"].includes(p.state))
		.map(summarizePlan),
	studio: { ...state.studio, drafts: state.studio.drafts.map(summarizeDraft) },
});
const callHistory = [];
bridge.oncalltool = async ({ name, arguments: args }) => {
	callHistory.push({ name, arguments: args });
	document.querySelector("#calls").dataset.history = JSON.stringify(callHistory);
	document.querySelector("#calls").textContent =
		`${name} ${JSON.stringify(args)}`;
	let result = state,
		meta;
	if (name === "get_playback_state") { result = state.player;
 } else if (name === "get_playback_queue") { result = { player: "cider", tracks: songs, truncated: false };
 } else if (name === "browse_api_library") {
  if (parameters.get("collection") === "error") return { isError:true, content:[{type:"text", text:"Synthetic library read failed. Refresh to try again."}] };
  if (parameters.get("collection") === "slow") await new Promise(resolve => setTimeout(resolve, 2500));
  const names = ["Open Windows", "Between Stations", "An Evening, Unhurried", "Small Hours", "Field Notes", "The Scenic Route", "風の中の手紙", "Sunday, Elsewhere"];
  result = { data: parameters.get("collection") === "empty" ? [] : args.type === "songs" ? songs.map(t => ({ id: `i.${t.id}`, type:"library-songs", attributes:{name:t.name, artistName:t.artist, albumName:t.album, durationInMillis:t.duration_ms, playParams:{catalogId:t.id}} })) : names.map((name,i) => ({id:`p.fixture${i}`, type:`library-${args.type === "recently-added" ? "playlists" : args.type}`, attributes:{name, artistName:i % 3 === 0 ? "Mara Vale" : ""} })), ...(args.offset === 0 && parameters.get("collection") === "pages" ? {next:"/v1/me/library/playlists?offset=100"} : {}) };
 } else if (name === "list_playlists") { result = { playlists: [{id:"0123456789ABCDEF",name:"Local fixture"}] };
 } else if (name === "get_playlist") { result = { id:args.playlist_id, name:"Open Windows", source:args.source, tracks:songs };
 } else if (name === "inspect_playlist_plan") {
		result = state.plans.find((p) => p.plan_id === args.plan_id);
	} else if (name === "get_playlist_studio") {
		if (parameters.has("slow-draft"))
			await new Promise((resolve) => setTimeout(resolve, 5000));
		result = {
			...workspace().studio,
			...(args.draft_id
				? {
						draft: state.studio.drafts.find(
							(d) => d.draft_id === args.draft_id,
						),
					}
				: {}),
		};
	} else if (name === "control_playback") {
		if (args.action === "volume") state.player.volume = args.value;
 else if (args.action === "seek") state.player.position = args.value;
		else if (args.action === "play") state.player.state = "playing";
		else if (args.action === "pause") state.player.state = "paused";
		result = state.player;
	} else if (name === "apply_music_change")
		state.plans.find((p) => p.plan_id === args.plan_id).state = "accepted";
	else if (name === "apply_playlist_plan") {
		const plan = state.plans.find((p) => p.plan_id === args.plan_id);
		plan.state = "applied";
		plan.result = {
			verified: true,
			playlist: {
				id: "fixture-created",
				name: plan.payload.name,
				tracks: plan.payload.tracks,
			},
		};
	} else if (name === "cancel_playlist_plan")
		state.plans.find((p) => p.plan_id === args.plan_id).state = "cancelled";
	else if (name === "save_listening_brief") {
		const brief =
			args.mode === "surprise"
				? {
						...state.studio.drafts[0].brief,
						title: "The Long Way Home",
						intent:
							"A scenic detour with familiar warmth and unexpected turns.",
					}
				: { ...state.studio.drafts[0].brief, ...args.brief };
		const draft = {
			draft_id: args.draft_id || id,
			updated_at: new Date().toISOString(),
			mode: args.mode,
			brief,
			locked: args.locked ?? [],
			suggestions: args.suggestions ?? state.studio.drafts[0].suggestions ?? {},
		};
		state.studio.drafts = [draft];
		result = {
			...draft,
			interview: {
				questions: brief.context
					? []
					: [{ question: "Where will this soundtrack live?" }],
			},
		};
	} else if (name === "search_catalog") {
		if (args.query === "error")
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: "Synthetic search failure. Your brief is preserved.",
					},
				],
			};
		result = {
			songs:
				args.query === "empty"
					? []
					: args.query === "new"
						? catalogSongs
						: songs,
		};
	} else if (name === "preview_playlist") {
		result = {
			plan_id: "fixture-new-plan",
			expires_at: Date.now() / 1000 + 7200,
			state: "ready",
			payload: {
				source: "catalog",
				name: args.name,
				operation: "create",
				tracks: args.tracks.map((t) => catalogSongs.find((s) => s.id === t.id)),
				...(args.story ? { story: args.story } : {}),
				audit: {
					duration_minutes:
						Math.round(
							args.tracks.reduce(
								(sum, t) =>
									sum + catalogSongs.find((s) => s.id === t.id).duration_ms,
								0,
							) / 6000,
						) / 10,
					version_qualifiers: [],
				},
			},
		};
		state.plans.unshift(result);
	} else if (name === "sequence_playlist") {
		result = {
			tracks: args.tracks.map((t) => catalogSongs.find((s) => s.id === t.id)),
			story: args.story,
			artist_spacing_conflicts: [],
		};
	} else if (name === "generate_playlist_artwork") {
		result = {
			artwork_id: artId,
			draft_id: args.draft_id,
			request_id: args.request_id,
			state: "running",
		};
		state.studio.artwork = [result];
	} else if (name === "get_playlist_artwork") {
		result = { artwork_id: artId, state: "complete" };
		const response = await fetch("./cover.png");
		const blob = await response.blob();
		const data = await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.readAsDataURL(blob);
		});
		meta = { artwork: data };
	} else if (name === "browse_api_library")
		result = {
			data: [
				{ id: "fixture-library", attributes: { name: "Sunday favorites" } },
			],
		};
	else if (name !== "get_music_workspace")
		throw new Error("Unexpected synthetic tool");
	if (result === state) result = workspace();
	return {
		content: [{ type: "text", text: JSON.stringify(result) }],
		structuredContent: result,
		...(meta ? { _meta: meta } : {}),
	};
};
bridge.onmessage = async ({ content }) => {
	const request = content.find((c) => c.type === "text")?.text ?? "";
	const match = request.match(/choices for (\w+)/);
	if (match) {
		state.studio.drafts[0].suggestions = {
			[match[1]]: [
				{
					label: "Fresh from your agent",
					value:
						match[1] === "arc"
							? "steady"
							: match[1] === "duration_minutes"
								? 45
								: match[1] === "anchors" || match[1] === "exclude"
									? ["An agent suggestion"]
									: "A fresh idea shaped by your brief",
				},
			],
		};
		state.studio.drafts[0].updated_at = new Date().toISOString();
	}
	document.querySelector("#calls").textContent = "User clicked Ask my agent";
	return {};
};
bridge.oninitialized = async () => {
	document.querySelector("#connection").textContent =
		"MCP Apps handshake complete";
	await bridge.sendToolInput({ arguments: {} });
	await bridge.sendToolResult({
		content: [{ type: "text", text: "Synthetic workspace fixture" }],
		structuredContent: workspace(),
	});
};
await bridge.connect(
	new PostMessageTransport(iframe.contentWindow, iframe.contentWindow),
);
iframe.src = "./index.html";
