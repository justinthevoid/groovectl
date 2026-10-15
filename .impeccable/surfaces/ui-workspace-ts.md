---
version: 1
slug: "ui-workspace-ts"
primary_target: "ui/workspace.ts"
related_targets: ["ui/components","ui/CollectionBrowser.svelte","ui/gallery.ts"]
---

# Collection browser implementation

October 15, 2026. Operate mode. Justin selected the Collection browser from the three proposed structures: a library rail, grid/list, optional inspector and persistent player. Keep Studio's existing brief, constraints and reviewed writes. This first slice uses existing MCP tools; album/artist library relationships and embedded streaming remain later work.

## Direction contract

THESIS: A collection becomes material for a mixtape. Opening a playlist reveals its exact recordings; selecting them carries them to the preserved Studio. Playback is a separate explicit action.

OWN-WORLD: Inherit Groovectl's wordmark, raspberry selection and host-aware neutral surfaces. System UI typography, Lucide line icons, aligned recording rows and square artwork form the component language. No website hero or editorial display scale.

STORY: Understand which collection is being read and which device is controlled. Inspect a playlist, choose recordings, then continue the mix in Studio without writing to Apple Music.

FIRST VIEWPORT: At desktop width, a compact category rail sits beside an artwork grid; the detail inspector takes space only when opened. Search and view controls sit above content. A named device and capability-driven transport stay anchored below every destination. At phone width, the rail becomes a labeled category selector and detail replaces the grid.

FORM: Collection browser, first of the three confirmed structures; code-led extension of the existing app. Signature interaction: an explicit selection tray carries exact source identities into Studio. seed: none (user-pinned structure; no concept roll was run). No QUALITY BAR card was produced; card-level comparison is unqualified, and no receipt is claimed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Scope and proof

Build shared controls, artwork, collection tiles, recording rows, connection status and player, with an account-free gallery. API categories paginate honestly; native Music.app offers its real playlist route. Library-only album/artist detail gets an explicit limitation, never a fabricated catalog substitution. Validate browser interaction with synthetic fixtures before claiming any live host qualification. Real account writes are outside this slice.
