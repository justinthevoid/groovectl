# Library and player dashboard: proposed next cycle

Working brief, October 15, 2026. The user confirmed **polished Music.app/Cider control first**, then selected the **Collection browser** structure. Its first Svelte Library/player slice is implemented in source; the installed/public prerelease remains 0.5.2. This document also contains later scope, not a claim that every screen or live path is qualified. See [UI kit](../ui-kit.md) for implemented boundaries.

## Job, audience and outcome

An agent user wants to listen, browse their collection and make something personal without juggling a chat, a form and a separate library search. The interface should feel like a useful music application: inspect a record, play it on the chosen player, select a few recordings and ask the agent to turn them into a mix. Visitor mode is Operate.

The main creative journey stays **brief → recordings → sequence → cover**. Library and playback are destinations in the same application, not four additional steps in the interview. Browsing or changing tabs never starts playback, clears a brief or sends a message.

Success means finding an album/playlist, seeing the exact recording and its source, using only controls the current player supports, returning to a preserved studio and understanding where the music is playing.

## Proposed application shell

- Primary navigation: **Studio, Library, Discover, Activity**. Setup/settings live in a persistent connection control. Keep Discover separate from the personal library; do not imply that recent tracks are a full listening history.
- Persistent bottom player: cover when available, title/artist, named playback device, one state-appropriate play/pause action, previous/next where enabled, observed position/duration, supported volume and a Cider queue affordance.
- Main workspace: changes with the route. A bounded inspector/queue opens beside it at wide sizes and as a focus-managed sheet at narrow sizes. It does not replace the chat composer.
- “Ask about this” passes selected resource identities, visible selection scope and a short request to the existing chat. “Use in Studio” updates a local draft/selection; it does not silently create a playlist or start a conversation.
- Global opening restores the last relevant app route; a fresh conversation opens Studio. An explicit deep link wins. Device/player selection must reflect real backend routing; the current server binds its selected player at startup, so a decorative device switcher would be misleading.

## Confirmed Library composition

These share the same product identity and component system. They vary structure, not palette.

1. **Collection browser (recommended):** stable left library rail, albums/playlists in the main grid or songs in a table, optional right inspector/queue, persistent player below. Closest to the familiar Apple Music task model; strong for large collections and repeated use.
2. **Listening desk:** selected album/playlist and its tracks lead; a compact collection browser sits alongside. Strong for focused listening, less efficient for scanning a large library.
3. **Cover shelves:** recently added and selected collection shelves lead into full detail routes; library categories stay compact. Strong for casual rediscovery, but needs a clear all-items path and truthful pagination.

Justin selected option 1, the collection browser, through the structured question. The implementation extends the existing app with code-led components and preserves Studio. Preserve Groovectl's recognizable wordmark, raspberry selection/action role and host-aware light/dark surfaces. Use artwork as content. Familiar music controls should work before decorative motion.

## Screens and existing tool coverage

| Screen | Core behavior | Existing tools / concrete gap |
| --- | --- | --- |
| Library overview | Recently added, songs, albums, artists, playlists; bounded pagination | `browse_api_library`, `search_api_library`, `list_playlists`. Native route can show supported local playlist/song reads without claiming a complete API-equivalent collection. |
| Playlist detail | Ordered rows, source/version details, runtime coverage, play/queue/selection | `get_playlist`, `get_catalog_recordings`, `control_playback`, `queue_catalog_song`. Read limit is 2,000 playlist tracks; a new write plan is limited to 200. Do not conflate them. |
| Album / artist detail | Exact album recordings, release alternatives and selected artist context | Catalog detail tools exist. Personal-library album/artist drilldown needs a typed library-item/relationship read; catalog IDs cannot stand in for library-only items. |
| Discover | Recommendations, recent resources, heavy rotation, catalog search/charts | Existing discovery tools; lazy sections, explicit provenance and account availability. Replay is its own bounded Apple result. |
| Studio | Brief or optional interview; candidate tray; chapters/anchors/order; cover lab | Existing studio, curation, artwork and inspected-plan workflows. Retain original intent, constraints, custom suggestions and selected exact versions. |
| Queue | Cider now/next/later, real capabilities and direct readback | Existing sanitized queue read and single-recording enqueue. Do not draw working reorder/remove/clear controls until those operations exist and are qualified. Music.app/Windows queue views stay unavailable. |
| Activity | Saved previews, pending/unknown writes and verified receipts | Existing compact plan summaries and inspectors. Playback commands do not need to generate permanent playlist journal cards. |
| Connections | Separate player, catalog/library and artwork readiness | Existing workspace/capabilities/readiness. Secret setup stays local. Runtime player switching needs a real backend lifecycle, not only a UI select. |

Reuse the existing 51 tools first. A cohesive typed library detail read is a justified gap. Position display, view switching, track selection, sorting a loaded page and opening a drawer do not need new MCP tools.

## Interaction contracts

