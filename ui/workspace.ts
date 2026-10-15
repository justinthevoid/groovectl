import {
	App,
	applyDocumentTheme,
	applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";
import { z } from "zod";
import { ListeningStory } from "../src/listening-story.js";
import { VERSION } from "../src/version.js";
import { PlanSummary, DraftSummary } from "../src/workspace-models.js";
import {
	InterviewField,
	questionOptions,
	creativeFields,
	type Choice,
	type Suggestions,
} from "../src/interview.js";
const app = new App({ name: "Groovectl", version: VERSION });
new OpenAIExtensions(app);
const Song = z.object({
	source: z.enum(["catalog", "native", "library-api"]).default("catalog"),
	id: z.string(),
	name: z.string(),
	artist: z.string(),
	album: z.string().default(""),
	duration_ms: z.number().default(0),
});
type Song = z.infer<typeof Song>;
const Plan = z.object({
	plan_id: z.string(),
	state: z.string(),
	result: z.record(z.string(), z.unknown()).nullish(),
	payload: z.object({
		name: z.string(),
		operation: z.string(),
		tracks: z.array(Song),
		targets: z
			.array(
				z.object({
					id: z.string(),
					name: z.string(),
					artist: z.string().optional(),
				}),
			)
			.optional(),
		description: z.string().optional(),
		story: ListeningStory.optional(),
		audit: z.object({
			duration_minutes: z.number(),
			version_qualifiers: z.array(z.unknown()),
		}),
	}),
});
type Plan = z.infer<typeof Plan>;
const Brief = z.object({
	title: z.string(),
	intent: z.string(),
	context: z.string().optional(),
	anchors: z.array(z.string()).default([]),
	exclude: z.array(z.string()).default([]),
	duration_minutes: z.number().optional(),
	discovery: z.string(),
	explicit: z.string(),
	arc: z.string(),
	cover_direction: z.string().optional(),
	mood: z.string().optional(),
	era: z.string().optional(),
	textures: z.string().optional(),
	vocals: z.string().optional(),
});
const Draft = z.object({
	draft_id: z.string(),
	updated_at: z.string().optional(),
	mode: z.string(),
	brief: Brief,
	locked: z.array(InterviewField).default([]),
	suggestions: z.record(z.string(), z.unknown()).default({}),
});
type Draft = z.infer<typeof Draft>;
const Art = z.object({
	artwork_id: z.string(),
	state: z.string(),
	draft_id: z.string().optional(),
	request_id: z.string().optional(),
	error: z.string().optional(),
});
const Workspace = z.object({
	tool_profile: z.string().optional(),
	available_tools: z.array(z.string()).optional(),
	player: z.object({
		running: z.boolean(),
		state: z.string(),
		selected_player: z.string().optional(),
		capabilities: z
			.object({ available: z.boolean(), actions: z.array(z.string()) })
			.optional(),
		volume: z.number().optional(),
		error: z.string().optional(),
		track: z
			.object({ name: z.string(), artist: z.string(), album: z.string() })
			.nullish(),
		media: z
			.object({ title: z.string(), artist: z.string(), album: z.string() })
			.optional(),
	}),
	auth: z.object({
		developer_key_configured: z.boolean(),
		user_authorized: z.boolean(),
	}),
	plans: z.array(PlanSummary),
	studio: z
		.object({
			drafts: z.array(DraftSummary),
			artwork: z.array(Art),
			provider: z.object({
				enabled: z.boolean(),
				provider: z.string().optional(),
				providers: z
					.array(
						z.object({
							provider: z.string(),
							enabled: z.boolean(),
							remaining_local: z.number(),
							local_daily_limit: z.number(),
							cooldown_until: z.string().nullable(),
						}),
					)
					.default([]),
			}),
		})
		.optional(),
});
let busy = false,
	draftId: string | undefined,
	artworkId: string | undefined,
	requestId: string | undefined;
let availableTools: Set<string> | undefined;
const can = (name: string) => availableTools?.has(name) ?? true;
let selected: Song[] = [],
	selectedStory: z.infer<typeof ListeningStory> | undefined,
	activePlan: Plan | undefined,
	providerEnabled = false;
let initializedDraft = false;
let selectedDraftUpdatedAt: string | undefined;
let currentIdeas: ReturnType<typeof questionOptions> | undefined;
let locked = new Set<InterviewField>(),
	customSuggestions: Suggestions = {},
	ideaSeed = 0;
const seenIdeas: Partial<Record<InterviewField, string[]>> = {};
const inputId = (key: InterviewField) =>
	key === "duration_minutes"
		? "minutes"
		: key === "cover_direction"
			? "cover-direction"
			: key;
let artworks: z.infer<typeof Art>[] = [];
function el(id: string) {
	const n = document.getElementById(id);
	if (!n) throw new Error(`Missing element ${id}`);
	return n;
}
function field(id: string) {
	const n = el(id);
	if (
		!(
			n instanceof HTMLInputElement ||
			n instanceof HTMLTextAreaElement ||
			n instanceof HTMLSelectElement
		)
	)
		throw new Error(`Missing field ${id}`);
	return n;
}
const button = (id: string) => el(id) as HTMLButtonElement;
const text = (id: string, value: string) => {
	el(id).textContent = value;
};
const notice = (value: string) => text("notice", value);
function node<K extends keyof HTMLElementTagNameMap>(tag: K, value?: string) {
	const n = document.createElement(tag);
	if (value) n.textContent = value;
	return n;
}
function action(label: string, run: () => void) {
	const b = node("button", label);
	b.type = "button";
	b.onclick = run;
	return b;
}
function step(value: string) {
	for (const n of document.querySelectorAll<HTMLElement>("[data-stage]"))
		n.hidden = n.dataset.stage !== value;
	for (const n of document.querySelectorAll<HTMLButtonElement>("[data-step]")) {
		if (n.dataset.step === value) n.setAttribute("aria-current", "step");
		else n.removeAttribute("aria-current");
	}
}
function view(value: string) {
	for (const name of ["studio", "library", "activity"])
		el(`view-${name}`).hidden = value !== name;
	for (const n of document.querySelectorAll<HTMLButtonElement>("[data-view]")) {
		if (n.dataset.view === value) n.setAttribute("aria-current", "page");
		else n.removeAttribute("aria-current");
	}
}
function row(track: Song, index?: number) {
	const li = node("li"),
		info = node("div");
	info.className = "track-info";
	if (index !== undefined) {
		const n = node("span", String(index + 1));
		n.className = "index";
		li.append(n);
	}
	info.append(
		node("strong", track.name),
		node("small", [track.artist, track.album].filter(Boolean).join(" · ")),
	);
	li.append(info);
	return li;
}
function invalidatePreview() {
	activePlan = undefined;
	el("active-plan").replaceChildren();
	text("sequence-result", "");
}
function renderSelection() {
	const root = el("selection");
	const constrained = Boolean(
		selectedStory &&
			(selectedStory.chapters.length || selectedStory.anchors.length),
	);
	root.replaceChildren();
	text(
		"selection-summary",
		selected.length
			? `${selected.length} recordings · ${Math.round(selected.reduce((s, t) => s + t.duration_ms, 0) / 60000)} minutes`
			: "Choose recordings to start a sequence.",
	);
	button("preview").disabled =
		!selected.length || busy || !can("preview_playlist");
	button("space-artists").disabled =
		!selected.length || busy || !can("sequence_playlist");
	el("clear-structure").hidden = !selectedStory;
	el("sequence-story").replaceChildren();
	if (selectedStory) el("sequence-story").append(storyCard(selectedStory));
	selected.forEach((track, index) => {
		const li = row(track, index),
			controls = node("div");
		controls.className = "track-actions";
		for (const delta of [-1, 1]) {
			const b = action(delta < 0 ? "↑" : "↓", () => {
				const target = index + delta;
				[selected[index], selected[target]] = [
					selected[target],
					selected[index],
				];
				invalidatePreview();
				renderSelection();
			});
			b.setAttribute(
				"aria-label",
				`Move ${delta < 0 ? "up" : "down"}: ${track.name}`,
			);
			b.disabled =
				constrained || index + delta < 0 || index + delta >= selected.length;
			controls.append(b);
		}
		const remove = action("Remove", () => {
			selected.splice(index, 1);
			invalidatePreview();
			renderSelection();
		});
		remove.setAttribute("aria-label", `Remove ${track.name} from draft`);
		remove.disabled = constrained;
		controls.append(remove);
		li.append(controls);
		root.append(li);
	});
}
function storyCard(story: z.infer<typeof ListeningStory>) {
	const section = node("section");
	section.className = "listening-story";
	section.append(node("h3", "The listening story"));
	for (const chapter of story.chapters) {
		section.append(
			node(
				"p",
				`${chapter.title} · ${chapter.start === chapter.end ? `track ${chapter.start}` : `tracks ${chapter.start}–${chapter.end}`}${chapter.ordering === "preserve" ? " · order preserved" : ""}${chapter.purpose ? ` — ${chapter.purpose}` : ""}`,
			),
		);
	}
	for (const anchor of story.anchors)
		section.append(
			node(
				"p",
				`Pinned at ${anchor.position}: ${selected[anchor.position - 1]?.name ?? anchor.track.id}`,
			),
		);
	if (story.runtime_budget_minutes)
		section.append(
			node(
				"p",
				`Runtime target: ${story.runtime_budget_minutes} minutes (±${story.runtime_tolerance_minutes}). Missing durations remain unknown; the sequencer keeps every track.`,
			),
		);
	const unknown = selected.filter((t) => !t.duration_ms).length;
	const duration = selected.reduce((sum, t) => sum + t.duration_ms, 0) / 60000;
	const difference =
		story.runtime_budget_minutes === undefined
			? undefined
			: duration - story.runtime_budget_minutes;
	section.append(
		node(
			"p",
			unknown
				? `${Math.round(duration * 10) / 10} known minutes · ${unknown} durations unavailable.`
				: `${Math.round(duration * 10) / 10} minutes${difference === undefined ? "" : Math.abs(difference) <= story.runtime_tolerance_minutes ? " · within target" : ` · ${Math.abs(Math.round(difference * 10) / 10)} minutes ${difference > 0 ? "over" : "under"} target`}`,
		),
	);
	return section;
}
function planCard(plan: Plan) {
	const card = node("section");
	card.className = "plan";
	card.append(
		node("h3", plan.payload.name),
		node(
			"p",
			plan.payload.operation === "change"
				? `${plan.state.replaceAll("_", " ")} · ${plan.payload.description ?? "Music preferences/library change"}`
				: `${plan.payload.tracks.length} tracks · ${plan.payload.audit.duration_minutes} min · ${plan.state.replaceAll("_", " ")}`,
		),
	);
	if (plan.payload.audit.version_qualifiers.length) {
		const n = node(
			"p",
			"Alternate versions present. Review exact recordings before creating.",
		);
		n.className = "warning";
		card.append(n);
	}
	if (plan.payload.story) {
		const section = node("section");
		section.append(node("h4", "Chapters and anchors"));
		for (const chapter of plan.payload.story.chapters)
			section.append(
				node(
					"p",
					`${chapter.title} · ${chapter.start}–${chapter.end}${chapter.ordering === "preserve" ? " · order preserved" : ""}${chapter.purpose ? ` — ${chapter.purpose}` : ""}`,
				),
			);
		for (const anchor of plan.payload.story.anchors)
			section.append(
				node(
					"p",
					`Pinned at ${anchor.position}: ${plan.payload.tracks[anchor.position - 1]?.name ?? anchor.track.id}`,
				),
			);
		if (plan.payload.story.runtime_budget_minutes !== undefined)
			section.append(
				node(
					"p",
					`Runtime target: ${plan.payload.story.runtime_budget_minutes} minutes (±${plan.payload.story.runtime_tolerance_minutes}). Missing durations remain unknown.`,
				),
			);
		card.append(section);
	}
	const details = node("details"),
		list = node("ol");
	details.append(
		node(
			"summary",
			plan.payload.operation === "change"
				? "Inspect affected items"
				: "Inspect ordered recordings",
		),
	);
	if (plan.payload.operation === "change")
		for (const t of plan.payload.targets ?? [])
			list.append(
				node("li", `${t.name}${t.artist ? ` — ${t.artist}` : ""} (${t.id})`),
			);
	for (const t of plan.payload.tracks)
		list.append(
			node("li", `${t.name} — ${t.artist}${t.album ? ` · ${t.album}` : ""}`),
		);
	details.append(list);
	card.append(details);
	if (plan.result) {
		const receipt = node("details");
		receipt.append(node("summary", "Saved write receipt"));
		receipt.ontoggle = () => {
			if (receipt.open && !receipt.querySelector("pre"))
				receipt.append(node("pre", JSON.stringify(plan.result, null, 2)));
		};
		card.append(receipt);
	}
	const actions = node("div");
	actions.className = "actions";
	if (
		plan.state === "ready" &&
		can(
			plan.payload.operation === "change"
				? "apply_music_change"
				: "apply_playlist_plan",
		)
	) {
		const apply = action(
			plan.payload.operation === "change"
				? "Apply changes"
				: plan.payload.operation === "append"
					? "Add tracks"
					: "Create playlist",
			() =>
				void task(async () => {
					await call(
						plan.payload.operation === "change"
							? "apply_music_change"
							: "apply_playlist_plan",
						{ plan_id: plan.plan_id },
					);
					await refresh();
				}, "Saved result refreshed."),
		);
		apply.className = "primary";
		actions.append(
			apply,
			action(
				"Cancel preview",
				() =>
					void task(async () => {
						await call("cancel_playlist_plan", { plan_id: plan.plan_id });
						await refresh();
					}),
			),
		);
	}
	if (plan.payload.operation === "create")
		actions.append(
			action("Use sequence in studio", () => {
				selected = [...plan.payload.tracks];
				selectedStory = plan.payload.story;
				activePlan = plan;
				field("title").value = plan.payload.name;
				renderSelection();
				renderActive();
				view("studio");
				step("sequence");
				notice(
					`Loaded ${plan.payload.name} into the studio${selectedStory ? " with its saved listening-story constraints" : ""}. Apple Music is unchanged.`,
				);
			}),
		);
	if (
		["unknown", "needs_review", "applying", "deleting"].includes(plan.state)
	) {
		const warning = node(
			"p",
			"Inspect the library before acting again. This write is not automatically retried.",
		);
		warning.className = "warning";
		card.append(warning);
	}
	card.append(actions);
	return card;
}
function renderActive() {
	const root = el("active-plan");
	root.replaceChildren();
	if (activePlan) root.append(planCard(activePlan));
}
function planSummaryCard(plan: z.infer<typeof PlanSummary>) {
	const card = node("section");
	card.className = "plan";
	card.append(
		node("h3", plan.name),
		node(
			"p",
			[
				plan.operation === "change"
					? `${plan.target_count} affected items`
					: `${plan.track_count} tracks`,
				plan.operation !== "change" && plan.duration_minutes !== null
					? `${plan.duration_minutes} min`
					: "",
				plan.state.replaceAll("_", " "),
				plan.has_story ? "Listening story saved" : "",
			]
				.filter(Boolean)
				.join(" · "),
		),
	);
	if (
		["unknown", "needs_review", "applying", "deleting"].includes(plan.state)
	) {
		const warning = node(
			"p",
			"This write needs inspection. It will not be automatically retried.",
		);
		warning.className = "warning";
		card.append(warning);
	}
	card.append(
		action(
			plan.has_result ? "Inspect saved result" : "Review preview",
			() =>
				void task(async () => {
					const full = Plan.parse(
						await call("inspect_playlist_plan", { plan_id: plan.plan_id }),
					);
					card.replaceWith(planCard(full));
				}, "Plan details loaded. Apple Music is unchanged."),
		),
	);
	return card;
}
async function restoreDraft(id: string) {
	const result = z
		.object({ draft: Draft })
		.parse(await call("get_playlist_studio", { draft_id: id }));
	loadDraft(result.draft);
}
function loadDraft(draft: Draft) {
	if (draftId && draftId !== draft.draft_id) {
		selected = [];
		selectedStory = undefined;
		invalidatePreview();
		renderSelection();
	}
	draftId = draft.draft_id;
	selectedDraftUpdatedAt = draft.updated_at;
	const b = draft.brief;
	locked = new Set(draft.locked);
	customSuggestions = draft.suggestions as Suggestions;
	for (const [id, value] of Object.entries({
		title: b.title,
		intent: b.intent,
		context: b.context ?? "",
		minutes: b.duration_minutes?.toString() ?? "",
		anchors: b.anchors.join("\n"),
		exclude: b.exclude.join("; "),
		discovery: b.discovery,
		explicit: b.explicit,
		arc: b.arc,
		"cover-direction": b.cover_direction ?? "",
		mood: b.mood ?? "",
		era: b.era ?? "",
		textures: b.textures ?? "",
		vocals: b.vocals ?? "unspecified",
	}))
		field(id).value = value;
	renderIdeas(true);
	text("brief-name", b.title);
	text("brief-note", b.intent);
	text(
		"brief-stats",
		[
			b.duration_minutes ? `${b.duration_minutes} min` : "",
			b.discovery,
			b.arc.replaceAll("-", " "),
		]
			.filter(Boolean)
			.join(" · "),
	);
	const art = artworks.find((a) => a.draft_id === draftId);
	artworkId = art?.artwork_id;
	requestId =
		art && ["queued", "running"].includes(art.state)
			? art.request_id
			: undefined;
	button("generate-cover").textContent = art
		? "Generate another cover"
		: "Generate cover";
	el("cover-image").hidden = true;
	el("cover-empty").hidden = false;
	button("generate-cover").disabled =
		!providerEnabled || !can("generate_playlist_artwork");
	text(
		"cover-state",
		art
			? `Cover ${art.state}. Check progress to load it.`
			: providerEnabled
				? "Ready to generate."
				: "Choose a configured image provider to generate.",
	);
}
async function render(value: unknown) {
	const result = Workspace.safeParse(value);
	if (!result.success) {
		notice(
			"Unexpected workspace response. Your form is preserved; refresh to reconnect.",
		);
		return;
	}
	const data = result.data,
		p = data.player;
	availableTools = data.available_tools
		? new Set(data.available_tools)
		: undefined;
	text(
		"profile-note",
		data.tool_profile && data.tool_profile !== "full"
			? `Connected with the ${data.tool_profile} profile. Some actions are unavailable. Choose full locally for the complete studio, or curator for curation without playback.`
			: "",
	);
	for (const [id, tool] of Object.entries({
		"save-brief": "save_listening_brief",
		surprise: "save_listening_brief",
		"search-submit": "search_catalog",
		"load-library": "browse_api_library",
	}))
		button(id).disabled = !can(tool);
	text("song", p.track?.name || p.media?.title || "Nothing playing");
	text(
		"artist",
		p.track
			? [p.track.artist, p.track.album].filter(Boolean).join(" · ")
			: p.media
				? [p.media.artist, p.media.album].filter(Boolean).join(" · ")
				: `Player: ${p.selected_player ?? "native"}`,
	);
	text(
		"state",
		p.state === "api-only"
			? "API-only · no player selected"
			: p.state === "profile-limited"
				? "Playback excluded by this profile"
				: p.state === "unavailable"
					? "Player unavailable"
					: p.running
						? p.state
						: "Player is closed",
	);
	field("volume").value = String(p.volume ?? 50);
	field("volume").disabled = p.volume == null || p.state === "unavailable";
	text(
		"volume-label",
		p.volume == null ? "Volume unavailable" : `Volume ${p.volume}%`,
	);
	for (const b of document.querySelectorAll<HTMLButtonElement>("[data-action]"))
		b.disabled =
			p.state === "unavailable" ||
			p.state === "api-only" ||
			(p.capabilities
				? !p.capabilities.actions.includes(b.dataset.action ?? "")
				: false);
	text(
		"auth",
		data.auth.user_authorized
			? "Apple Music connected"
			: data.auth.developer_key_configured
				? "Catalog ready · Library sign-in pending"
				: "MusicKit setup pending",
	);
	el("plans").replaceChildren(...data.plans.map(planSummaryCard));
	el("empty").hidden = !!data.plans.length;
	if (activePlan) {
		const previousId = activePlan.plan_id;
		const summary = data.plans.find((p) => p.plan_id === previousId);
		if (!summary) activePlan = undefined;
		else if (summary.state !== activePlan.state) {
			const updated = Plan.parse(
				await call("inspect_playlist_plan", { plan_id: previousId }),
			);
			if (activePlan?.plan_id === previousId) activePlan = updated;
		}
		renderActive();
	}
	if (data.studio) {
		const choice =
			field("artwork-provider").value ||
			data.studio.provider.provider ||
			"codex-cli";
		const picker = field("artwork-provider") as HTMLSelectElement;
		picker.replaceChildren();
		const providers = data.studio.provider.providers;
		for (const p of providers) {
			const o = node(
				"option",
				`${p.provider}${p.enabled ? ` · ${p.remaining_local}/${p.local_daily_limit} local requests left` : " · setup pending"}${p.cooldown_until ? " · cooling down" : ""}`,
			);
			o.value = p.provider;
			o.disabled = !p.enabled || !p.remaining_local || !!p.cooldown_until;
			picker.append(o);
		}
		if (!providers.length) {
			const o = node("option", "codex-cli");
			o.value = "codex-cli";
			picker.append(o);
		}
		picker.value = choice;
		providerEnabled = providers.length
			? !!providers.find(
					(p) =>
						p.provider === choice &&
						p.enabled &&
						p.remaining_local &&
						!p.cooldown_until,
				)
			: data.studio.provider.enabled;
		picker.dataset.providers = JSON.stringify(providers);
		artworks = data.studio.artwork;
		const saved = data.studio.drafts.find((d) => d.draft_id === draftId);
		// Fresh agent suggestions are fetched for the selected draft only.
		if (saved && saved.updated_at !== selectedDraftUpdatedAt) {
			const result = z
				.object({ draft: Draft })
				.parse(await call("get_playlist_studio", { draft_id: saved.draft_id }));
			customSuggestions = result.draft.suggestions as Suggestions;
			selectedDraftUpdatedAt = saved.updated_at;
			renderIdeas(true);
		}
		if (draftId && !artworkId) {
			const existing = artworks.find((a) => a.draft_id === draftId);
			artworkId = existing?.artwork_id;
		}
		el("saved-drafts").replaceChildren(
			...data.studio.drafts
				.slice(0, 5)
				.map((d) =>
					action(
						d.title,
						() => void task(() => restoreDraft(d.draft_id), "Brief loaded."),
					),
				),
		);
		if (!initializedDraft) {
			initializedDraft = true;
			if (!draftId && data.studio.drafts.length && !field("intent").value)
				await restoreDraft(data.studio.drafts[0].draft_id);
		}
		button("generate-cover").disabled =
			!draftId || !providerEnabled || !can("generate_playlist_artwork");
		text(
			"provider-state",
			providerEnabled
				? "Image provider ready. Local request caps are not account quota readings."
				: "Configure an image provider locally to enable generation.",
		);
	}
	if (p.error) notice(p.error);
}
async function rawCall(name: string, args: Record<string, unknown> = {}) {
	if (!can(name))
		throw new Error(
			"This action is unavailable in the server's selected profile. Choose full or the appropriate profile locally, then reconnect.",
		);
	const result = await app.callServerTool({ name, arguments: args });
	if (result.isError)
		throw new Error(
			result.content?.find((c) => c.type === "text")?.text ||
				"Tool call failed.",
		);
	return result;
}
async function call(name: string, args: Record<string, unknown> = {}) {
	return (await rawCall(name, args)).structuredContent;
}
async function refresh() {
	await render(await call("get_music_workspace"));
}
async function task(run: () => Promise<void>, success = "Updated.") {
	if (busy) return;
	busy = true;
	document.body.setAttribute("aria-busy", "true");
	notice("Working…");
	try {
		await run();
		notice(success);
	} catch (e) {
		notice(
			e instanceof Error
				? e.message
				: "Operation failed. Your input is preserved.",
		);
	} finally {
		busy = false;
		document.body.removeAttribute("aria-busy");
		renderSelection();
	}
}
function briefInput() {
	return {
		title: field("title").value.trim() || "Untitled mixtape",
		intent: field("intent").value.trim(),
		context: field("context").value.trim() || undefined,
		anchors: field("anchors")
			.value.split("\n")
			.map((s) => s.trim())
			.filter(Boolean),
		exclude: field("exclude")
			.value.split(";")
			.map((s) => s.trim())
			.filter(Boolean),
		duration_minutes: field("minutes").value
			? Number(field("minutes").value)
			: undefined,
		discovery: field("discovery").value,
		explicit: field("explicit").value,
		arc: field("arc").value,
		cover_direction: field("cover-direction").value.trim() || undefined,
		mood: field("mood").value.trim() || undefined,
		era: field("era").value.trim() || undefined,
		textures: field("textures").value.trim() || undefined,
		vocals: field("vocals").value,
	};
}
async function saveBrief(surprise = false) {
	const current = briefInput();
	const result = await call("save_listening_brief", {
		brief: surprise
			? {
					context: current.context,
					anchors: current.anchors,
					exclude: current.exclude,
					duration_minutes: current.duration_minutes,
					discovery: current.discovery,
					explicit: current.explicit,
					cover_direction: current.cover_direction,
				}
			: current,
		mode: surprise ? "surprise" : field("interview-mode").value,
		locked: [...locked],
		...(!surprise && draftId ? { draft_id: draftId } : {}),
		seed: crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647,
	});
	loadDraft(Draft.parse(result));
	const questions = z
		.object({
			interview: z.object({
				questions: z.array(z.object({ question: z.string() })),
			}),
		})
		.parse(result).interview.questions;
	el("questions").replaceChildren(
		node("h3", "A useful next question"),
		...questions.map((q) => node("p", q.question)),
	);
	el("questions").hidden = !questions.length;
	await refresh();
}
function applyIdea(key: InterviewField, choice: Choice) {
	field(inputId(key)).value = Array.isArray(choice.value)
		? choice.value.join(key === "exclude" ? "; " : "\n")
		: String(choice.value);
	locked.add(key);
	renderIdeas();
	notice("Idea added to your draft and locked. Save when it feels right.");
}
function renderIdeas(fresh = false) {
	const key = InterviewField.parse(field("idea-field").value);
	const choices =
		!fresh && currentIdeas?.field === key
			? currentIdeas
			: questionOptions(
					key,
					ideaSeed,
					seenIdeas[key] ?? [],
					customSuggestions,
					briefInput().exclude,
				);
	currentIdeas = choices;
	text("idea-question", choices.question);
	text(
		"idea-count",
		`${choices.total_options} starting points · ${choices.choices.some((c) => c.origin === "agent") ? "includes fresh agent ideas" : "or write your own"}`,
	);
	el("idea-choices").replaceChildren(
		...choices.choices.map((c) => {
			const b = action(c.label, () => applyIdea(key, c));
			if (c.origin === "agent") b.title = "Suggested by your agent";
			return b;
		}),
	);
	(el("idea-lock") as HTMLInputElement).checked = locked.has(key);
	button("idea-random").disabled =
		locked.has(key) || ["explicit", "exclude"].includes(key);
	const answer = field(inputId(key)).value;
	text("idea-current", answer ? `Current: ${answer}` : "No answer yet.");
	seenIdeas[key] = [
		...new Set([
			...(seenIdeas[key] ?? []),
			...choices.choices.map((c) => c.id),
		]),
	].slice(-300);
}
field("idea-field").onchange = () => {
	ideaSeed++;
	renderIdeas(true);
};
el("idea-more").onclick = () => {
	ideaSeed++;
	renderIdeas(true);
	notice("Fresh options. Your answers are unchanged.");
};
el("idea-lock").onchange = () => {
	const key = InterviewField.parse(field("idea-field").value);
	if ((el("idea-lock") as HTMLInputElement).checked) locked.add(key);
	else locked.delete(key);
	renderIdeas();
};
el("idea-random").onclick = () => {
	const key = InterviewField.parse(field("idea-field").value);
	if (locked.has(key) || ["explicit", "exclude"].includes(key)) return;
	const c = questionOptions(
		key,
		++ideaSeed,
		[],
		customSuggestions,
		briefInput().exclude,
	).choices[0];
	if (c) applyIdea(key, c);
};
function remixInputs(onlyEmpty: boolean) {
	for (const key of creativeFields) {
		if (locked.has(key) || (onlyEmpty && field(inputId(key)).value)) continue;
		const c = questionOptions(
			key,
			++ideaSeed,
			[],
			customSuggestions,
			briefInput().exclude,
		).choices[0];
		if (c) field(inputId(key)).value = String(c.value);
	}
	renderIdeas();
	notice(
		"Draft ideas refreshed. Your intent, anchors, duration, exclusions and explicit-content choice are preserved.",
	);
}
el("idea-fill").onclick = () => remixInputs(true);
el("idea-reroll").onclick = () => remixInputs(false);
el("idea-agent").onclick = () =>
	void task(async () => {
		await saveBrief();
		const key = field("idea-field").value;
		const result = await app.sendMessage({
			role: "user",
			content: [
				{
					type: "text",
					text: `For Groovectl listening draft ${draftId}, suggest six fresh, musically relevant choices for ${key}, using the saved intent, anchors and exclusions. Save them via save_listening_brief.suggestions without changing existing answers, then show the options. I may answer freely or skip.`,
				},
			],
		});
		if (result.isError)
			throw new Error(
				"This host could not send the request. Ask your agent for fresh options for " +
					key +
					" in this saved brief.",
			);
	}, "Fresh suggestions requested from your agent. Refresh the workspace when they are saved.");
for (const key of InterviewField.options)
	field(inputId(key)).addEventListener("input", () => {
		locked.add(key);
		if (field("idea-field").value === key) renderIdeas();
	});
field("artwork-provider").onchange = () => {
	const options = JSON.parse(
		field("artwork-provider").dataset.providers ?? "[]",
	) as Array<{
		provider: string;
		enabled: boolean;
		remaining_local: number;
		cooldown_until: string | null;
	}>;
	const selected = options.find(
		(p) => p.provider === field("artwork-provider").value,
	);
	providerEnabled =
		!!selected?.enabled &&
		selected.remaining_local > 0 &&
		!selected.cooldown_until;
	button("generate-cover").disabled =
		!draftId || !providerEnabled || !can("generate_playlist_artwork");
	requestId = undefined;
};
el("save-brief").onclick = () => {
	void task(
		() => saveBrief(),
		"Brief saved. Continue with your agent or find recordings here.",
	);
};
el("surprise").onclick = () =>
	void task(
		() => saveBrief(true),
		"A new idea is ready. Adjust anything before choosing music.",
	);
// Some MCP hosts sandbox native form submission. Keep keyboard activation local.
for (const [formId, buttonId] of [
	["brief-form", "save-brief"],
	["search-form", "search-submit"],
]) {
	el(formId!).onkeydown = (event) => {
		if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
			event.preventDefault();
			button(buttonId!).click();
		}
	};
	el(formId!).onsubmit = (event) => event.preventDefault();
}
el("new-draft").onclick = () => {
	draftId = undefined;
	locked.clear();
	customSuggestions = {};
	for (const key of InterviewField.options) delete seenIdeas[key];
	renderIdeas();
	activePlan = undefined;
	selected = [];
	selectedStory = undefined;
	artworkId = undefined;
	requestId = undefined;
	(el("brief-form") as HTMLFormElement).reset();
	field("cover-direction").value = "";
	el("questions").hidden = true;
	text("brief-name", "An idea worth following");
	text("brief-note", "Start a new listening brief.");
	text("brief-stats", "");
	el("cover-image").hidden = true;
	el("cover-empty").hidden = false;
	button("generate-cover").disabled = true;
	renderSelection();
	renderActive();
	step("brief");
};
el("search-submit").onclick = () => {
	void task(async () => {
		text("search-state", "Searching the catalog…");
		let result: { songs: Song[] };
		try {
			result = z.object({ songs: z.array(Song) }).parse(
				await call("search_catalog", {
					query: field("search").value,
					limit: 20,
				}),
			);
		} catch (error) {
			text(
				"search-state",
				"Search failed. Previous results are retained below.",
			);
			throw error;
		}
		const root = el("search-results");
		root.replaceChildren();
		text(
			"search-state",
			`${result.songs.length} catalog recordings. Review title, artist, and album.`,
		);
		for (const song of result.songs) {
			const li = row(song),
				add = action("Add", () => {
					if (selectedStory) {
						step("sequence");
						notice(
							"This mix has listening-story constraints. Remove chapter, anchor and runtime constraints in Sequence before adding recordings. Saved plans and Apple Music are unchanged.",
						);
						return;
					}
					if (
						!selected.some((t) => t.id === song.id && t.source === song.source)
					) {
						selected.push(song);
						invalidatePreview();
					}
					add.textContent = "Added";
					add.disabled = true;
					renderSelection();
				});
			add.setAttribute("aria-label", `Add ${song.name} by ${song.artist}`);
			add.disabled = selected.some(
				(t) => t.id === song.id && t.source === song.source,
			);
			if (add.disabled) add.textContent = "Added";
			li.append(add);
			root.append(li);
		}
	});
};
el("preview").onclick = () =>
	void task(async () => {
		activePlan = Plan.parse(
			await call("preview_playlist", {
				name: field("title").value || "Untitled mixtape",
				description: field("intent").value,
				tracks: selected.map((t) => ({ source: t.source, id: t.id })),
				...(selectedStory ? { story: selectedStory } : {}),
			}),
		);
		renderActive();
		await refresh();
	}, "Preview saved. Review recordings before creating.");
