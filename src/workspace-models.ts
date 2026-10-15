import { z } from "zod";
import type { Plan } from "./storage.js";
import type { Draft } from "./studio.js";

// Workspace lists are navigation. Full recordings, suggestions and write receipts
// are available only through the existing plan/draft inspectors.
export const PlanSummary = z.object({
	plan_id: z.string(),
	state: z.string(),
	expires_at: z.number(),
	name: z.string(),
	operation: z.enum(["create", "append", "change"]),
	source: z.enum(["native", "catalog"]),
	track_count: z.number().int().nonnegative(),
	target_count: z.number().int().nonnegative(),
	duration_minutes: z.number().nonnegative().nullable(),
	version_qualifier_count: z.number().int().nonnegative(),
	has_story: z.boolean(),
	has_result: z.boolean(),
});
export type PlanSummary = z.infer<typeof PlanSummary>;
export function summarizePlan(plan: Plan): PlanSummary {
	const { payload } = plan;
	return PlanSummary.parse({
		plan_id: plan.plan_id,
		state: plan.state,
		expires_at: plan.expires_at,
		name: payload.name,
		operation: payload.operation,
		source: payload.source,
		track_count: payload.tracks.length,
		target_count: Array.isArray(payload.targets) ? payload.targets.length : 0,
		duration_minutes:
			typeof payload.audit.duration_minutes === "number"
				? payload.audit.duration_minutes
				: null,
		version_qualifier_count: Array.isArray(payload.audit.version_qualifiers)
			? payload.audit.version_qualifiers.length
			: 0,
		has_story: payload.story != null,
		has_result: plan.result != null,
	});
}
export const DraftSummary = z.object({
	draft_id: z.string().uuid(),
	title: z.string(),
	mode: z.enum(["quick", "deep", "surprise"]),
	updated_at: z.string(),
});
export function summarizeDraft(draft: Draft): z.infer<typeof DraftSummary> {
	return {
		draft_id: draft.draft_id,
		title: draft.brief.title,
		mode: draft.mode,
		updated_at: draft.updated_at,
	};
}
