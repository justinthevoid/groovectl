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
    fontSize: "clamp(3.5rem, 5.5vw, 4.8rem)"
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
  control: "10px"
  button: "12px"
  artwork: "14px"
  panel: "16px"
  hero-artwork: "20px"
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

Warm paper, compact sans-serif controls and generous serif headlines frame a small collection of original music artwork. The site feels editorial and tactile: thin dividers organize the page, raspberry identifies actions, and olive provides a distinct working surface for the brief composer.

This is a scan of the implemented website, not a product-wide identity specification. It covers the landing page, brief composer and explicit Starlight overrides. It does not govern the MCP App. The north-star phrase and atmosphere language are descriptive and provisional. The unattended implementation did not establish a user-selected comp or a public seed reference; the later direction roll does not replace that missing pre-implementation workshop. Documentation records observed design, not whole-surface ship approval. See [the website brief](docs/design/site-brief.md) for the process record.

**Key Characteristics:**

- Cream paper and dark ink support long reading; raspberry distinguishes actions.
- Fraunces supplies headings and the composed brief; DM Sans supplies prose and controls.
- Flat interface surfaces use thin dividers and tonal changes, while imagery carries physical texture.
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

- **Display:** the landing hero uses `display`; on phones the source changes its size to `clamp(3rem, 12.4vw, 4.5rem)`.
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

The hero currently uses a 0.9fr/1.15fr split and becomes equal columns below 1000px. Intro sections and the composer use paired columns; the artwork story and safety panel use their own asymmetric pairs. These are page compositions, not universal layout tokens. At 760px the hero, intros, composer, artwork story, platform rows and safety panel stack in source order. The four-step journey becomes two columns. The footer stacks, and the optional brief link is hidden from the header while Docs and Get started remain.

The brief panel has no fixed maximum height or clipped overflow. Its selectable region starts with a 20rem minimum height, then grows. Full-width copy action and helper text follow the region in normal flow. The native selects may abbreviate a long option on narrow screens; the complete generated text remains visible in the output.

## Elevation & Depth

The UI is flat. Paper, wash and olive separate regions, and thin borders divide content. There are no CSS box shadows in the scanned stylesheets. The hero's cassette and sleeves contain photographic depth within the raster itself; that lighting is not a reusable interface shadow.

**The Flat Interface Rule.** Separate interface surfaces through tone, spacing and thin dividers. The incumbent UI has no CSS box shadows; physical lighting belongs to the original artwork.

Interaction motion is limited to the existing background/color transitions. Smooth anchor scrolling is enabled at rest. The reduced-motion media query removes transitions and animations and restores automatic scrolling. Exact timing and breakpoint values live in the sidecar because they are outside the frontmatter schema.

## Shapes

The source uses gently rounded rectangles: `control` for selects, reroll buttons and the exclusions field; `button` for actions; `panel` for the brief and safety surfaces. Artwork has its own `artwork` and `hero-artwork` corners; the hero reduces to `artwork` on phones. Corners are not all interchangeable.

Borders are thin, generally a single pixel. Journey articles and platform rows are open content separated by top rules, not individual floating cards. SVG controls use round strokes; they are actual vector icons rather than font glyphs.

## Components

The sidecar contains source-based visual samples with hover and focus states. Application reroll, lock and clipboard handlers remain in Svelte; the framework-free samples do not reproduce that application logic.

### Buttons

Actions are compact, rounded rectangles. Primary actions place paper text on raspberry and deepen on hover. Secondary actions on paper are transparent with a divider-colored border and gain paper wash on hover. The studio secondary action instead uses pale text, its dedicated olive stroke and olive hover tone. Each has the source's 48px minimum height, button inset, label typography and background/color transition.

Keyboard focus uses the surface-aware rule above. Disabled buttons retain their layout, reduce to half opacity and use the disabled cursor. There is no distinct custom active-state transform in the source. The sidecar preserves actual primary, secondary and studio-secondary variants separately.

### Inputs / Fields

Native selects use field paper and ink, a control radius and room for the native dropdown affordance. Their text is 0.93rem on desktop and 1rem on phones. The exclusions textarea is transparent on olive, with pale control text, an olive stroke and vertical resizing. Reroll is an adjacent icon button with a 48px width and minimum height. A locked choice disables that reroll; when all choices are locked, the surprise action is disabled too.

Keep checkboxes retain native form behavior, using the source's pale accent and a text label. This is a specific field-lock pattern, not a new chip family. No custom field error treatment is present; clipboard failure is reported in the output's live helper text.

### Navigation

The header pairs a groove-mark/wordmark link with ordinary text navigation. Its final setup link is persistently underlined in raspberry, with a two-pixel underline. Hover follows the normal raspberry link treatment and keyboard focus remains explicit. At the phone breakpoint, the brief shortcut hides while the primary documentation/setup routes remain. The wordmark is not display-heading typography.

### Cards / Containers

The brief output is a paper panel on olive with a panel radius and `panel-inset`; phones use `panel-inset-mobile`. A compact header and tabular duration sit above a divider. The composed brief is a focusable, labeled, selectable region, followed by the full-width action and a live status paragraph. Preserve this ordinary flow as content changes.

The safety section uses wash, the same panel radius and a larger inset (3rem, reducing to 1.5rem on phones). It does not use the brief's form anatomy. Other editorial sections stay open rather than inheriting a generic card wrapper.

### Original music artwork

The hero still life and square cover are image-led content with descriptive alternative text. They keep their intrinsic aspect ratios and use responsive image output. Their imagery and provenance are owned assets; the document records the framing, not a recipe to reproduce a particular cover.

## Do's and Don'ts

### Do:

- Do reuse the existing paper, ink, raspberry and olive roles before adding another palette.
- Do keep original music artwork distinct from interface surfaces and preserve its aspect ratio.
- Do keep visible keyboard focus appropriate to the immediate surface, including nested paper panels.
- Do let the composed brief wrap and grow so its complete text remains inspectable and selectable.
- Do preserve the single-column phone flow and the existing reduced-motion override.

### Don't:

- Don't infer a dark landing-page theme from the separate Starlight dark accent overrides.
- Don't replace thin dividers and tonal grouping with a new shadow vocabulary when extending this site.
- Don't turn the page-specific hero columns, step labels or brief questions into mandatory patterns for every future surface.
- Don't treat this observed system, generated tonal ramps or provisional atmosphere language as evidence of user approval or release qualification.