el("clear-structure").onclick = () => {
	selectedStory = undefined;
	invalidatePreview();
	renderSelection();
	notice(
		"Chapter, anchor and runtime constraints removed from this draft. Saved plans and Apple Music are unchanged.",
	);
};
el("space-artists").onclick = () =>
	void task(async () => {
		const minutes = Number(field("minutes").value);
		const story =
			selectedStory ??
			(minutes
				? ListeningStory.parse({ runtime_budget_minutes: minutes })
				: undefined);
		const result = z
			.object({
				tracks: z.array(Song),
				story: ListeningStory.optional(),
				artist_spacing_conflicts: z.array(z.unknown()),
			})
			.parse(
				await call("sequence_playlist", {
					tracks: selected.map((t) => ({ source: t.source, id: t.id })),
					artist_gap: 1,
					...(story ? { story } : {}),
				}),
			);
		selected = result.tracks;
		selectedStory = result.story;
		invalidatePreview();
		text(
			"sequence-result",
			`Order suggested; ${result.artist_spacing_conflicts.length} artist-spacing conflicts remain. Every recording and pinned anchor was retained. Review the listening flow before saving a preview.`,
		);
	}, "Sequence updated. Apple Music is unchanged.");
el("generate-cover").onclick = () =>
	void task(async () => {
		const previousRequest = requestId;
		await saveBrief();
		requestId = previousRequest ?? crypto.randomUUID();
		const job = Art.parse(
			await call("generate_playlist_artwork", {
				draft_id: draftId,
				request_id: requestId,
				provider: field("artwork-provider").value,
			}),
		);
		artworkId = job.artwork_id;
		artworks = [
			job,
			...artworks.filter((a) => a.artwork_id !== job.artwork_id),
		];
		text("cover-state", `Cover ${job.state}. Check progress in a few minutes.`);
	}, "Artwork requested. Your library has not changed.");
