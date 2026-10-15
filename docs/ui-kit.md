# Groovectl UI kit

Source implementation, October 15, 2026. The 0.6.0-rc.1 candidate powers Library and the player with reusable Svelte 5 components inside the existing TypeScript MCP App. Public 0.5.2 and actual-host qualification remain separate checkpoints. The website retains its separate design system; Studio's existing forms and write flows are preserved.

## Implemented slice

`ui/components/` owns Button, IconButton, Artwork, CollectionTile, TrackRow, ConnectionStatus and PlayerBar. `CollectionBrowser.svelte` combines them into the selected collection-browser structure; `QueuePanel.svelte` provides a read-only Cider queue dialog with native focus handling. Pure recording normalization and collection/playback controllers remain independent of Svelte.

Library reads API playlists, songs, albums, artists and recently added pages, or Music.app playlists when that adapter is selected. Grid/list, loaded-item filter/sort and selection persist across destination changes. It loads 100 API resources at a time, up to 1,000 per app session; playlist detail reads at most 2,000 recordings and initially renders 100 rows. Selection carries at most 200 exact source/ID pairs into the existing Studio, preserving the brief and refusing to alter a sequence with listening-story constraints. It does not create a playlist or start playback.

Artist details show albums from the personal library; opening an album shows its library songs. Back restores the already loaded artist page and moves focus to its heading. The same inspector and row components serve these paths. Relationship pages load explicitly, 100 at a time up to 1,000 related items; errors preserve loaded rows and selection, and retry retains navigation history. A catalog alias never replaces the library recording ID to enable a player button.

The persistent player consumes observed state and live capabilities. Previous/next, one play/pause action, time/seek and volume are enabled only when supported. Missing time/volume stay unknown. Commands use adapter readback, with no automatic command retry. Visible documents refresh status every 15 seconds; full workspace histories are not polled. Queue availability follows the negotiated tool profile. Artwork URLs are restricted to Apple's CDN, with named fallbacks.

Build the account-free gallery with `bun run build:gallery /absolute/output-directory`, after `bun install --frozen-lockfile`. Open the generated `gallery.html` through an isolated static server. It uses the actual components, synthetic recordings and an original example cover; it has no account connection. `node ui/build-harness.mjs /absolute/output-directory` additionally builds the synthetic MCP Apps host after `bun run build`. These previews do not qualify the real ChatGPT/Codex host.

## Implementation recommendation

Use Svelte 5 for the new app components, matching the website's existing UI language/tooling. Keep recording identity, playback presentation, sequencing and host adapters in typed framework-independent modules. Migrate one proven vertical slice; do not rewrite the server or replace the current studio in one pass.

