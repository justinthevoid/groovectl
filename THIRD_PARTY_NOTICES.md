# Upstream components

Groovectl is the TypeScript successor to Apple Music Hybrid. The original Python
reference remains in `server/`. `src/flow.ts` ports the matching/adjacency rules;
Swift and TypeScript use the fixed, escaped Music operations described below.
Standalone distributions retain the original MIT notices in `licenses/`.

Both Apple Music sources are available under MIT. Their license notices are kept
beside the vendored source and travel with the plugin package.

- [epheterson/applemusic-mcp](https://github.com/epheterson/applemusic-mcp),
  commit `6226528a37e8fa7e0ec72e3e96dd280bef20d532`, v0.20.3.
  `vendor/applescript.py` is preserved as the native automation helper. This server
  uses its runner, string escaping, and bounded playback commands. It adds stable
  persistent-ID addressing instead of exposing upstream's name-based write tools.
  Notice: `server/src/apple_music_hybrid/vendor/LICENSE-epheterson`.
- [Z-Han-Z/apple-music-playlists](https://github.com/Z-Han-Z/apple-music-playlists),
  commit `12f82de01282207c0ec1126ba85ac53aae387d26`, v1.6.1.
  `vendor/playlist_core.py` supplies portable adjacency/tempo checks;
  `vendor/catalog_matching.py` supplies title/artist grounding and version checks,
  with its import changed to package-relative. The host supplies taste and story;
  no extra LLM call or third-party audio-feature request is made.
  Notice: `server/src/apple_music_hybrid/vendor/LICENSE-Z-Han-Z`.

Current dependencies are locked in `bun.lock`; historical dependencies remain in
server/uv.lock and ui/package-lock.json. The app bundles
the official MCP Apps and OpenAI Extensions browser libraries, retaining their
license comments. Complete notices are in `UI_THIRD_PARTY_LICENSES.txt` and
`SERVER_THIRD_PARTY_LICENSES.txt`. Active TypeScript uses MCP SDK 2.3.1 and OpenAI
Extensions 0.2.0. Historical Python uses MCP SDK 2.2.0.
The browser Apps bridge uses the officially recommended 1.x client SDK (1.32.1,
patched for GHSA-6qxp-vccf-f47h), while the server is SDK 2.x.

# Current plugin precedents

Checked on October 13, 2026:

- [OpenAI Bits & Bolts](https://github.com/openai/mcp-extensions/tree/main/plugins/bits-and-bolts)
  demonstrates local MCP, sidebar/thread entrypoints, and a bundled app view.
- [Viticci RemCTL](https://github.com/viticci/remctl) ships a native Mac controller,
  MCP tools, and a Codex Reminders workspace using the OpenAI Extensions library.
- [AgentScope ReMe](https://github.com/agentscope-ai/ReMe/tree/main/integrations/codex)
  includes a Codex plugin and status app using the same Extensions package.

These are actual plugin/extension examples; ordinary MCP repositories are not
evidence of ChatGPT Extensions support.

`@cfworker/json-schema` 4.1.1 omits a standalone license in its npm package.
Its upstream MIT license (Copyright 2020 Jeremy Danyow), retrieved from
https://github.com/cfworker/cfworker/blob/master/LICENSE, is retained in
`licenses/cfworker-json-schema-LICENSE` and the server bundle notices.

The optional public website has an independent frozen `site/bun.lock`. Its build
generates `THIRD_PARTY_LICENSES.txt` and `dependency-inventory.json` in the static
output, including the SIL Open Font Licenses for self-hosted Fraunces and DM Sans.
That inventory describes the inclusive installed build tree, not only code served
to browsers. Original project artwork and its generation provenance live in `assets/`;
no third-party album covers or artist portraits are used as branding.
