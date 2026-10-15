---
name: "Groovectl website"
description: "Observed cream, raspberry and olive visual system for the Groovectl public website."
colors:
  paper: "#faf7ef"
  ink: "#29291f"
  muted: "#626151"
  berry: "#a82646"
  berry-dark: "#841d36"
  olive: "#41472e"
  line: "#d4d0c2"
  wash: "#f0ecdf"
  studio-heading: "#fbf7e9"
  studio-muted: "#e0e2cf"
  field-paper: "#f7f4e9"
  studio-control: "#fff8e9"
  studio-line: "#8a9075"
  studio-button-line: "#a6ac8d"
  studio-hover: "#59603e"
  focus-on-olive: "#e7b3a8"
  docs-light-accent-low: "#f6dce3"
  docs-light-accent-high: "#6a1830"
  docs-light-ink: "#25251f"
  docs-dark-accent-low: "#45202b"
  docs-dark-accent: "#e96987"
  docs-dark-accent-high: "#f9d7e0"
typography:
  display:
    fontFamily: "\"Fraunces Variable\", Georgia, serif"
    fontSize: "clamp(3.2rem, 5.1vw, 4.6rem)"
    fontWeight: 570
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "\"Fraunces Variable\", Georgia, serif"
    fontSize: "clamp(2.3rem, 4vw, 3.5rem)"
    fontWeight: 570
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  title:
    fontFamily: "\"Fraunces Variable\", Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 570
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  body:
    fontFamily: "\"DM Sans Variable\", sans-serif"
    fontSize: "1.1rem"
    lineHeight: 1.6
  label:
    fontFamily: "\"DM Sans Variable\", sans-serif"
    fontSize: "0.95rem"
    fontWeight: 650
    lineHeight: 1.4
  field-label:
    fontFamily: "\"DM Sans Variable\", sans-serif"
    fontSize: "1rem"
    fontWeight: 620
  brief:
    fontFamily: "\"Fraunces Variable\", Georgia, serif"
    fontSize: "1.3rem"
    lineHeight: 1.55
  small:
    fontFamily: "\"DM Sans Variable\", sans-serif"
    fontSize: "0.83rem"
    lineHeight: 1.5
  brand:
    fontFamily: "\"DM Sans Variable\", sans-serif"
    fontSize: "1.55rem"
    fontWeight: 720
    letterSpacing: "-0.04em"
rounded:
  cover: "2px"
  scene-label: "4px"
  control: "10px"
  button: "12px"
  artwork: "14px"
  panel: "16px"
spacing:
  answer-gap: "0.5rem"
  action-gap: "0.8rem"
  inline-gap: "1rem"
  question-stack: "1.4rem"
  grid-gap: "2rem"
  studio-gap: "4rem"
  wide-gap: "6rem"
  button-inset: "0.75rem 1.15rem"
  panel-inset: "1.7rem"
  panel-inset-mobile: "1.3rem"
  section-block: "88px"
  section-block-mobile: "56px"
components:
  button-primary:
    backgroundColor: "{colors.berry}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-inset}"
  button-primary-hover:
    backgroundColor: "{colors.berry-dark}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-inset}"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
  button-studio-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.studio-control}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-inset}"
  button-studio-secondary-hover:
    backgroundColor: "{colors.studio-hover}"
  button-reroll:
    backgroundColor: "transparent"
    textColor: "{colors.studio-control}"
    rounded: "{rounded.control}"
    width: "48px"
  button-motion:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "0.4rem 0"
  select:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.75rem 2rem 0.75rem 0.8rem"
  exclusions-field:
    backgroundColor: "transparent"
    textColor: "{colors.studio-control}"
    rounded: "{rounded.control}"
    padding: "0.7rem 0.8rem"
  brief-output:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-inset}"
  navigation:
    textColor: "{colors.ink}"
---

# Design System: Groovectl website

## Overview

**Creative North Star: "The independent record shop"**

Warm paper, compact sans-serif controls and generous serif headlines frame original music artwork. The site feels editorial and tactile: thin dividers organize the page, raspberry identifies actions, and olive provides a distinct working surface for the brief composer. In the hero, a vinyl record, paper sleeve, flowing tape and two covers form a sculpture that separates and reassembles with scrolling.

