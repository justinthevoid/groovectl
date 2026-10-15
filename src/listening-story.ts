import { z } from "zod";
import { TrackRef } from "./models.js";

export const Recipe = z.enum([
	"three-act",
	"side-a-side-b",
	"taste-bridge",
	"album-flight",
	"rediscovery",
	"time-capsule",
]);
export const ListeningStory = z
	.object({
		recipe: Recipe.optional(),
		chapters: z
			.array(
				z
					.object({
						title: z.string().trim().min(1).max(100),
						purpose: z.string().trim().min(1).max(400).optional(),
						ordering: z.enum(["flexible", "preserve"]).default("flexible"),
						start: z.number().int().min(1).max(200),
						end: z.number().int().min(1).max(200),
					})
					.strict(),
			)
			.max(20)
			.default([]),
		anchors: z
			.array(
				z
					.object({
						track: TrackRef,
						position: z.number().int().min(1).max(200),
					})
					.strict(),
			)
			.max(20)
			.default([]),
		runtime_budget_minutes: z.number().min(1).max(1440).optional(),
		runtime_tolerance_minutes: z.number().min(0).max(60).default(2),
	})
	.strict();
export type ListeningStory = z.infer<typeof ListeningStory>;
export const recipes = [
	{
		id: "three-act",
		title: "A small listening story",
		prompt: "An invitation, an interesting detour and a satisfying landing.",
		chapters: ["Arrival", "The long way around", "Home"],
		question: "What should change between the first and last song?",
	},
	{
		id: "side-a-side-b",
		title: "Side A / Side B",
		prompt:
			"Two contrasting halves connected by one convincing musical hinge. Pin an opener, the flip and the closer.",
		chapters: ["Side A — draw me in", "Side B — open things up"],
		question:
			"What connects the two sides: a voice, a rhythm, an instrument or a memory?",
	},
	{
		id: "taste-bridge",
		title: "Meet me halfway",
		prompt:
			"Travel between two musical worlds through shared textures, collaborators or influences. Explain each connection as curatorial judgment; verify historical claims before stating them.",
		chapters: ["Your shore", "The crossing", "Somewhere new"],
		question: "Which two songs or artists are the shores?",
	},
	{
		id: "album-flight",
		title: "An album flight",
		prompt:
			"A small tasting of several albums: preserve each album's internal track order when requested, choose exact editions, explain why these excerpts belong together.",
		chapters: ["First pour", "A different color", "The lingering note"],
		question:
			"Complete mini-runs from each album, or a conversation between them?",
	},
	{
		id: "rediscovery",
		title: "The forgotten shelf",
		prompt:
			"Use a bounded library sample to surface overlooked corners. Say which data was sampled; do not claim a song is unheard or forgotten without listening evidence.",
		chapters: ["An old friend", "Off the main shelf", "Keep this close"],
		question:
			"Should I stay inside your library or bring in a few related discoveries?",
	},
	{
		id: "time-capsule",
		title: "Then / now",
		prompt:
			"Build around a personally meaningful era, with present-day echoes if desired. Release dates identify editions, not necessarily the year a recording was made; check versions.",
		chapters: ["Back then", "The thread between", "Still with me"],
		question: "Is this about a year, a place or a chapter of your life?",
	},
] as const;
