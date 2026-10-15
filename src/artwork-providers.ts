import { z } from "zod";

export const ArtworkProvider = z.enum([
	"codex-cli",
	"agy-cli",
	"openai",
	"gemini",
	"openrouter",
]);
export type ArtworkProvider = z.infer<typeof ArtworkProvider>;
export const ProviderSettings = z.object({
	enabled: z.boolean().default(true),
	executable: z.string().optional(),
	model: z
		.string()
		.regex(/^[a-zA-Z0-9._/:-]{1,160}$/)
		.optional(),
	key_env: z
		.string()
		.regex(/^[A-Z][A-Z0-9_]{0,79}$/)
		.optional(),
	stored_key: z.boolean().default(false),
	daily_limit: z.number().int().min(1).max(100).default(5),
});
export type ProviderSettings = z.infer<typeof ProviderSettings>;

/** Names only; listing metadata may contain credentials and must never be logged or returned. */
export function codexMcpOverrides(listing: unknown): string[] {
	const servers = z
		.array(
			z
				.object({ name: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) })
				.passthrough(),
		)
		.max(1000)
		.parse(listing);
	return [...new Set(servers.map((server) => server.name))]
		.sort()
		.flatMap((name) => ["-c", `mcp_servers.${name}.enabled=false`]);
}
export class ArtworkRateLimit extends Error {
	constructor(readonly retryAt: number) {
		super(
			"Image provider rate limit reached. The request was not retried; wait until the cooldown expires.",
		);
	}
}
const endpoints = {
	openai: "https://api.openai.com/v1/images/generations",
	gemini: "https://generativelanguage.googleapis.com/v1beta/interactions",
	openrouter: "https://openrouter.ai/api/v1/images",
};

/** Fixed endpoints, inline image bytes only, one image and no automatic retries/fallbacks. */
export async function generateAPIImage(
	provider: ArtworkProvider,
	model: string,
	key: string,
	prompt: string,
	fetcher: typeof fetch = fetch,
): Promise<Buffer> {
	if (provider === "codex-cli" || provider === "agy-cli")
		throw new Error("A CLI provider cannot use the image API adapter.");
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (provider === "gemini") headers["x-goog-api-key"] = key;
	else headers.Authorization = `Bearer ${key}`;
	const body =
		provider === "openai"
			? {
					model,
					prompt,
					n: 1,
					size: "1024x1024",
					quality: "low",
					output_format: "png",
				}
			: provider === "gemini"
				? {
						model,
						input: prompt,
						store: false,
						response_format: {
							type: "image",
							aspect_ratio: "1:1",
							image_size: "1K",
						},
					}
				: {
						model,
						prompt,
						n: 1,
						aspect_ratio: "1:1",
						resolution: "1K",
						output_format: "png",
						provider: { allow_fallbacks: false },
					};
	let response: Response;
	try {
		response = await fetcher(endpoints[provider], {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			redirect: "error",
			signal: AbortSignal.timeout(180000),
		});
	} catch {
		throw new Error(
			"Image API request did not finish. Its outcome may be unknown; no automatic retry was attempted.",
		);
	}
	if (response.status === 429) {
		const value = response.headers.get("retry-after"),
			seconds = value && /^\d+$/.test(value) ? Number(value) : undefined;
		const date = value ? Date.parse(value) : NaN;
		const retryAt =
			seconds !== undefined
				? Date.now() + seconds * 1000
				: Number.isFinite(date)
					? date
					: Date.now() + 3600000;
		await response.body?.cancel();
		throw new ArtworkRateLimit(Math.max(Date.now() + 60000, retryAt));
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(
			`Image provider returned HTTP ${response.status}. Check local credentials, model access and billing; no automatic retry was attempted.`,
		);
	}
	if (Number(response.headers.get("content-length")) > 12 * 1024 * 1024) {
		await response.body?.cancel();
		throw new Error("Image response exceeded 12 MiB.");
	}
	const reader = response.body?.getReader();
	if (!reader) throw new Error("Image provider returned no response body.");
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > 12 * 1024 * 1024)
				throw new Error("Image response exceeded 12 MiB.");
			chunks.push(value);
		}
	} catch {
		await reader.cancel();
		throw new Error(
			"Image response was incomplete or exceeded its size budget. No automatic retry was attempted.",
		);
	}
	let json: unknown;
	try {
		json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new Error("Image provider returned invalid JSON.");
	}
	const image = z
		.object({ data: z.string(), type: z.literal("image") })
		.passthrough();
	let encoded: string | undefined;
	if (provider === "gemini") {
		const parsed = z
			.object({
				status: z.literal("completed"),
				steps: z.array(
					z
						.object({
							type: z.string(),
							content: z.array(z.unknown()).optional(),
						})
						.passthrough(),
				),
			})
			.safeParse(json);
		const images = parsed.success
			? parsed.data.steps
					.filter((s) => s.type === "model_output")
					.flatMap((s) => s.content ?? [])
					.flatMap((c) => {
						const result = image.safeParse(c);
						return result.success ? [result.data] : [];
					})
			: [];
		if (images.length === 1) encoded = images[0]!.data;
	} else {
		const parsed = z
			.object({
				data: z
					.array(z.object({ b64_json: z.string() }).passthrough())
					.length(1),
			})
			.safeParse(json);
		if (parsed.success) encoded = parsed.data.data[0]!.b64_json;
	}
	if (
		!encoded ||
		encoded.length > Math.ceil((8 * 1024 * 1024) / 3) * 4 ||
		!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
		encoded.length % 4 !== 0
	)
		throw new Error(
			"Provider did not return exactly one bounded inline image. Remote URLs are not downloaded.",
		);
	return Buffer.from(encoded, "base64");
}
