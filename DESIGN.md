---
name: Atlas Fit
description: Matte forest training companion with chalk text and soft lime actions.
colors:
  bg: "#101916"
  bg-raised: "#15211b"
  surface: "#1b2923"
  surface-2: "#26382e"
  surface-3: "#34493b"
  surface-hover: "#2b4033"
  hairline: "#35473c"
  hairline-strong: "#62776a"
  text: "#f3f6ef"
  text-2: "#a6b4aa"
  action: "#b9e27c"
  action-ink: "#172510"
  action-deep: "#94bd5d"
  warn: "#f2bc67"
  danger: "#ff9ba5"
  muscle-primary: "#e86672"
  muscle-secondary: "#a88bda"
  muscle-neutral: "#dadfd5"
  muscle-activity-low: "#c0cdaa"
  muscle-activity-mid: "#8ea976"
  muscle-activity-high: "#54794b"
typography:
  display:
    fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.025em"
  headline:
    fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.025em"
  title:
    fontFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.015em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  supporting:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 650
rounded:
  s: "10px"
  control: "12px"
  default: "14px"
  l: "16px"
  pill: "999px"
spacing:
  tight: "4px"
  compact: "8px"
  row: "12px"
  panel: "16px"
  gutter: "20px"
  section: "22px"
  spacious: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  input:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.s}"
    padding: "11px 12px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.default}"
    padding: "{spacing.panel}"
  navigation:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-2}"
  workout-set-row:
    textColor: "{colors.text}"
    padding: "10px 12px 4px"
---

# Design System: Atlas Fit

## Overview

**Creative North Star: "Matte forest, chalk, and soft lime"**

A quiet, training-first interface: dark matte surfaces, readable chalk text, and soft lime controls put starting and logging ahead of decoration. Compact rows and progressively disclosed guidance keep the task visible without removing useful detail. This names the implemented palette direction, not an invented concept seed or approved artwork.

**Key Characteristics:**
- Tonal forest layers rather than glossy effects.
- Locally hosted heading type with native body and control type.
- Clear action states and independently encoded anatomy.
- Safe-area-aware, single-column layouts and focused logging.

## Colors

The frontmatter records the reusable values from `src/design/tokens.css` and `src/features/bodygraph/Bodygraph.css`; CSS remains the implementation source of truth.

The sidecar's eight-step OKLCH ramps are synthesized panel previews, not shipped color scales or additional implementation tokens.

### Primary
Soft lime (`action`) marks Start, Finish, completed sets, links, and selected controls; `action-ink` supplies dark text on lime. `action-deep` is the observed Progress action hover. Success shares lime rather than adding a new brand hue.

### Secondary
Rose (`muscle-primary`) and lavender (`muscle-secondary`) identify primary and secondary exercise targets. Amber (`warn`) and pale rose (`danger`) carry warning and destructive/error meaning, respectively.

### Neutral
Matte forest (`bg`) anchors every screen. Raised forest and the three surface levels separate fields, cards, and selected segments. Chalk (`text`) carries main content; sage (`text-2`) carries supporting text. Hairlines separate dense rows; stronger hairlines frame elevated controls.

Neutral anatomy uses `muscle-neutral`. The three activity greens encode low, medium, and high logged involvement, not target classification or measured recovery.

**The Separate Semantics Rule.** Keep lime action states independent of rose/lavender muscle targets and the activity scale; always provide text legends or labels.

## Typography

Source Sans 3 supplies headings; the native platform stack supplies body text, numbers, labels, and controls. The variable font is served from `public/fonts/source-sans-3-latin-variable.woff2`, with its SIL OFL licence alongside it; there are no runtime hosted-font calls.

The frontmatter captures shared display, page headline, section title, body, supporting, and button roles. Today uses a closely related workout title (29px); focused logging uses a compact session title (1.25rem) and exercise title (1.4rem). Progress page headings use the shared display size with slightly tighter tracking. These are contextual variants, not an oversized marketing hierarchy. Workout and Progress numbers use tabular numerals.

## Layout

The application is a centered, single-column shell (maximum 480px), including on desktop. Shared pages use gutters (20px), panel padding (16px), and section gaps (20–22px). Progress uses content gutters (16px). Above 520px, a darker outer canvas and thin shell borders frame the app; it does not become a dashboard grid.

