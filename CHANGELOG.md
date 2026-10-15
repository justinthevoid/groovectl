# Changelog

## 0.6.0-rc.5 — observed Cider transport candidate

- After an accepted Cider Play/Pause command, observe state up to four times with brief delays until the requested state is seen. Never resend the command. Unconfirmed or failed reads require inspection instead of presenting the acknowledgment as completion.
- Preserve rc.4's local player chooser, execution-host label and versioned app resources, qualified through the actual Windows app.

## 0.6.0-rc.4 — local player selection candidate

- Choose Apple Music/Music.app or configured Cider in the persistent player. Show the MCP execution platform separately from the frontend's computer.
- Scope player selection to the current app/request. Selection only reads state; it does not start playback or change the CLI default. Keep commands and queue reads on the chosen adapter.
- Reject unsupported-platform targets, preserve profile/API-only restrictions and prevent stale/default observations or failed switches from controlling the previous player.

## 0.6.0-rc.3 — read reliability and native search candidate

- Correct Music.app's search-area enum so title/artist library searches return native recording IDs instead of an Apple Event type error. Keep the retained Python bridge aligned.
- Retry transient Apple API GET failures once within the original 25-second deadline, including interrupted response bodies and HTTP 502/503/504. Preserve authorization and redact exception details. Authentication errors, rate limits, unknown failures and all writes are excluded from automatic retries.
- Explain an empty Music.app resume instead of returning a stopped player as if a song had started. Catalog/API selections remain separate from native playback targets.

## 0.6.0-rc.2 — player and recovery candidate

- Expose observed shuffle/repeat modes through the shared player, with named states, explicit actions and capability guards. Read Cider's documented now-playing mode fields without extra polling requests; unknown modes stay unavailable.
- Keep the seek bar usable at phone widths and preserve a range adjustment across background observations until it is submitted.
- Require a fresh player observation after an uncertain command. Prevent duplicate commands and late command results from replacing a newer selected-player observation.
- Retry the actual failed collection page without resetting loaded rows, selection or the open inspector. Loading more collection items no longer closes details.
- Fix the component gallery's state selector so synthetic command results remain visible.

## 0.6.0-rc.1 — collection browser candidate

- Drill into library artists → albums → exact library songs with one read-only `inspect_api_library` tool. Bound each request to 100 related items and the same resource's validated pagination URL; preserve library-only recordings and loaded back-navigation state.
- Distinguish unavailable track metadata from stopped playback, name the actual output player and separate catalog/library configuration from player connectivity.
- Add the first reusable Svelte collection browser and player: paginated Library categories, grid/list, playlist inspector, typed recording selection for Studio, capability-driven playback and a read-only Cider queue. Preserve Studio and existing reviewed writes. Include an account-free component gallery with original example artwork.
- Preserve raw session fields while adding a shared capability projection to playback reads/commands. Use adapter readback instead of a duplicate state read after each command; respect negotiated queue access.
- Add the ChatGPT Extensions capability map and dashboard/UI-kit documentation, with source, installed and live qualification kept separate.

## 0.5.2 prerelease — 2026-10-15

- Respect the active Windows media session's controls in the studio instead of advertising commands disabled by that session.
- Preserve new typing and brief selection when a saved-draft response arrives late.
- Accept Cider's documented empty `204` responses without inventing a playback position.
- Update headless persistence checks to verify compact lists and the complete selected brief across process replacement.

## 0.5.1 — private qualification checkpoint

- Keep studio/workspace refreshes compact: plan and draft summaries omit complete recording lists, repeated write receipts and interview histories. Existing inspectors retain the full saved data; journals and write semantics are unchanged.
- Load selected Activity plans and saved briefs on demand. Preserve exact recording review, uncertainty warnings, saved receipts, chapter restoration and fresh agent suggestions.
- Add large-history regression coverage and retain text/structured MCP results for ordinary clients.

## 0.5.0 preview — 2026-10-15

- Listening stories with contiguous chapters, pinned recordings, preserved album runs, six reusable recipes and honest runtime budgets. Keep current stories through verified writes, snapshots and JSON exports; mark externally changed playlists stale.
- Show chapters and anchors in the MCP studio and offer artist-spacing suggestions without changing Apple Music.
- Support a fixed loopback authorization port and --no-open for private SSH-forwarded headless setup.
- Respect the selected tool profile in studio readiness/controls and avoid excluded player probes. Disable configured MCP servers, connected apps and web search in Codex artwork children without discarding operator configuration or weakening approval rules.
- Keep missing energy estimates unknown, and report every omitted M3U link while rejecting non-Apple origins and line injection.
- Flag fuzzy artist/title suggestions for review instead of implying an exact recording match.
- Add public repository policies, pinned multi-platform/package/container CI, original branding and an Astro 7/Svelte 5/Starlight documentation site with Cloudflare/VPS deployment guidance.
- Add a layered vinyl/sleeve/tape website scene with scroll separation/reassembly, word-level heading motion and control feedback, plus reduced-motion and static alternatives.
- Qualify the first public CI run, including Swift helper tests/build/packaging, after fixing the legacy uv group, deterministic license inventory and Windows UTF-8 test oracle.
- Update retained Python-reference pins to PyJWT 2.15.0 and pytest 9.0.3 for reported security fixes. Python remains outside the shipped TypeScript runtime.
- Mix catalog songs and API-library imports in one playlist plan. Preserve Apple's direct recording aliases during deduplication and exact-order verification.
- Browse library folders and preview folder creation through the existing music-change workflow. Choose and verify a parent folder for new API playlists.
- Select an explicit API-only player mode. Linux defaults to it; capability reports and the studio no longer imply desktop playback on a headless host.
- Retain legacy journals and conservative handling of changed targets, partial acceptance and uncertain writes.

## 0.4.0 — 2026-10-15

- Optional interviews with 205 starting points, agent-supplied choices, field locks and random/reroll controls.
- Codex and experimental agy artwork routes, plus optional OpenAI, Gemini and OpenRouter BYOK image generation. PNG/JPEG transport, private storage, local attempt caps and cooldown handling.
- Reviewed music ratings, favorites and catalog-library additions with durable partial-progress/acceptance receipts.

## 0.3.1

- TypeScript MCP SDK 2 server, portable CLI/plugin, optional Swift helper and compatibility bridge.
- Exact recording resolution, playlist plans and snapshots, export/import, artist-spacing suggestions, native/Windows/Cider adapters and a playlist-studio MCP App.

Pre-public versions were private development checkpoints. The public release process and qualification ledger distinguish tested behavior from platform experiments.
