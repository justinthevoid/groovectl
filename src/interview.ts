import { z } from "zod";

export const InterviewField = z.enum([
	"title",
	"context",
	"anchors",
	"duration_minutes",
	"discovery",
	"explicit",
	"arc",
	"exclude",
	"cover_direction",
	"mood",
	"era",
	"textures",
	"vocals",
]);
export type InterviewField = z.infer<typeof InterviewField>;
export type Choice = {
	id: string;
	label: string;
	value: string | number | string[];
	origin: "bank" | "agent";
};
export const SuggestionInput = z
	.object({
		label: z.string().trim().min(1).max(90),
		value: z.union([
			z.string().trim().min(1).max(1200),
			z.number().int().min(5).max(720),
			z.array(z.string().trim().min(1).max(240)).min(1).max(12),
		]),
	})
	.strict();
export const Suggestions = z.partialRecord(
	InterviewField,
	z.array(SuggestionInput).max(12),
);
export type Suggestions = z.infer<typeof Suggestions>;
const split = (text: string) => text.split(" | ");
const strings = {
	title: split(
		"After Hours / Before Dawn | Open Windows | The Long Way Home | Side A / Side B | Low Light, Good Company | A Different Kind of Sunday | Soft Focus | Borrowed Sunlight | Between Stations | Kitchen Radio | Small Hours | Something in the Air | Last Train, First Light | Take the Scenic Route | Blue Hour Club | Stay a Little Longer | The Weather Inside | Windows Down | Almost Summer | Quietly Electric | No Particular Hurry | A Room of Our Own | Out Past the Streetlights | Tomorrow Can Wait",
	),
	context: split(
		"A late drive with the city almost asleep | Cooking slowly with a glass of something good | A dinner that turns into a long conversation | Headphones on a rainy train | A walk with nowhere urgent to be | A Sunday morning with the windows open | A small gathering before anyone gets loud | Reading in a room full of afternoon light | A focused work session without sharp edges | A road trip through unfamiliar country | Getting ready to go somewhere exciting | Coming down after a very full day | A quiet hotel room in a new city | Cleaning the house with the volume up | A night bus passing little pools of light | A solo sunset at the water | A long flight and an imaginary destination | Drawing, making, or doing something with your hands | An early commute before the world wakes up | A backyard evening as the temperature drops | A slow stretch and a proper exhale | A record-shop afternoon | A living-room dance break | Watching a thunderstorm roll in",
	),
	mood: split(
		"Warm, a little restless, ultimately hopeful | Tender without tipping into sentimental | Playful, loose, and slightly odd | Calm with something interesting under the surface | Cool on the outside, generous underneath | A little melancholy with a bright horizon | Bold, buoyant, and unselfconscious | Suspended between nostalgia and discovery | Cinematic, nocturnal, and intimate | Sunlit with a small psychedelic streak | Defiant without becoming exhausting | Patient, textured, and quietly absorbing | Romantic with a mischievous edge | Strange but welcoming | Clear-headed and quietly confident | A beautiful sense of being elsewhere | Barely contained excitement | Heavy, cathartic, with a soft landing | Weightless and slightly uncanny | Earthy, rhythmic, and alive | Dreamy without drifting to sleep | Bittersweet but never bleak | Spacious, sensual, and unhurried | Bright-eyed and curious",
	),
	textures: split(
		"Warm bass, soft drums, lots of breathing room | Dusty drums and little electronic details | Guitars that shimmer rather than shout | Intimate voices and close-miked instruments | Live rhythm sections with a little swing | Analog synths and a patient pulse | Acoustic wood, strings, and room sound | Dub space, deep bass, and echoes | Small jazz ensembles with melodic warmth | Layered harmonies and unusual vocal colors | Velvet keys and gently off-center grooves | Hand percussion and interlocking rhythms | Distorted guitars with emotional weight | Lush strings with a restrained rhythm section | Minimal piano and environmental texture | Crisp drums and bright pop hooks | Broken beats and intricate sound design | Dream-pop haze and slow motion | Crisp funk guitar and elastic bass | Organic instruments meeting subtle electronics | Raw live-in-the-room energy | A little tape hiss and a lot of air | Tight, dry production with a strong pocket | Sweeping orchestral color without bombast",
	),
	era: split(
		"Mostly the 1960s | Mostly the 1970s | Mostly the 1980s | Mostly the 1990s | Mostly the 2000s | Mostly the 2010s | Mostly the 2020s | A conversation between the 1970s and now | A 1990s heart with contemporary edges | Timeless rather than tied to a decade | Older roots, newer interpretations | New releases where the brief genuinely fits | A slow journey from older to newer recordings | One decade, with a few sympathetic outliers | A cross-generation family resemblance | Vintage atmosphere without requiring vintage recordings",
	),
	cover_direction: split(
		"An open window, sunlit linen, olive and warm cream; photographic still life | A midnight greenhouse, rain on glass, deep green and one warm lamp | A solitary gas station at blue hour, faded red and cold sky; analog photograph | Cropped fruit and a colored tabletop; playful editorial still life | A swimming pool after everyone has left, pale turquoise and warm concrete | A paper sculpture casting a long late-afternoon shadow; restrained studio lighting | A rain-blurred city seen through a bus window; cobalt and amber | Desert rocks at the last light, rust and violet, a wide quiet composition | Soft fabric moving in a barely open doorway; warm monochrome | A small lamp on an otherwise empty kitchen table; intimate and cinematic | A single flower reflected in a slightly imperfect mirror; muted pastels | An abstract painted gesture, chalky pigment and visible paper texture | A motel curtain with one stripe of neon light; grainy and nocturnal | A glass of water refracting sunlight onto a colored wall; minimal and luminous | A sculptural chair beside an overgrown window; soft green and dusty pink | A floating geometric form made from folded paper; precise shadows | A foggy shore with one distant colored sail; spacious photography | A close-up of mineral layers, tactile and almost abstract | A pair of empty dance shoes beside a sunlit wall; joyful without people | A small radio in a field of tall grass; surreal but photographic | An underwater view of rippling sunlight; deep teal and pale gold | A tabletop constellation of everyday objects; overhead editorial photograph | A quiet alley with one open door and warm light; gentle mystery | An imperfect ceramic vessel against textured paper; earthy studio still life",
	),
} satisfies Partial<Record<InterviewField, string[]>>;
const raw: Record<InterviewField, Array<string | number | string[]>> = {
	...strings,
	anchors: split(
		"Sade | Khruangbin | Massive Attack | Portishead | Björk | Nina Simone | Floating Points | Four Tet | D'Angelo | Nala Sinephro | Ryuichi Sakamoto | Joni Mitchell | Cocteau Twins | BADBADNOTGOOD | Fela Kuti | Talking Heads | Fiona Apple | Deftones | Burial | Boards of Canada | James Blake | Solange | Nick Drake | Little Simz",
	).map((x) => [x]),
	duration_minutes: [
		15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 100, 120, 150, 180,
	],
	discovery: ["familiar", "balanced", "adventurous"],
	explicit: ["unspecified", "allow", "avoid"],
	arc: ["steady", "rise", "fall", "peak", "three-act"],
	exclude: split(
		"Live versions | Covers | Remixes | Abrupt stylistic jumps | Long instrumental solos | Novelty songs | Spoken-word interludes | Harsh distortion | Overly sentimental ballads | Very long tracks | Seasonal songs | Audience noise | Heavy electronic drops | Acoustic cover versions | Extended dance mixes | Comedy recordings",
	).map((x) => [x]),
	vocals: ["instrumental", "vocal", "mix", "unspecified"],
};
const titles: Record<InterviewField, string> = {
	title: "What should we call it?",
	context: "Where will this soundtrack live?",
	mood: "How should it feel?",
	textures: "What sounds should it lean toward?",
	era: "Any era to orbit around?",
	anchors: "One or two artists or songs to start from?",
	duration_minutes: "How long is the listening window?",
	discovery: "How far from familiar should we go?",
	explicit: "Should explicit recordings be avoided?",
	arc: "Where should the listening journey go?",
	exclude: "Anything that would break the spell?",
	cover_direction: "What should the sleeve feel like?",
	vocals: "How much room for voices?",
};
const labels: Record<string, string> = {
	familiar: "Mostly familiar",
	balanced: "A comfortable stretch",
	adventurous: "Take me somewhere new",
	allow: "Allow explicit recordings",
	avoid: "Avoid explicit recordings",
	unspecified: "No preference",
	steady: "Stay in the pocket",
	rise: "Build gradually",
	fall: "Wind down",
	peak: "Build, peak, return",
	"three-act": "Settle in → explore → land",
	instrumental: "Instrumental focus",
	vocal: "Voices at the center",
	mix: "A mixture of both",
};
export const bankSize = Object.values(raw).reduce(
	(n, options) => n + options.length,
	0,
);
export const creativeFields: InterviewField[] = [
	"title",
	"context",
	"mood",
	"textures",
	"era",
	"arc",
	"cover_direction",
];
function hash(text: string) {
	let value = 2166136261;
	for (const char of text) {
		value = Math.imul(value ^ char.charCodeAt(0), 16777619);
	}
	return value >>> 0;
}
function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let x = state;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}
export function questionOptions(
	field: InterviewField,
	seed = 0,
	seen: string[] = [],
	custom: Suggestions = {},
	exclusions: string[] = [],
) {
	const all: Choice[] = [
		...(custom[field] ?? []).map((c) => ({
			...c,
			id: `agent-${hash(JSON.stringify(c))}`,
			origin: "agent" as const,
		})),
		...raw[field].map((value, i) => ({
			id: `${field}-${i}`,
			value,
			label:
				typeof value === "number"
					? `${value} minutes`
					: Array.isArray(value)
						? value.join(", ")
						: (labels[value] ?? value),
			origin: "bank" as const,
		})),
	];
	const unique = all
		.filter(
			(c, i) =>
				all.findIndex(
					(other) => JSON.stringify(c.value) === JSON.stringify(other.value),
				) === i,
		)
		.filter(
			(c) =>
				!exclusions.some(
					(x) =>
						x.length > 2 &&
						JSON.stringify(c.value)
							.toLocaleLowerCase()
							.includes(x.toLocaleLowerCase()),
				),
		);
	const unseen = unique.filter((c) => !seen.includes(c.id)),
		pool = unseen.length >= Math.min(4, unique.length) ? unseen : unique;
	const rng = random(seed ^ hash(field));
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[pool[i], pool[j]] = [pool[j]!, pool[i]!];
	}
	const fresh = pool.filter((c) => c.origin === "agent").slice(0, 3);
	const choices = [...fresh, ...pool.filter((c) => !fresh.includes(c))].slice(
		0,
		6,
	);
	return {
		field,
		question: titles[field],
		choices,
		total_options: unique.length,
		bank_size: bankSize,
		cycled: pool === unique && seen.length > 0,
		optional: true,
	};
}
export function suggestionCatalog(
	seed = 0,
	custom: Suggestions = {},
	exclusions: string[] = [],
) {
	return InterviewField.options.map((field) =>
		questionOptions(field, seed, [], custom, exclusions),
	);
}