This is a scan of the implemented website, not a product-wide identity specification. It covers the landing page, brief composer and explicit Starlight overrides. It does not govern the MCP App. The north-star phrase and atmosphere language are descriptive and provisional. The unattended implementation did not establish a user-selected comp or a public seed reference; the later direction roll does not replace that missing pre-implementation workshop. The user subsequently selected the surreal record-sculpture direction and requested the exploded motion recorded in [the motion brief](docs/design/site-motion-brief.md); that selected artwork direction is not a full-page comp approval. Documentation records observed design, not whole-surface ship approval. See [the website brief](docs/design/site-brief.md) for the process record.

**Key Characteristics:**

- Cream paper and dark ink support long reading; raspberry distinguishes actions.
- Fraunces supplies headings and the composed brief; DM Sans supplies prose and controls.
- Flat interface surfaces use thin dividers and tonal changes, while imagery carries physical texture.
- Five independent hero layers supply depth and scroll motion; body copy and setup links remain readable.
- The brief remains selectable, wraps naturally and grows with its content on narrow screens.

## Colors

The palette combines warm neutrals with a raspberry action color and an olive working surface. The frontmatter preserves the source hex values; the names below explain their use. The sidecar's eight-step tonal ramps are synthesized panel previews, not observed CSS tokens or a prescribed production scale.

### Primary

- **Raspberry** (`berry`): primary actions, link hover, selection and keyboard focus on paper.
- **Deep raspberry** (`berry-dark`): primary-action hover.

### Secondary

- **Record-sleeve olive** (`olive`): the brief composer's full-width working surface.
- **Olive hover** (`studio-hover`): hover feedback for outlined actions on that surface.

### Neutral

- **Cream paper** (`paper`): the landing page and brief output panel.
- **Dark ink** (`ink`) and **muted ink** (`muted`): main text and supporting explanations.
- **Paper divider** (`line`) and **paper wash** (`wash`): separators, outlined actions and the safety panel.
- **Studio heading**, **studio muted** and **studio control**: pale text tones on olive, kept in their existing heading, supporting-copy and control roles.
- **Field paper**: the native select surface. **Studio line** and **studio button line**: the existing distinct strokes for fields/reroll controls and the outlined studio action.
- **Focus on olive**: the warm light outline used around controls on the olive surface.

Starlight shares the raspberry action color and paper background in light mode. Its light accent-low, accent-high and ink values are separate source overrides. Dark documentation has its own accent-low, accent and accent-high values. These do not establish a dark theme for the landing page. Starlight's remaining theme values belong to the library, not this extracted palette.

**The Surface Focus Rule.** Use the raspberry focus outline on paper, including the paper panel inside the olive section. Use the warm light outline on the olive working surface. The nested paper panel must restore its own focus color.

## Typography

**Display and headline font:** self-hosted Fraunces Variable, with Georgia and serif fallbacks.

**Body and control font:** self-hosted DM Sans Variable, with a sans-serif fallback. There is no custom monospace family in the scanned website styles.

The pairing is expressive in headlines and quiet in operational copy. It uses observed role sizes rather than a single mathematical scale.

- **Display:** the landing hero uses `display`. Between 761px and 1080px it uses `clamp(2.7rem, 4.8vw, 3.5rem)`; at 760px and below it uses `clamp(2.9rem, 11.7vw, 4.5rem)`. The generic h1 rule is larger, but the hero overrides it.
- **Headline:** section headings use `headline`, balanced wrapping and a maximum measure of 20ch. The studio heading narrows to 16ch.
- **Title:** journey headings use `title`; platform row headings reduce to 1.5rem.
- **Body:** explanatory prose uses `body`, with a maximum measure of 68ch. The phone body changes to 1rem. Smaller component copy is locally sized in the source; it is not a uniform extra scale.
- **Label:** actions use `label`; question labels use `field-label`. The navigation uses the same family at 0.95rem with ordinary link weight, rather than inheriting button weight.
- **Brief:** the generated prose uses `brief`, with ordinary inherited weight rather than the heavier heading weight. It becomes 1.2rem on phones, retains pre-wrapped paragraph breaks and can wrap long strings.
- **Small and brand:** supporting helper copy uses `small`; the wordmark uses `brand` and reduces to 1.35rem on phones.

Documentation headings keep Fraunces and weight 570 but use their own tracking (-0.025em). Their sizes and reading layout remain Starlight-owned; the landing-page scale is not imposed on docs.

**The Type Role Rule.** Use Fraunces for editorial headings and the composed listening brief. Use DM Sans for explanations, field labels, actions and navigation.

## Layout

