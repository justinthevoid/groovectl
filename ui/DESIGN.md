---
name: "Groovectl app UI kit"
description: "Collection browsing and explicit player control in the optional Groovectl MCP App."
colors:
  bg: "#faf9f6"
  surface: "#fff"
  ink: "#24231f"
  muted: "#6d6a63"
  line: "#dedbd4"
  accent: "#a82646"
  tint: "#f6e9ed"
  soft: "#eeece6"
  dark-bg: "#191919"
  dark-surface: "#242424"
  dark-ink: "#f5f2ed"
  dark-muted: "#bcb7ae"
  dark-line: "#44413c"
  dark-accent: "#ff91ab"
  dark-tint: "#422a32"
  dark-soft: "#30302d"
typography:
  headline:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "28px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline-compact:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "25px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "20px"
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "13px"
    fontWeight: 500
  recording-title:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "13px"
    fontWeight: 600
  metadata:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "11px"
  input-mobile:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)"
    fontSize: "16px"
  button:
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif)"
    fontSize: "13px"
    fontWeight: 650
    letterSpacing: "normal"
rounded:
  control: "8px"
  artwork: "7px"
  row-artwork: "5px"
  collection-tile: "9px"
  dialog: "12px"
  transport: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  control-gap: "10px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  section: "22px"
  wide: "24px"
  page: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.artwork}"
    width: "36px"
    height: "36px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 10px 7px 35px"
  category-selected:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.artwork}"
    padding: "10px"
  collection-tile:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.collection-tile}"
  recording-selected:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    padding: "8px 3px"
  player-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "12px 28px"
  queue-dialog:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "24px"
    width: "min(560px, calc(100% - 28px))"
---

# Design System: Groovectl app UI kit

## Overview

**Creative North Star: "A collection becomes material for a mixtape"**

Groovectl’s app kit makes exact recordings easy to inspect, select and carry into Studio. It inherits the compact wordmark, raspberry selection and host-aware neutral surfaces already used by the app. System UI type, Lucide line icons, square artwork and aligned rows keep a music collection readable at desktop, panel and phone widths.

This document records the implemented Svelte slice in ui/components, CollectionBrowser.svelte, QueuePanel.svelte and kit.css. It does not replace the website system in the repository-root DESIGN.md. Studio’s existing imperative forms remain outside this migration; their older eyebrow styling and larger heading scale are not reusable kit rules. The account-free gallery uses the same components with synthetic music and actions.

**Key Characteristics:**

- Raspberry marks selection, focus and the primary handoff action.
- Neutral surfaces, fine dividers and spacing organize content without raised cards.
- Recording source identity, selection and playback remain separate.
- The optional inspector and persistent player adapt to available width and capabilities.

Source authority is [PRODUCT.md](../PRODUCT.md), the implemented app and the [Collection browser contract](../.impeccable/surfaces/ui-workspace-ts.md). The user selected this code-led structure. No concept roll or QUALITY BAR card was produced, so card-level comparison remains unqualified. The finish review reported no material visual defects after the queue/process corrections; that scoped verdict does not qualify the actual host or a release.

## Colors

### Primary

Raspberry identifies primary actions, current categories, selected toggles, focus and range controls. Its pale tint sits behind selected rows and navigation. Primary action text uses the light surface token; the explicit dark-theme rule switches it to the dark background token for contrast.

### Neutral

The warm background holds the collection; the surface token holds fields and the persistent player. Ink carries recording names and headings. Muted text carries artists, albums, time and connection details. Fine line dividers separate rows, regions and the player. Soft fills support hover and missing-artwork states.

The frontmatter records the app’s light and dark fallback palettes from theme.css. Both template.html and gallery.html use the __THEME_CSS__ insertion point; scripts/build.mjs and scripts/build-gallery.mjs inject that same source. The kit first accepts host background, text and border variables, then app variables, then its light fallbacks. The workspace applies host theme and style variables through the MCP Apps SDK. Preserve these semantic bindings. These are observed palettes, not a claim that every host-provided color combination has passed contrast testing.

**The Selection Rule.** Selection uses the accent and tint together, with a check, current-state attribute or outline as an additional cue. Color alone does not carry the selected state.

## Typography

The kit uses the host’s sans-serif family when provided, followed by the system UI stack. There is no separate display face. The frontmatter preserves the implemented role sizes and explicit weights; it does not impose a new type scale on the older Studio.