Use native buttons/inputs where they suffice, and selectively adopt [Bits UI](https://bits-ui.com/docs/introduction) for interactions that need accessible focus/keyboard behavior, such as menus, dialogs, comboboxes and sliders. It is an unstyled Svelte primitive library; verify the integrated result rather than treating a dependency as an accessibility receipt.

Use a small, explicitly imported subset of [Lucide's Svelte icons](https://lucide.dev/guide/svelte). The current official package is `@lucide/svelte`; pin its reviewed version during implementation rather than installing an old package name from memory. Preserve its [ISC notices](https://lucide.dev/license). The OpenAI [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines) provide an optional host UI kit and Figma library as reference; the Groovectl kit is our own music-specific implementation.

The source pins Svelte 5.57.2 and `@lucide/svelte` 1.57.0, with bundled MIT/ISC notices. Native controls suffice for this slice; Bits UI remains an option when a concrete menu/combobox interaction needs it. The broader component tables below are target coverage, not a claim that all variants or Studio components have migrated.

## Layers

| Layer | What it owns | What it does not own |
| --- | --- | --- |
| Semantic tokens | Host-aware surfaces/text, raspberry action/selection, focus, borders, spacing, density, radii, typography and motion | Route-specific positioning or album-art colors that erase contrast. |
| Primitives | Button, IconButton, Input, Textarea, Checkbox, Select, Menu, Dialog/Sheet, Tabs, Slider, Tooltip and Status | Direct calls to Apple/Cider or a hidden dependency on the host global. |
| Music components | Artwork, TrackRow/Table, AlbumTile, PlaylistHeader, PlayerBar, PlaybackTimeline, VolumeControl, QueueList and SourceBadge | Invented availability, timestamps, exact versions or queue operations. |
| Studio components | BriefField, SuggestionChoice, Keep/Reroll controls, CandidateTray, ChapterList, AnchorMarker, RecordingAlternates, CoverVariant and Receipt | Rewriting the original brief or silently applying music changes. |
| Host adapter | MCP tool/resource calls, advertised display modes, selected-item context, UI state, file bridges and theme | Core music logic or account credentials. |
| App state | Route/query/selection, bounded result pages, command state, draft selection and stale-response guards | A second copy of the durable mutation journal or an unbounded listening-history cache. |

## Component slice to build first

| Component | Required variants/states | Acceptance behavior |
| --- | --- | --- |
| `Icon` / `IconButton` | 16/20/24 presentation sizes; default/hover/focus/disabled/pending | Consistent SVG stroke; decorative icons hidden; icon-only actions have a name. Size of drawing is separate from target size. |
| `Button` | Primary, secondary, quiet and consequential action; pending/error | Preserves focus, prevents duplicate pending action, states the actual operation. |
| `ConnectionStatus` | Player / catalog-library / artwork independently | A working local player is not called disconnected because MusicKit is missing. A saved token is not proof of a successful live API read. |
| `Artwork` | Real cover, loading, unavailable and explicit fallback | Stable aspect ratio; correct title/alt context; no fabricated cover or inferred recording identity. |
| `TrackRow` | Selected, focused, currently playing, unavailable, explicit and alternate version | Separate selection/play/menu; stable typed key; title, artist, album, duration and source at the appropriate density. |
| `AlbumTile` | Artwork/title/artist/year where known; loading/unavailable | Click opens detail; play is an explicitly named action, never a side effect of browsing. |
| `PlayerBar` | Playing/paused/stopped/closed/unavailable; compact/wide | Names the output player; missing metadata does not become “Nothing playing”; only supported actions are enabled. |
| `PlaybackTimeline` | Observed time/duration, unknown, unsupported, pending seek | Never synthesizes zero or successful seek; keyboard/time labels; visible target during drag, readback afterward. |
| `VolumeControl` | Known/supported, unsupported, pending/error | No fake 50% thumb when unavailable; bounded command cadence; final value comes from readback. |
| `QueueList` | Cider queue, unavailable, loading, partial/truncated | Distinguish now/next/later; no reorder/remove button until backend support exists. |
| `Receipt` | Ready/applying/applied/accepted/unknown/needs-review | Preserves actual result and uncertainty; inspectable detail; no duplicate-apply shortcut. |

Follow with search/filters, selection toolbar, scoped command menu and the reusable interview/cover components. Do not build a broad generic enterprise component catalog before these music journeys need it.

## Tokens and icon semantics

Host theme variables feed application background, raised surface, text, muted text, separators and font. Original Groovectl color remains on selected navigation, primary actions and the listening-story accent. Maintain explicit text/focus colors for both host themes; do not import the website's serif display scale or olive composer background across every app surface.

Icons have one role per concept: play/pause/skip for transport; list-music for queue; disc/album and library for browsing; sparkles or wand only for an explicitly creative action; lock for Keep; refresh for Reroll; external-link for leaving the host. A service's name is text unless a properly licensed brand asset is needed. Do not use Apple SF Symbols as a cross-platform web font by assumption, or emoji as the icon system.

Selection, playback and pending writes must be visually distinct. An animated equalizer cannot be the only playing indicator. Use color plus icon/text, tabular time numerals and readable truncation with full names available to keyboard/touch users. Motion clarifies track/queue selection and transient feedback; it never moves transport targets or blocks reading. Respect reduced motion and avoid idle decorative animation.

## Component gallery and review

Ship an account-free development gallery, built from the same components as the app, with synthetic recordings and explicit fixture labels. It is not a fake connected library. Include wide fullscreen, the supplied split-panel scene, 640-pixel panel and 390-pixel phone layouts; host light/dark; 200% zoom; keyboard focus and long/non-Latin content.

Stories cover empty/error/loading/partial/unsupported/pending states, not just one perfect album. Exercise focus restoration, pointer and keyboard alternatives, stale reads, route changes during a command, disconnected recovery and preserved brief text. Run browser checks against actual components, followed by real-host tests; a gallery screenshot cannot close an extension-host gate.

Implement a small ownership boundary such as `ui/components`, `ui/state`, `ui/host` and `ui/gallery` when the first slice lands. Keep the existing server tool names, journal schemas, source namespace types and plugin identity. Export the components actually used; a package boundary or monorepo is optional until another consumer needs it.

See [dashboard brief](design/library-player-brief.md) for the proposed screen composition and [Extensions capabilities](extensions-capabilities.md) for platform boundaries.
