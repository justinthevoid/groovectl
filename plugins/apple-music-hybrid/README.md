<p align="center"><img src="assets/brand/mark.svg" width="76" height="76" alt="Groovectl groove mark"></p>

<h1 align="center">Groovectl</h1>
<p align="center"><strong>Make a mixtape. Make it yours.</strong><br>Apple Music for agents — exact recordings, thoughtful playlists, original covers and useful player control.</p>

![A translucent raspberry vinyl record and flowing olive tape emerging from a cream record sleeve.](assets/brand/vinyl-journey.webp)

<p align="center"><a href="docs/musickit.md">MusicKit setup</a> · <a href="docs/playlist-studio.md">Playlist studio</a> · <a href="docs/apple-music-capabilities.md">Capability map</a> · <a href="deploy/README.md">Deploy</a> · <a href="CONTRIBUTING.md">Contribute</a></p>

Groovectl gives your agent a record shop's worth of possibilities and a sensible way to act on them. Start with a feeling, a few favorite songs, a very specific brief, or “surprise me.” Your agent supplies the musical judgment. Groovectl resolves the recordings, helps shape the order, saves a preview and checks what actually changed in Apple Music.

**TypeScript MCP server · CLI · interactive MCP App / OpenAI Extension · optional Swift helper.** Runs on Node 24+. No Python or second LLM service is needed at runtime. Formerly Apple Music Hybrid; existing local credentials and write receipts are preserved.

