# Original playlist artwork

One saved brief → one original square image → review/export. Artwork is optional; playback and catalog tools need no image provider. Generation never uploads a cover into Apple Music.

## Setup

Run setup on the machine executing Groovectl. Choose a trusted installed executable or your own API key. Configuration and credentials stay outside the repository. Keys and executable paths are never MCP arguments.

```sh
groovectl setup-artwork --codex-path /absolute/path/to/codex
groovectl setup-artwork --provider agy-cli --executable /absolute/path/to/agy --daily-limit 3 --no-select
groovectl setup-artwork --provider openai --model YOUR_IMAGE_MODEL --key-env OPENAI_API_KEY
groovectl setup-artwork --provider gemini --model YOUR_IMAGE_MODEL --key-env GEMINI_API_KEY
groovectl setup-artwork --provider openrouter --model YOUR_IMAGE_MODEL --key-env OPENROUTER_API_KEY
```

`--no-select` configures an alternative while retaining the default. Otherwise setup selects that provider. The dashboard/tool may explicitly select any configured provider. Queued jobs retain the chosen provider/model even if settings change.

For private file storage, replace `--key-env NAME` with `--api-key-stdin` and supply the key through a local password manager or hidden terminal input. Do not paste keys into chat, command-line arguments, shared files, or echoing shell commands. Stored key files use 0600 on POSIX; Windows relies on the user's profile ACL. Environment references must exist in the actual MCP process and worker.

| Provider | Authentication and behavior | Qualification |
| --- | --- | --- |
| Codex CLI | Existing ChatGPT login/allowance; API-key-only login refused. Built-in image generation. Use actual binary, not a Windows cmd/bat/PowerShell wrapper. | Direct CLI and production worker generated real 1024-square PNGs on macOS, including the 0.5 candidate with connected apps, plugins, web search and configured MCP servers disabled. |
| agy CLI | Existing Antigravity login and Nano Banana availability. Fresh process, sandbox, accept-edits mode, normal permission review. | Experimental. Flags verified. Bounded live trial returned success text but no image and a denied RunCommand: failed generation, not qualification. Resolve local permissions/image availability before claiming it works. |
| OpenAI BYOK | Explicit image model and your API billing; 1024 square, low quality to bound cost. | Contract/error/budget coverage; no charged live qualification. |
| Gemini BYOK | Explicit image model and your billing; Interactions API, square 1K, storage disabled. | Documented schema and simulated responses tested; no charged live qualification. |
| OpenRouter BYOK | Explicit image model and your billing; dedicated Image API, square 1K, provider fallback disabled. | Documented schema and simulated responses tested; model must support requested parameters. No charged live qualification. |

Model access, pricing and quotas belong to the provider. Setup requires an explicit BYOK model; there is no automatic model substitution. See [OpenAI Images](https://developers.openai.com/api/reference/resources/images/methods/generate), [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation), [Interactions response schema](https://ai.google.dev/api/interactions-api), and [OpenRouter Image API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation).

## Quota and failure handling

Defaults are **3 attempts per rolling 24 hours for agy**, **5 per other provider**. Operators can set `--daily-limit 1..100`. These are local safeguards, not account quota readings. Failed attempts count because they may consume allowance. One worker runs at a time across providers. There is no automatic retry, batch generation or paid fallback.

Call generate_playlist_artwork with a saved brief and fresh UUID request_id. Reuse that ID only for the same creative request/provider; changed input is rejected. Exclusive markers deduplicate across processes and restarts. Check get_playlist_artwork for status; polling generates nothing. Failed/interrupted jobs require an intentional new request. HTTP 429 persists Retry-After cooldown, or one hour if absent.

CLI jobs have a five-minute runtime and 16 MiB output budget. API calls have a three-minute timeout and bounded streamed JSON. Errors report status, not provider response bodies. API hosts are fixed HTTPS endpoints with redirects disabled. Only inline bytes are accepted; remote asset URLs are not downloaded.

## Creative workflow and outputs

Describe one visual idea, composition, palette, medium and light fitting the music. A strong focal idea helps at thumbnail size. Intent/context/mood/textures/era and art direction ground the prompt. Browse 24 cover directions or ask the host agent for fresh ones before requesting one image.

Completed jobs return a standard MCP image/resource; dashboard reads avoid duplicating base64 in conversation. PNG and JPEG are supported, with MIME determined from bytes. Files must be regular non-symlinks, square, 256–2896 pixels per side and at most 8 MiB; SHA-256 is checked whenever returned. PNG chunks/CRC/bounded pixel data and JPEG frame/segment structure are checked. File validation is not a hostile-image decoder sandbox.

`groovectl export-artwork UUID --output /private/output/cover.png` refuses overwrite and reports MIME; use .jpg for JPEG. After 100 jobs, archive old completed directories locally. Never remove a live worker's provider lock or unrelated caches/credentials.

Any MCP host with a local executor can use configured providers. CLI children receive a bounded creative prompt through argument arrays/stdin and retain the CLI's normal approval/sandbox rules. Codex uses workspace-write, disables plugins, connected apps and web search, and discovers configured MCP servers locally so each is disabled in the child. The listing is never logged/returned. An unreadable listing or unsupported server name stops generation; configuration files are not rewritten and user configuration/rules are not discarded. Use a current Codex CLI with mcp list --json and these feature flags. agy uses its sandbox and normal permission review. Neither bypasses approvals or treats success text as an image. Existing settings/image caches may still be discovered: this is not hermetic isolation. Configured API-key environment references and common token/secret variables are removed from CLI children. Private agy diagnostic logs can contain creative text; never package them.

## Applying a cover

The reviewed REST playlist surface has no custom-artwork upload. A disposable Music.app artwork-creation probe failed with -2710 and the test playlist was removed. Export/manual application remains supported. Do not label a generated/exported cover as applied. Future automation needs target identity, registered artifact validation and honest readback or uncertainty handling.