Headers and bottom controls include safe-area insets. Four fixed tabs reserve `70px + safe-area-inset-bottom`; an active-session resume strip adds content clearance. Logging replaces tabs with a sticky compact header and fixed action toolbar. Workout styles allow 680px, but the current App shell caps the rendered route at 480px. Narrow-width adjustments occur at 360px and 380px; planner controls collapse at 600px.

Set logging uses aligned columns for set number, previous/target, load, reps, and Done. Wrapping controls and expandable options preserve readable fields instead of squeezing extra information into that row.

## Elevation & Depth

Depth is mostly tonal: surfaces, subtle strokes, and scrims, with no action glow. Small soft shadows belong to the fixed resume strip and floating muscle search panel, not ordinary cards. Bottom sheets are solid raised forest with rounded top corners and bounded scrolling (88dvh).

**The Matte Layers Rule.** Separate ordinary content with tone and hairlines; reserve shadows for floating elements.

## Shapes

Controls use gently rounded corners (10–12px); panels use medium rounding (14px), and featured workout cards and sheet tops use larger rounding (16px). Filter chips can be pills; planner fields and inner segments also use compact corners (8px). Avoid treating every row as a separate rounded card: library and history entries are divided lists.

## Components

- **Buttons:** primary lime with dark ink; secondary forest; ghost transparent with a hairline; destructive transparent with danger text and stroke. Shared buttons are at least 48px high, compact and icon controls at least 44px. Pressed shared buttons scale to .98; fine-pointer hover brightens shared buttons/tiles. Focus uses a lime outline (2px, 3px offset). Disabled states lower opacity.
- **Fields and filters:** native body type, visible borders, and lime caret/focus. Standard inputs are at least 48px with readable text (16px). Selected chips use a raised forest fill and lime stroke/text; selected segments use the third surface level and chalk text.
- **Cards and lists:** forest panels group meaningful tasks; exercise, routine, and history rows use restrained dividers. Thumbnails show actual licensed media without cropping/restyling its artwork in the shared picture component; unavailable media has an honest fallback.
- **Navigation:** Today, Plan, Library, and Progress have inline SVG icons and labels; the active destination is lime. Settings is reached from Today. Active logging hides the tabs and provides explicit pause/exit and completion controls. An unfinished local session has a visible Resume path and is protected from replacement.
- **Workout logging:** compact context and editable load/reps/Done rows lead. Actual demonstrations and form cues expand on request. Warm-up/working kind, copying, and effort sit behind set options. Completed rows use a subtle lime tint and filled Done control; placeholder targets are not recorded performance.
- **Muscle map:** retain the original rounded, faceless, independently selectable front/back artwork. Front/back and target/activity switches are ordinary segments. Rose/lavender/neutral fills describe targets; activity uses its separate green scale. A selectable muscle list supplements small regions; the inspector shares the forest palette. Artwork acceptance remains a user decision, not a design-system approval.
- **Motion:** short state transitions (180ms ease-out; alternate token 220ms ease-out) support feedback. Reduced-motion preference removes animations, transitions, and smooth scrolling.

## Do's and Don'ts

### Do:
- **Do** use shared forest/chalk/lime tokens across every screen, including dialogs and inspectors.
- **Do** keep logging inputs visible, touch controls comfortable, and fixed-control clearance safe-area-aware.
- **Do** pair anatomical colors with legends and a selectable text alternative.
- **Do** preserve licensed media, attribution, and the local font licence; retain programmatic icon provenance.

### Don't:
- **Don't** use muscle classification colors as brand action colors.
- **Don't** replace real illustrations or saved performance with decorative substitutes.
- **Don't** turn ordinary cards into glowing or heavily shadowed surfaces.
- **Don't** add hosted-font dependencies or navigation tabs to the focused workout route.

<!-- Evidence: current tokens, App routing, and Today/Plan/Library/Workout/Progress/Bodygraph CSS; final production Chromium results.json and mobile-today/workout/muscles-front captures in the atlas-training-review temp evidence directory. Chromium evidence is not iPhone Safari/VoiceOver/installation/storage-eviction or artwork acceptance. Tests (143 passing), catalogue-bundle warning (~2.25MB), and empty mechanical-detector result are reported by the parent session, not rerun here. Independent finish verdict is not asserted. Legacy planner-only color fallbacks and location metadata above the Today title are not promoted into reusable tokens or a decorative eyebrow pattern. -->