> **Public preview:** [source is on GitHub](https://github.com/justinthevoid/groovectl). Use a source checkout or a checksum-verified release artifact. npm and the public plugin directory are not published. The [qualification ledger](docs/qualification.md) distinguishes contract tests, live Apple reads/writes, native builds and interactive player checks.

## A little imagination, with working tools behind it

**Brief → recordings → sequence → cover.** Use the whole studio or just the part you need.

- **Exact versions.** Search the catalog and library, resolve title/artist pairs, inspect alternate releases and storefront mappings, and preserve library-only imports. An ISRC is a clue, not permission to substitute a recording.
- **A listening story.** Shape chapters, pin an opener or closer, keep album mini-runs in order, inspect artist-spacing conflicts and compare the mix with a runtime budget. No song disappears just to make the numbers work.
- **Creative starts.** Side A / Side B, taste bridges, album flights, rediscovery, time capsules and a three-act journey. One shared workflow, rather than a tool for every recipe.
- **Optional inspiration.** Over 200 starting suggestions across 13 topics, fresh ideas from the host agent, field locks, random and reroll. A good brief needs no questionnaire. Hard exclusions and content policies stay authoritative.
- **Your collection.** Catalog discovery, recommendations, recent tracks, heavy rotation, the latest eligible Replay, bounded library profiles, folders, snapshots, comparisons and JSON/M3U8 exports.
- **Original covers.** Configured Codex CLI, experimental agy, or your own OpenAI, Gemini or OpenRouter image key. Inspect provider readiness, use local attempt caps, and export PNG/JPEG. No automatic paid fallback. Applying a custom cover in Apple Music is currently manual.
- **Requested controls.** Playback, seek, volume, shuffle/repeat and queue operations where the selected player supports them. Ratings, favorites and library additions use reviewed account-change plans.

Try a brief like:

> “Make a 45-minute Side A / Side B mix for the long way home. Warm soul into strange electronics. Keep this recording as the opener; no live versions. Explain the hinge between sides and show me the preview.”

> “Build a bridge between two artists I love. Let me choose from a few directions, or reroll the ones I don't like. Give the finished mix its own cover.”

> “Find interesting corners of my library, tell me what you sampled, and make a little album flight. Keep each mini-run in order.”

> “Snapshot this playlist before I edit it. Compare the two versions later and restore the old one as a new playlist if I ask.”

<p align="center"><img src="assets/examples/between-stations.png" width="300" height="300" alt="Original Between Stations cover: a cream train window, deep olive night landscape and warm amber light."><br><sub>Between Stations · original cover from a live Groovectl worker qualification, for a fictional mix.</sub></p>

## Install

Use **Node 24+** and **Bun 1.3.10**. From a trusted source checkout:

```sh
git clone https://github.com/justinthevoid/groovectl.git
cd groovectl
bun install --frozen-lockfile
bun run build
npm install --global . --ignore-scripts
groovectl doctor
```

A built release tarball can be installed with `npm install --global ./groovectl-VERSION.tgz --ignore-scripts` after verifying its checksum. The installed CLI runs on Node and has no npm runtime dependency tree. There is no hidden postinstall native build or sign-in.

Configure a local MCP client after installation:

```json
{
  "mcpServers": {
    "groovectl": {
      "command": "groovectl",
      "args": ["serve"]
    }
  }
}
```

If a graphical client cannot find the command, use an absolute Node path and `args: ["/absolute/path/to/Groovectl/dist/cli.js", "serve"]`. Restart/reconnect the client. Keep credentials out of shared MCP configuration.

The portable plugin includes the server, skill and interactive studio for compatible local ChatGPT/Codex hosts. Ordinary MCP clients get the same useful tools and structured results without the UI. A local player needs an executor on its host. See [installation and release packaging](docs/releasing.md).

## Connect the route you use

| Route | What it provides | Setup and limits |
| --- | --- | --- |
| **Music.app on macOS** | Native library/playlists and transport, targeted playback, volume, seek, shuffle/repeat | Fixed automation operations; approve Music automation. The optional Swift helper has a separate install/qualification path. |
| **Apple Music API** | Cross-platform catalog, personal library, discovery and reviewed account writes | Your MusicKit key; personal data requires Apple authorization. No desktop playback through REST. |
| **Cider** | Targeted catalog playback, transport and queue | Cider's authenticated loopback API and application token. Live behavior depends on its version/host. |
| **Apple Music on Windows** | Experimental media-session transport and seek | An interactive Apple Music session. No targeted play or session-volume control through this adapter. |
| **API-only / VPS** | Catalog/library and curation without a desktop player | Select `none`; Linux defaults to it. Does not control a player on another computer. |

Native Mac playback needs no MusicKit key. For catalog and personal-library tools:

```sh
groovectl setup
groovectl authorize
```

The [MusicKit guide](docs/musickit.md) explains Media ID/key creation, local key protection, Apple sign-in and troubleshooting. Groovectl never needs your Apple password or private-key contents in chat.

Choose a player deliberately with `groovectl select-player native`, `windows`, `cider` or `none`. Cider uses `groovectl setup-cider`; keep API authentication enabled. The optional Mac helper uses `groovectl install-helper` and requires Apple's toolchain. Public prebuilt helpers need signing/notarization; source builds use ad hoc signing.

```sh
groovectl doctor --probe
groovectl call get_capabilities
groovectl tools --profile curator
```

Profiles `full`, `catalog`, `curator` and `player` reduce tool exposure. They are not account permission boundaries; inspect individual annotations. Basic Windows/Cider controls have live receipts; further player, provider and write paths retain separate qualification. Read the [platform guide](docs/platforms.md) before assuming parity.

## A good mix. A clear receipt.

Playlist changes follow **resolve → preview → claim → apply once → verify**. The private journal saves accepted IDs before readback. Successful repeated apply returns its saved result. An uncertain or interrupted write stays blocked; it is never blindly replayed. Existing target edits require a fresh preview.

Chapter annotations stay local and are attached only while the saved recording order still matches. JSON exports preserve current stories; imports and snapshot restores revalidate every recording. Native deletion is limited to an unchanged playlist created by this integration, with an explicit deletion request and its exact name.

There is no raw AppleScript, shell or arbitrary HTTP tool. Missing BPM/key/energy and listening-history coverage are never invented. Your agent receives the results it requests; your chosen image provider receives the creative prompt. Local attempt caps do not measure your provider's actual quota.

[Security](SECURITY.md) · [Privacy and data flows](PRIVACY.md) · [Architecture and safety contracts](docs/architecture.md)

## Build, operate, contribute

```sh
bun run check
bun run build
bun run test
```

Use `bun run test`, which runs Node's test runner; `bun test` does not provide the same SQLite runtime. The retained Python reference and 14 regressions live in `server/` and have a separate validation path. Native helper builds/tests use the shared resource gate. Portable tests do not substitute for live account/player checks.

The independent **Astro 7 + Svelte 5 + Starlight** website includes an account-free brief composer, self-hosted fonts, generated search and responsive original artwork. [Website development](site/README.md) and [Cloudflare/VPS deployment](deploy/README.md) cover static artifacts, private routing, SSH stdio, persistent storage, health, upgrades and recovery. The website contains no writable account endpoint.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), the [development plan](docs/development-plan.md) and [release procedure](docs/releasing.md). Report reproducible bugs with synthetic evidence; never attach your private data directory or raw logs. [Support](SUPPORT.md) · [Code of conduct](CODE_OF_CONDUCT.md)

## Credits

MIT licensed. Matching, sequencing and automation foundations retain notices from [Z-Han-Z/apple-music-playlists](https://github.com/Z-Han-Z/apple-music-playlists) and [epheterson/applemusic-mcp](https://github.com/epheterson/applemusic-mcp). See [third-party notices](THIRD_PARTY_NOTICES.md). Original branding/artwork has [recorded provenance](assets/brand/PROVENANCE.md). Groovectl is independent of Apple and Cider.
