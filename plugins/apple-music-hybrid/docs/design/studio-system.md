# Groovectl MCP App studio system

## Overview

This records the ordinary 0.5 studio extension of the existing 0.4 MCP App. It is scoped to `ui/template.html` and `ui/workspace.ts`. The root `DESIGN.md` and `.impeccable/design.json` describe the public website and remain separate.

The incumbent comparison is commit `2884ea97178053da6fc3942f66a73baaf97d0d6a`. The current template's complete stylesheet matches that commit. Story details, constraint controls and capability messages extend the existing interface without introducing a new palette, type scale, surface family or navigation model. Styling values remain owned by the template; this document does not introduce another token source.

## Colors

The light app retains cream background, white working surfaces, dark ink, muted warm gray, raspberry actions and pale raspberry selection. Dark mode retains charcoal surfaces, pale ink and a lighter pink accent. Dividers and quiet fills use the incumbent neutral variables. The extension uses these roles for its added text and controls.

The studio brief's cream, raspberry and olive identity describes the inherited product direction. The incumbent app does not define the website's olive working-surface token. This extension does not add one or import the website palette.

## Typography

The source retains its system font stack and existing hierarchy: body text at 15px/1.5, stage headings at 21px, subsection headings at 17px, recording names at 14px and supporting metadata at 12–13px. The listening-story summary uses the existing subsection heading and paragraph treatment. Preview details use the existing plan heading and paragraph treatment.

This is an observation of the incumbent, not a new display-type direction. The extension adds no font dependency or type role.

## Layout

Keep Studio, Library and Activity as the workspace views, with Brief → Recordings → Sequence → Cover inside Studio. The player remains fixed at the bottom. Desktop retains the centered 1180px working area, main panel and divided aside. At 760px the aside follows the panel; the existing 430px and 600px rules handle compact navigation, fields, track actions and idea choices.

Story details appear above the ordered recording list. Sequence actions follow the list in a wrapping action row; the saved preview follows those actions in normal flow. Long constraint labels wrap on phones. No overlay or separate story editor is introduced.

## Elevation & Depth

The incumbent app is flat: tone, a thin border and spacing distinguish surfaces. Panels, list dividers and the fixed player retain that treatment. The extension adds no shadow, animation or raised container. Existing reduced-motion rules remain in place.

## Shapes

The extension reuses the existing rounded controls, panel corners, thin borders and numbered stage markers. Story information is an unboxed section within the panel. Preview information remains within the existing plan section.

## Components

### Listening story

Show each chapter's recording range, preserved-order state and supplied purpose as text. Show pinned positions with recording names. Show the runtime target and tolerance, known duration and missing-duration state. Missing durations remain unknown; the interface does not invent audio features or imply that the sequencer discarded recordings to meet a target.

### Sequence actions

The existing ordered rows retain title, artist and album metadata. Chapter or anchor constraints disable manual moves and removal. The explicit “Remove chapter, anchor and runtime constraints” action clears the current draft's story and invalidates its preview; its status message states that saved plans and Apple Music are unchanged. Adding a recording to a story-constrained mix directs the user back to Sequence with the same explanation.

“Space artists” passes the retained story to the sequencer. The result reports remaining artist-spacing conflicts and asks the user to inspect the flow before saving a preview. “Save playlist preview” retains the story in the new preview. Its existing primary-action style is reused.

### Saved preview

Keep chapter and anchor details beside the plan's ordinary state and duration summary. Expandable recording inspection includes album metadata. A separate apply action is available only for a ready plan when its tool is exposed by the connected profile. The preview itself does not change Apple Music. Keep uncertain states explicit and retain the existing instruction to inspect the library before acting again.

### Capabilities and recovery

Use the existing Connection note and player status text to explain profile and backend limits. Disable actions whose tools or player capabilities are unavailable. API-only hosts show no player selected; a profile that excludes playback says so. Local image-request caps remain distinct from live account quota readings.

Search failure retains previous results and reports the failure in the search area and existing live status region. Form and draft content remain available for recovery. The added story and sequence-result regions use polite live announcements; focus styling, disabled styling and track-specific accessible action names retain their incumbent implementation.

## Do's and Don'ts

- **Do** extend the current panel, text, action and status patterns for this workflow.
- **Do** retain exact recordings, inspectable constraints and separate preview/apply steps.
- **Do** state unavailable capabilities and uncertain outcomes in text.
- **Don't** import website typography, olive surfaces or page composition as MCP App defaults.
- **Don't** treat synthetic data, a ready preview or an accepted write as verified account completion.

Evidence checked: current template and workspace source, the incumbent template at the commit above, `PRODUCT.md`, `studio-brief.md`, and the supplied desktop story/preview, phone guard/controls/preview, dark catalog and headless search-error captures. The captures use the MCP Apps development host with synthetic tracks and mutations. They show those captured appearances; they do not establish installed ChatGPT behavior, live playback, account writes or image generation. Source remains a 0.5 candidate; this record supplies no ship verdict.

Incumbent drift retained separately: uppercase eyebrow labels, text-glyph move arrows and system-font display headings predate this extension. They are recorded as existing source, not promoted into new visual rules or repaired here. Website documentation and its pre-existing process qualifications remain untouched.
