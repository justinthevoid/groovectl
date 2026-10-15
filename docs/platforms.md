# Players and platforms

Catalog browsing, personal API library reads, recording resolution, playlist planning/creation, snapshots and curation run in TypeScript on Node 24+. Local playback uses an explicitly selected adapter.

| Capability | Music.app / macOS | Apple Music / Windows | Cider / macOS, Windows, Linux |
| --- | --- | --- | --- |
| Catalog and API library tools | Yes, with MusicKit | Yes, with MusicKit | Yes, with MusicKit |
| Play, pause, next, previous | Yes | Per-session support | Yes |
| Stop and seek | Yes | Per-session support | Yes |
| Player volume | Yes | Not exposed through this adapter | Yes |
| Shuffle and repeat | Yes | Not exposed through this adapter | Yes |
| Play a specific recording/playlist | Native persistent ID | Not exposed through SMTC | Catalog ID |
| Read/enqueue current queue | Not exposed | Not exposed | Yes, bounded and sanitized |
| Native library/playlist CRUD | Guarded create/append and owned deletion | Not exposed | Use official API playlist tools |

## macOS

The default `auto` bridge uses **Groovectl Helper** if installed. Otherwise it uses fixed AppleScript/JXA operations through the system `osascript` executable. Both accept structured IDs/data; neither exposes a tool that evaluates caller-provided code. A failed operation is never replayed through a different bridge.

The compatibility bridge requires no compiler or Python. Its Automation permission belongs to the agent host that launches it. To move Apple Events into a dedicated app identity:

```sh
groovectl install-helper
groovectl doctor --probe
```

Building the helper requires macOS 13+, Xcode Command Line Tools and Swift 6+. Apple’s OSAKit, AppKit and Apple Event frameworks require macOS; Linux/WSL cannot build this target. Source installation runs helper tests before building. The app installs into `~/Applications/Groovectl Helper.app` and launches through LaunchServices. It uses a `0600` Unix socket in a `0700` directory, checks the peer user ID, bounds requests and offers fixed operations only.

Source builds use a local ad hoc signature by default. This is not Developer ID signing or notarization, and stable permission continuity across rebuilds is not guaranteed. Set `GROOVECTL_SIGN_IDENTITY` to your available signing identity for a signed build. Public prebuilt apps should be Developer ID signed and notarized before distribution.

`GROOVECTL_NATIVE_MODE=helper` requires the app, `compatibility` explicitly chooses fixed scripts, and `auto` is the default. `GROOVECTL_HELPER_APP` can select a custom app location. Keep the host stopped while updating its app bundle; installation refuses to replace a running host.

## Windows Apple Music

```powershell
groovectl select-player windows
groovectl doctor --probe
```

The experimental adapter uses Microsoft’s [Windows.Media.Control](https://learn.microsoft.com/en-us/uwp/api/windows.media.control) APIs through the Windows PowerShell 5.1 projection. It targets Apple’s package session explicitly, checks each advertised transport capability and refuses ambiguous sessions. It never sends global media keys that could affect another app.

Run in the signed-in Windows desktop session. SSH/service sessions may not have access to the interactive media-session broker. Open Apple Music and start a song once if it has not registered a session. A missing session is reported as such, not as successful control. Apple Music’s desktop app has no macOS AppleScript dictionary; its library and catalog integration here use MusicKit instead of an invented iTunes COM bridge.

0.5.2 qualification verified live play/pause and unsupported seek/volume rejection in a real desktop session. The workspace now narrows its actions to that session's enabled controls. Seek, next/previous and stop remain dependent on the app/session and are not all live-qualified; portable CI does not establish them.

The rc.2 follow-up again observed play/pause state changes, but Apple Music supplied empty title/artist fields and a zero timeline even after manual playback. A same-process Windows API probe read populated Cider metadata, so this is an observed limitation of that Apple Music session rather than evidence that Groovectl discarded its fields. Do not infer the current song, expose disabled seek/skip controls, or silently use Cider's metadata for Apple Music.

## Cider

Use Cider’s maintained [client RPC documentation](https://github.com/ciderapp/docs/blob/main/docs/1.client/rpc.md). This adapter targets the documented `/api/v1/playback` contract, not the discontinued Cider 1 implementation. API availability can vary with the installed Cider release.

1. In Cider, open **Settings → Connectivity → Manage External Application Access**.
2. Create a Groovectl application token and keep authentication enabled.
3. Run `groovectl setup-cider`; its token prompt is hidden. Or use `CIDER_API_TOKEN` / `--token-stdin` with your secret manager. Do not put the token in MCP arguments or a command-line flag.
4. Run `groovectl doctor --probe`.

The default origin is `http://127.0.0.1:10767`; IPv6 loopback is supported through `--url http://[::1]:10767`. Remote hosts, credentials in URLs, redirects and arbitrary paths are rejected. The token is sent only as an `apptoken` header. The queue response removes raw asset URLs, DRM metadata and download keys.

Windows Store Cider 4.0.27.0 passed authenticated state/queue reads and play/pause, seek, volume, shuffle and repeat readbacks in the 0.5.2 qualification cycle. Invalid/anonymous tokens were rejected. Targeted play, enqueue, next/previous and stop retain separate live qualification. A missing playback timestamp remains unknown; an accepted seek response alone does not establish its resulting position. The adapter accepts Cider's documented empty `204` responses.

The rc.2 desktop follow-up additionally verified next/previous against exact recordings, the new shuffle/repeat projections, and seek against an observed timestamp. Track, timestamp, volume and modes were restored. The returned queue's ID order differed after the navigation roundtrip despite retaining 186 items, so full queue restoration is not established. Targeted play, enqueue and stop remain pending a disposable queue test. See the [qualification ledger](https://github.com/justinthevoid/groovectl/blob/main/docs/qualification.md) for the narrower scope and retained early failures.

Select another player with `groovectl select-player native|windows|cider`, or set `GROOVECTL_PLAYER`. Player selection affects playback, while a playlist plan’s `source` selects its ID namespace and write backend.
