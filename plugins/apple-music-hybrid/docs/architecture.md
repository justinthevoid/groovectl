# Architecture and safety contracts

`src/` contains the TypeScript CLI, MCP SDK 2 server, Apple API client, player adapters and curation tools. `native/` contains the optional macOS Swift helper and the Windows media-session script. `ui/workspace.ts` is a TypeScript MCP App using the official OpenAI Extensions SDK. Build output is bundled so a release CLI needs Node 24+ and no Python or npm runtime dependency tree.

The host agent interprets the listening brief and chooses music. Groovectl supplies verified recording metadata, explicit constraints, durable write plans and playback. It makes no second LLM call, invents no BPM/key/energy measurements and does not send library metadata to an audio-feature service.

## Playlist writes

1. Validate IDs and one backend per plan; resolve native recordings or a mix of catalog/API-library songs.
2. Remove duplicate recording references and existing target tracks.
3. Save the ordered preview, audit, expiration and target fingerprint in SQLite.
4. Acquire the shared mutation database lock and recheck the target.
5. Commit an `applying` claim **before** sending a write.
6. Save a returned new-playlist ID before readback.
7. Verify exact ordered recording identities and count, using only Apple-provided catalog/library aliases; verify the chosen folder when applicable. Save `applied`, `needs_review` or `unknown`.

Successful apply retries return the saved receipt. Uncertain/interrupted outcomes do not retry automatically. Separate SQLite databases allow the process lock to span network calls without keeping the durable plan claim uncommitted. The lock is released by the OS if a process exits. Plans expire after two hours. Existing Python journal schema and fingerprint encoding are retained.

Native deletion accepts only an applied create plan, its exact original name and an unchanged fingerprint. There is no general library-track deletion, playlist replacement, arbitrary AppleScript, shell execution or generic HTTP request tool.

Local snapshots are separate private files. Restoring/importing means making a new preview, with all IDs resolved again. API-library-only imports retain their library identifiers and can participate in API song plans without substitution. Snapshot restoration is bounded to the plan limit of 200 tracks.

## Listening stories

An optional typed story partitions the original candidate order into contiguous chapters, pins exact recordings to final positions within their chapter, and reports a runtime budget. Preserved chapters keep their internal order, useful for album flights. The sequencer keeps all tracks and reports artist conflicts; it never invents audio measurements or drops songs to hit a time target. Structured previews reject duplicate aliases rather than silently changing chapter ranges.

Story metadata is local, not an Apple playlist feature. A verified write saves it privately alongside the exact playlist identity, name and recording order. Reads attach it only while that identity/order still matches; external edits mark it stale. Local metadata failure after a verified write is a receipt warning, not a reason to replay the music write. Snapshots and JSON exports preserve current stories; import/restore validates them against newly resolved recordings. M3U8 includes chapter-range comments, which other players may ignore.

## Capability boundaries

Catalog, API-library, native-library and playback namespaces stay explicit. Windows SMTC exposes fewer operations than Music.app or Cider. Unsupported operations fail before a command is sent. Cider’s toggle-only shuffle/repeat endpoints use bounded, serialized read/toggle/read steps. Local players can still be changed by their UI or other software, so concurrent external edits may require inspection.

`get_capabilities` describes the selected player. Profiles (`full`, `catalog`, `curator`, `player`) reduce tool exposure. Linux defaults to the `none` player, an API-only mode that omits playback tools; other hosts can explicitly select it. All tools carry read/write/destructive/network annotations. The UI receives structured results and a restrictive CSP; ordinary MCP clients receive text plus structured data.

The local app and configuration are trusted execution surfaces for processes running as the same user. Socket ownership and file modes do not sandbox untrusted code already running under that account. Playlist and song metadata remain untrusted content for the host agent.

Workspace and studio list responses are bounded navigation summaries. `inspect_playlist_plan` returns one complete saved plan and receipt; `get_playlist_studio` with `draft_id` returns the selected full brief in `draft`. The UI loads those details on selection and protects new typing from a late saved-draft response. Journals retain the full original payload. Plain-text and structured MCP results remain available; neither list response repeats whole recording/interview histories.

## Provenance and tests

The MIT Python implementation and its original 14 tests remain under `server/` as a regression reference. Active runtime, CLI and plugin use TypeScript. Matching and adjacency rules retain upstream MIT attribution in `THIRD_PARTY_NOTICES.md` and `licenses/`.

Tests cover journal restart/idempotence, concurrent apply, uncertain writes, exact recording IDs, mutation guards, recording/version matching, optional-feature coverage, snapshots/import validation, Cider token/URL/queue boundaries, authorization callback checks and MCP SDK 1/2 interoperability. Native helper tests exercise request validation without controlling Music. Live transport qualification is recorded separately from unit tests.
