import { test } from "node:test";
import assert from "node:assert/strict";
import { bankSize, InterviewField, questionOptions } from "../src/interview.js";
import { ListeningBrief, remixBrief, Studio } from "../src/studio.js";
import { root } from "./helpers.js";
test("inspiration offers a broad bounded bank and no repeats until a question cycles", () => {
	assert.ok(bankSize >= 200);
	const seen: string[] = [];
	for (let seed = 0; seed < 4; seed++) {
		const q = questionOptions("cover_direction", seed, seen);
		assert.equal(q.choices.length, 6);
		assert.ok(q.choices.every((c) => !seen.includes(c.id)));
		seen.push(...q.choices.map((c) => c.id));
	}
	assert.equal(questionOptions("cover_direction", 4, seen).cycled, true);
	for (const field of InterviewField.options)
		assert.ok(questionOptions(field).choices.length <= 6);
});
test("fresh agent options are visible, typed and survive private draft reloads", () => {
	const studio = new Studio(root()),
		brief = ListeningBrief.parse({
			title: "Dusk",
			intent: "Sparse dub, no harsh drops",
		});
	const suggestions = {
		mood: [
			{
				label: "Suspended in warm space",
				value: "Spacious and slightly mysterious",
			},
		],
	};
	const draft = studio.save(brief, "quick", undefined, {
		suggestions,
		locked: ["title"],
	});
	assert.equal(
		questionOptions("mood", 20, [], draft.suggestions).choices[0]?.origin,
		"agent",
	);
	assert.deepEqual(studio.get(draft.draft_id).locked, ["title"]);
	assert.throws(
		() =>
			studio.save(brief, "quick", draft.draft_id, {
				suggestions: { arc: [{ label: "Invalid", value: "not-an-arc" }] },
			}),
		/does not fit/,
	);
});
test("brain-off remixes preserve intent, locks and hard constraints", () => {
	const brief = ListeningBrief.parse({
		title: "Mine",
		intent: "No vocals, late train",
		duration_minutes: 45,
		anchors: ["Burial"],
		explicit: "avoid",
		exclude: ["live"],
		mood: "Quiet",
	});
	const remixed = remixBrief(
		brief,
		99,
		["title", "mood"],
		{},
		"unlocked",
		false,
	);
	for (const key of [
		"title",
		"intent",
		"duration_minutes",
		"anchors",
		"explicit",
		"exclude",
		"mood",
	] as const)
		assert.deepEqual(remixed[key], brief[key]);
	assert.ok(remixed.textures);
	assert.ok(remixed.cover_direction);
	assert.throws(
		() => remixBrief(brief, 3, [], {}, "explicit", false),
		/never randomized/,
	);
	assert.throws(
		() => remixBrief(brief, 3, [], {}, "exclude", false),
		/never randomized/,
	);
	assert.equal(remixBrief(brief, 5).mood, "Quiet");
});