- **Headline:** compact collection titles; the phone role takes over at the narrow breakpoint.
- **Title:** inspector, empty-state and dialog headings. The playlist title becomes slightly larger on the phone layout (21px).
- **Body and labels:** compact control and explanatory text, with muted labels and stronger action text.
- **Recording title and metadata:** a single-line name above the artist and album. Long content truncates visually; title attributes retain the full source strings. Do not substitute alternate metadata to fit.
- **Time:** small tabular numerals keep duration and timeline values aligned. Unknown values display an em dash; a missing timeline additionally says “Time unavailable.”

The gallery’s larger introductory heading is gallery presentation, not an app display role.

## Layout

The Collection browser uses a category rail beside a flexible collection region. The normal desktop rail is narrow (166px), with a generous inter-region gap (26px). Opening details adds an inspector with its own divider and a minimum readable width (330px). The surrounding library page is bounded (1440px) and uses the page padding recorded in the frontmatter.

At the panel breakpoint (1050px), details replace the collection grid while the category rail remains. At phone width (680px), a labeled category select replaces the rail; the collection uses two equal artwork columns, and open details occupy the main content area. Search, loaded-item sort and grid/list controls wrap. Opening details moves focus to its heading; closing returns focus to the triggering item, with search as fallback.

The browser reuses small control gaps, larger row gaps and section spacing. The desktop artwork grid auto-fills from a minimum tile width (138px), narrows in the inspector composition, and becomes two columns on the phone. Recording rows stay aligned with a minimum height (66px), an index column, flexible metadata, time and explicit action buttons.

The player is fixed in the app footer across destinations. Its desktop layout has metadata, transport and tools columns; panel width moves tools to a second line. Phone width compacts artwork and controls, retains the timeline or explicit time-unavailable row across the full width, and places supported modes and other tools beneath. ResizeObserver measures the footer into --groovectl-player-height. The library reserves that height plus clearance (24px); the selection tray sits above it with a small gap (8px). Scroll margins protect focus targets from the header and player. Static fallback heights are boot-time fallbacks, not new fixed layout targets.

**The Measured Footer Rule.** Reserve space from the observed footer height. Keep the selection tray above the player and keep keyboard targets clear of the sticky header and fixed footer.

## Elevation & Depth

The kit is flat at rest: no component box-shadow vocabulary is defined. Background, surface, soft fill, borders and spacing establish depth. The category rail and inspector use dividers rather than raised panels. The native queue dialog uses a translucent black backdrop to separate its modal layer. Browser-native dialog behavior supplies modality.

Artwork alone lifts slightly on pointer hover (2px). Buttons shift on press (1px). These are small state cues, not a general elevated-card rule. Reduced-motion preferences disable kit transitions, animations and smooth scrolling.

## Shapes

Artwork remains square and clips to gently curved corners. Recording and player artwork use compact variants. Controls and fields share softly rounded corners; icon buttons are slightly tighter. The central play/pause control is circular. Collection tiles have no surrounding card fill or border; image and text form the tile. Recording rows use straight dividers. The queue dialog has the largest container radius. Preserve the frontmatter’s observed shapes rather than adding a universal radius.

## Components

### Buttons and icon buttons

Text buttons provide primary, secondary and quiet variants. They share a minimum height (40px), compact padding and an explicit pending state that disables the action and sets aria-busy. Primary uses raspberry, secondary uses a surface and fine border, and quiet removes the filled container and border. Hover uses soft fill or a darker accent mix; active text buttons move down slightly.

Icon buttons use Lucide SVGs, accessible names, titles and optional aria-pressed state. Their standard footprint expands on the phone, while view toggles and compact player tools keep their observed smaller variants. A visible focus outline (2px) with an outward offset (3px) applies across the kit. The focused inspector heading has extra offset. Disabled controls reduce opacity and do not acquire hover feedback.

Lucide’s Svelte package owns the line-icon vocabulary; its ISC notice is retained in [UI_THIRD_PARTY_LICENSES.txt](../UI_THIRD_PARTY_LICENSES.txt). Service names remain text. This slice introduces no proprietary icon font or second icon family.

### Fields and navigation

Search is a native search input with a decorative inset icon and a screen-reader label. Source, category and sort are native selects. Their surface, line border and control radius match the buttons. Filter and sort apply to loaded items, and the interface says so. The category rail uses a current-page attribute, tinted selection and paired text/icons. The phone selector retains a visible “Collection” label. The grid/list control uses named icon buttons with pressed state.

### Artwork and collection tiles

Artwork is content, not decorative interface illustration. It loads an approved Apple artwork URL when available; failed or absent images use a disc icon and initial on the soft surface. Images are decorative beside the named tile or row and avoid redundant spoken labels. The player currently uses this fallback rather than claiming returned cover art.