The landing page uses a centered wrapper capped at 1280px. Before the width cap takes effect, it leaves 48px on each side; at the 1000px breakpoint that becomes 32px, and at 760px it becomes 20px. Wider viewports gain larger centered margins once the cap applies. These are width calculations in the source, not an inferred container framework.

Section spacing is generous, using `section-block` on desktop and `section-block-mobile` on phones. Common grids use `grid-gap`, while the studio and artwork story use wider gaps where space allows. The compact form stacks questions using `question-stack`; action rows wrap rather than forcing one line.

The hero uses a 0.95fr/1.2fr split with a 1rem gap and 40px/36px block padding. Its artwork extends into the column gap and outer margin. Below 1000px the hero becomes equal columns with no grid gap and smaller artwork margins. Intro sections and the composer use paired columns; the artwork story and safety panel use their own asymmetric pairs. These are page compositions, not universal layout tokens. At 760px the hero, intros, composer, artwork story, platform rows and safety panel stack in source order. The hero uses a 1.4rem gap, 30px/24px block padding and no artwork margin. The four-step journey becomes two columns. The footer stacks, and GitHub is hidden from the header while Docs and Get started remain.

The artwork stage keeps a 1.23 aspect ratio. Motion enhancement gives the hero a 235svh scroll region (215svh on phones), with its content sticky at the viewport top and at least 100svh tall. This uses ordinary document scrolling. Without the enhancement, including reduced-motion and no-JavaScript states, the scene has its natural height and no sticky scroll distance. Pausing keeps the enhanced layout's distance stable while settling the sculpture.

The brief panel has no fixed maximum height or clipped overflow. Its selectable region starts with a 20rem minimum height, then grows. Full-width copy action and helper text follow the region in normal flow. The native selects may abbreviate a long option on narrow screens; the complete generated text remains visible in the output.

## Elevation & Depth

Interface surfaces are flat. Paper, wash and olive separate regions, and thin borders divide content. The hero's generated alpha record, sleeve and tape sit directly on paper; two separate cover images join them. The stage uses perspective (1100px) and nested transform layers for assembly, scroll separation and pointer tilt. Physical texture and lighting remain in the artwork.

The two small hero covers use one diffuse artwork shadow (`3px 9px 22px #29291f24`). This supports their place in the sculpture; it is not a panel, button or navigation elevation token.

**The Flat Interface Rule.** Separate interface surfaces through tone, spacing and thin dividers. Reserve the existing diffuse cover shadow for artwork inside the hero sculpture; do not transfer it to interface panels or controls.

The five pieces arrive independently in one finite entrance. A single scroll-scrubbed timeline then separates their position, rotation and depth, draws the listening rail, briefly reveals decorative annotations and reassembles the pieces. Selected object translations, depth and axis rotations use 0.65 strength on phones; the composition's scale and planar turns remain shared. Fine pointers can tilt the stage and lightly attract the hero and artwork-story buttons. Section headings reveal once through responsive SplitText line masks; the hero heading has a finite word entrance. SplitText uses automatic re-splitting and accessible labeling. The cover story turns gently with scroll, and journey arrows draw as they enter.

**The Readable Motion Rule.** Animate the artwork and bounded heading reveals while preserving ordinary body copy, working setup links and document scrolling. Motion adds relationships; it does not gate access to the brief or setup.

Pause motion settles tracked animations at their readable end state, disables their scroll triggers, resets pointer/button offsets and suppresses CSS transition/animation timing. It preserves the current scroll layout and can resume scroll response. The entrance pauses while the page is hidden. Reduced motion prevents GSAP scene, heading and pointer enhancement, restores the natural non-sticky layout, removes CSS transition/animation timing and changes smooth anchors to automatic scrolling. Preference changes revert the GSAP context. No JavaScript leaves the composed sculpture, completed rail and normal heading text visible. Exact timing and breakpoint values live in the sidecar because they are outside the frontmatter schema.

## Shapes

The source uses gently rounded rectangles: `control` for selects, reroll buttons and the exclusions field; `button` for actions; `panel` for the brief and safety surfaces. The cover-story image uses `artwork`, small hero covers use `cover`, and decorative scene annotations use `scene-label`. The alpha record, sleeve and tape follow their own silhouettes without a rounded image tile. Corners are not all interchangeable.

Borders are thin, generally a single pixel. Journey articles and platform rows are open content separated by top rules, not individual floating cards. SVG controls use round strokes; they are actual vector icons rather than font glyphs.

## Components