el("check-cover").onclick = () =>
	void task(async () => {
		if (!artworkId) throw new Error("Generate a cover first.");
		const result = await rawCall("get_playlist_artwork", {
				artwork_id: artworkId,
				include_image: false,
			}),
			job = Art.parse(result.structuredContent);
		artworks = artworks.map((a) =>
			a.artwork_id === job.artwork_id ? { ...a, ...job } : a,
		);
		text("cover-state", job.error || `Cover ${job.state}.`);
		if (job.state === "complete") {
			const image = result.content?.find((c) => c.type === "image");
			const meta = result._meta as { artwork?: string } | undefined;
			const src =
				image?.type === "image"
					? `data:${image.mimeType};base64,${image.data}`
					: meta?.artwork;
			if (src && /^data:image\/(png|jpeg);base64,/.test(src)) {
				(el("cover-image") as HTMLImageElement).src = src;
				el("cover-image").hidden = false;
				el("cover-empty").hidden = true;
			}
			requestId = undefined;
			button("generate-cover").textContent = "Generate another cover";
		}
		if (job.state === "failed") {
			requestId = undefined;
			button("generate-cover").textContent = "Try a new cover request";
		}
	});
el("load-library").onclick = () =>
	void task(async () => {
		const result = z
			.object({
				data: z
					.array(
						z.object({
							id: z.string(),
							attributes: z
								.object({ name: z.string().optional() })
								.passthrough(),
						}),
					)
					.optional(),
			})
			.parse(
				await call("browse_api_library", { type: "playlists", offset: 0 }),
			);
		const root = el("library-results");
		root.replaceChildren(
			...(result.data ?? []).map((p) =>
				node("p", p.attributes.name || "Untitled playlist"),
			),
		);
		if (!result.data?.length)
			root.append(node("p", "No playlists returned on this page."));
	});