The collection tile is one opening action with a square image, name and muted subtitle. Active artwork gains an accent outline. Opening a playlist or library album reads exact recordings; opening a library artist reads its albums. Hover does not expose an implicit play action. List mode uses compact artwork, metadata and a forward arrow in a full-width row.

When a next-page collection read fails, loaded items, selection and the open inspector stay available. “Try collection again” retries the failed page.

Artist albums reuse compact list rows inside the inspector; opening one shows its exact library songs. Back restores the loaded artist details and moves focus to the heading, preserving selection. Relationship pages load explicitly, 100 items at a time up to 1,000 related items. Read errors keep loaded rows and selection available, and retry preserves detail history.

The gallery imports the original Between Stations cover. Its fictional example status and generation provenance are recorded in [PROVENANCE.md](../assets/examples/PROVENANCE.md); it is not catalog artwork or a completed account playlist. No new raster is introduced by this system record.

### Recording rows and selection tray

Rows keep index, name, supplied explicit marker, artist/album, source, duration and independent actions aligned. Source labels may hide at narrow widths, but source identity stays in the data. Selection tint and check state are distinct from the separate play button. Unsupported playback is named where known; unknown duration remains unknown.

Targeted play appears only for a source ID accepted by the selected adapter and an available play action. Current routes accept native persistent IDs for Music.app and numeric catalog IDs for Cider. No library-to-catalog substitution is made. The selection tray carries exact source-plus-ID recordings into Studio, deduplicates by that identity and preserves the reviewed-write workflow. Handoff can refuse while Studio is busy or a constrained story is active; it does not silently discard those constraints.

**The Exact Recording Rule.** Keep source plus ID intact when a recording moves to Studio. Browsing, opening details and selecting a recording do not request playback or an Apple Music write.

### Player, connection status and queue

The labeled destination select offers supported local adapters and names the execution host. Selection reads state without playing or changing the saved default. It stays disabled during a command; failed switches clear the old track/actions until a fresh read. The phone select uses the 16px input-mobile role to avoid focus zoom. The scoped desktop/phone review confirmed the destination row and capability changes; it does not extend the older independent review to unrelated surfaces.

The player names its device and last observed state. Closed, unavailable, profile-limited and API-only states have explicit messages. A playing or paused Windows session without metadata says “Track details unavailable”; unknown artist/album fields do not become invented listening data. Time is shown only when reported, and seek requires a valid duration/position pair plus seek capability. Volume appears only when a value and volume capability both exist; otherwise it says “Volume unavailable.” Command errors retain the last observation and disable further commands until a fresh observation, including a scheduled read, clears the uncertainty. A late command response cannot replace a newer player observation.

Transport controls follow the current capability list and pending state. Shuffle/repeat controls show known observed modes with named next actions; unrecognized or missing modes stay unavailable. Range adjustments remain visible across background reads until submission, then show adapter readback. Collection/library connection status is independent of player status. Queue access appears only for Cider when the workspace advertises get_playback_queue; a later profile change closes the queue. Its native modal shows read-only current order, loading, error, empty and truncated states, with a separate refresh action. Opening it does not enqueue, reorder or start playback.

The synthetic gallery exercises components and player presentations without an account or real player. Browser captures establish only the captured fixture, viewport and theme. The actual ChatGPT/Codex expanded host, real account paths and each adapter’s targeted actions need their own qualification; this document grants none.

**The Capability Rule.** Render actionable controls from the current player and tool capabilities. Missing metadata, time, volume or resource relationships remain explicit unavailable states.

## Do's and Don'ts

### Do

- Do reuse the Svelte controls and scoped kit styles for new app surfaces.
- Do keep the reading source, recording identity and controlled player visible in their appropriate contexts.
- Do keep selection and targeted playback as separate labeled actions.
- Do preserve keyboard focus, reduced motion and measured player clearance at narrow widths.
- Do use the original gallery cover with its existing provenance and label synthetic data and actions.
- Do qualify the actual MCP App host and real player paths separately from source checks and the synthetic gallery.

### Don't

- Don’t import the website’s display typography or Studio’s legacy eyebrows into the kit.
- Don’t replace a library-only recording with a catalog candidate to make a control available.
- Don’t invent artwork, metadata, duration, volume, connected status or a completed account action.
- Don’t expose Cider queue access when the current profile lacks the queue tool.
- Don’t claim a QUALITY BAR comparison, actual-host qualification or release readiness from this documentation.