The sidecar contains source-based visual samples with hover, focus and applicable pressed/disabled states. Application reroll, lock, clipboard and GSAP handlers remain in Svelte or the motion script; the framework-free samples do not reproduce that application logic.

### Buttons

Actions are compact, rounded rectangles. Primary actions place paper text on raspberry and deepen on hover. Secondary actions on paper are transparent with a divider-colored border and gain paper wash on hover. The studio secondary action instead uses pale text, its dedicated olive stroke and olive hover tone. Each has the source's 48px minimum height, button inset, label typography and background/color transition.

Keyboard focus uses the surface-aware rule above. Disabled buttons retain their layout, reduce to half opacity and use the disabled cursor. Pressed buttons and reroll controls compress to 0.97 scale. The primary arrow shifts 3px on hover. The sidecar preserves actual primary, secondary and studio-secondary variants separately.

### Inputs / Fields

Native selects use field paper and ink, a control radius and room for the native dropdown affordance. Their text is 0.93rem on desktop and 1rem on phones. The exclusions textarea is transparent on olive, with pale control text, an olive stroke and vertical resizing. Reroll is an adjacent icon button with a 48px width and minimum height. A locked choice disables that reroll; when all choices are locked, the surprise action is disabled too.

Keep checkboxes retain native form behavior, using the source's pale accent and a text label; checked controls scale to 1.12. This is a specific field-lock pattern, not a new chip family. Reroll turns its icon and briefly warms the output paper, unless motion is paused or reduced. The answer changes immediately and a polite live region announces the suggestion. No custom field error treatment is present; clipboard failure is reported in the output's live helper text.

**The Hydration Honesty Rule.** Keep the question fieldset and copy button disabled until the Svelte component mounts. Server-rendered output is labeled “Sample listening brief”; hydration changes the heading to “Your listening brief.” Without JavaScript the sample remains focusable and selectable, with an explanatory note and no enabled controls that imply a working composer. Disabled selects and textarea dim and use the disabled cursor.

### Navigation

The header pairs a groove-mark/wordmark link with ordinary text navigation. Its final setup link is persistently underlined in raspberry, with a two-pixel underline. Hover adds a drawn thin underline and the normal raspberry link color; the groove mark rotates on brand hover. Keyboard focus remains explicit. At the phone breakpoint, GitHub hides while the primary documentation/setup routes remain. The wordmark is not display-heading typography.

### Cards / Containers

The brief output is a paper panel on olive with a panel radius and `panel-inset`; phones use `panel-inset-mobile`. A compact header and tabular duration sit above a divider. The composed brief is a focusable, labeled, selectable region, followed by the full-width action and a live status paragraph. Preserve this ordinary flow as content changes.

The safety section uses wash, the same panel radius and a larger inset (3rem, reducing to 1.5rem on phones). It does not use the brief's form anatomy. Other editorial sections stay open rather than inheriting a generic card wrapper.

### Original music artwork

The hero has five independent image layers: alpha vinyl disc, folded paper sleeve, flowing olive tape, Night Ferry cover and Between Stations cover. Their intrinsic image ratios remain intact. One labeled image role describes the sculpture; the inner images and timed annotations are hidden from assistive technology to avoid duplicate announcements. The rail retains the readable order Brief → Recordings → Sequence → Cover. The pause control and scroll cue appear only when motion enhancement is active; the control uses `aria-pressed` and changes its label to “Resume motion” while paused.

The square cover-story image has its own descriptive alternative text and responsive output. Imagery and provenance remain owned assets; this document records framing and behavior, not a recipe to reproduce a particular cover.

## Do's and Don'ts

### Do:

- Do reuse the existing paper, ink, raspberry and olive roles before adding another palette.
- Do keep original music artwork distinct from interface surfaces and preserve its aspect ratio.
- Do keep visible keyboard focus appropriate to the immediate surface, including nested paper panels.
- Do let the composed brief wrap and grow so its complete text remains inspectable and selectable.
- Do preserve the single-column phone flow, static reduced-motion/no-JavaScript artwork and readable paused state.
- Do keep composer controls disabled until hydration while leaving the sample brief selectable.

### Don't:

- Don't infer a dark landing-page theme from the separate Starlight dark accent overrides.
- Don't transfer the hero cover shadow to interface panels or controls.
- Don't make scroll animation or heading reveals a condition of reading, setup or brief access.
- Don't turn the page-specific hero columns, step labels or brief questions into mandatory patterns for every future surface.
- Don't treat this observed system, generated tonal ramps or provisional atmosphere language as evidence of user approval or release qualification.