**Playback.** UI state follows observed backend state. When metadata is missing but transport says playing, show “Track details unavailable” and the named playing device. A missing timestamp is unknown, never zero. Disable seeking without real position/duration support. Play/pause, seek and volume have pending/error/readback states; never optimistically report a successful command after a timeout or retry it automatically.

**Refresh.** Initially use a small playback-state read, at most one in flight, on action/readiness recovery and a bounded foreground timer. Suspend periodic reads when hidden/disconnected. The existing full-workspace refresh is not a per-second transport. A later subscribed state resource can avoid repeated process launches; feature-detect host events and retain a polling/manual fallback. Generation/sequence guards prevent older reads from overwriting newer observations. Queue fetches are independent and only active while needed.

**Library.** Preserve query, resource type, source namespace, pagination, sort and selection when navigating back. Sort loaded pages honestly; a global sort requires server/API support or a clearly bounded collection index. Cancel/ignore stale reads after a query/source change. Display missing/unavailable recordings without substituting another version. Selection and play are separate actions.

**Studio.** Selected library items become a candidate tray. Requested anchors remain pinned and visibly distinguishable. A sequence edits the original pool rather than replacing it with an opaque recommendation. Optional interview questions show suggestions, Keep, Random and Reroll; hard exclusions remain authoritative. The agent may provide fresh options, with a preview of what context will be sent. Cover variants retain provider, original output and cost/attempt information; applying artwork to Apple Music remains manual.

**Writes.** Library additions, favorites, ratings and playlist changes keep preview/claim/apply/readback. Queue and playback actions are distinct requested controls. A plan in applying/unknown state has an inspect action, never an invitation to blindly retry. Native/library/catalog identities stay typed through every UI interaction.

## Responsive behavior and accessibility

- Wide/fullscreen: visible app navigation, central library/studio, optional queue/inspector. Scope searches above their results; keep transport anchored without covering the last row or host composer.
- Conversation panel: collapse the secondary rail first, then inspector; preserve route/selection. Measure the panel width, not the desktop screen width. The supplied split-screen capture is a required target scene.
- Phone: single main column, compact player, accessible navigation menu and separate detail/queue route or sheet. No squeezed desktop table or permanent three-column layout.
- Inline: one selected recording/playlist summary or compact player with at most two primary actions; “Open Groovectl” moves deeper work to the app. Do not shrink the entire studio into a card.
- PiP: device, track, play/pause and return-to-app only; planned, capability-dependent. Never rely on PiP to keep a server/native player alive.
- Keyboard: ordinary table/list navigation, explicit selection/play controls, focus restoration, Escape for transient surfaces and commands scoped to the app. Space must keep its normal meaning in text fields and the ChatGPT composer. No global media shortcut hijacking.
- Visible focus, 200% zoom, screen-reader track/control names, long titles, non-Latin text, missing artwork, explicit badges with text equivalents, host theme changes and reduced-motion paths are acceptance cases.

## Working ranges and states

Start with 100-item API pages, a bounded loaded collection and 200-track studio/write plans. The UI must show large playlist/read limits without inviting a write beyond its limit. Test 0/1/100 visible items, the 2,000-track read boundary, long albums/titles and rapid route/query changes. Virtualize only when measured row counts/performance justify it, with accessible navigation preserved.

Treat each subsystem separately: player closed, running, paused, playing, metadata missing, position unknown, command unsupported, command pending, disconnected and stale; catalog unconfigured, library sign-in needed, authorization failure, empty library, filtered zero results and partial page; artwork unconfigured, queued, running, complete, failed, cooling down and quota unavailable. “Updated” is not sufficient feedback for every condition.

## Delivery sequence and proof

1. **Correct current state labels and gather read-only host evidence.** Fix the supplied “Nothing playing / playing” contradiction; distinguish catalog setup from player control. Record actual host/API readiness without moving credentials or changing listening state.
2. **Approve library composition and build the kit slice.** Implement tokens, icons, basic controls, track row, album tile, connection status and player bar in a component gallery using synthetic content. Confirm light/dark, keyboard, narrow panel and phone before migrating the shell. See [UI kit](../ui-kit.md).
3. **Connect real Library routes.** Implement paginated overview/playlist detail, explicit source routing, validated artwork and the minimal personal-library detail gap. Keep all music writes behind current contracts.
4. **Make the player feel continuous.** Bounded status updates, truthful timeline/volume, Cider queue and capability-driven actions. Qualify play/pause on Music.app and Windows; use a disposable/requested Cider queue for targeted playback/enqueue/next/previous/stop tests. Restoring shuffle does not prove exact queue order was restored.
5. **Add host-specific conveniences.** Compact inline/PiP, selected-item context, deep links, host settings and optional rich interviews. Qualify each capability in the real host and retain ordinary-client fallbacks.
6. **Release review.** Full type/test/build, portable packages, actual host journeys, privacy/license/CSP scans and source-bound CI. Preserve versioned 0.5.2 receipts; do not replace them with a design preview.

The next implementation checkpoint should prove an album/playlist browsing-to-playback-to-Studio journey. Do not implement every possible library view before that vertical slice works.