for (const b of document.querySelectorAll<HTMLButtonElement>(
	"[data-step],[data-go]",
))
	b.onclick = () => step(b.dataset.step ?? b.dataset.go!);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-view]"))
	b.onclick = () => view(b.dataset.view!);
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-action]"))
	b.onclick = () =>
		void task(async () => {
			await call("control_playback", { action: b.dataset.action });
			await refresh();
		});
el("refresh").onclick = () => void task(refresh);
field("volume").onchange = () =>
	void task(async () => {
		await call("control_playback", {
			action: "volume",
			value: Number(field("volume").value),
		});
		await refresh();
	});
field("volume").oninput = () =>
	text("volume-label", `Volume ${field("volume").value}%`);
function theme(context: ReturnType<App["getHostContext"]>) {
	if (context?.theme) applyDocumentTheme(context.theme);
	if (context?.styles?.variables)
		applyHostStyleVariables(context.styles.variables);
}
app.addEventListener("hostcontextchanged", theme);
app.ontoolresult = async (result) => {
	if (Workspace.safeParse(result.structuredContent).success)
		await render(result.structuredContent);
};
renderSelection();
renderIdeas();
try {
	await app.connect();
	theme(app.getHostContext());
	await refresh();
	notice("Ready.");
} catch {
	notice(
		"Open Groovectl in an MCP Apps host to connect. Your input stays here.",
	);
}
