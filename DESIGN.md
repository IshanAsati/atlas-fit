---
name: Atlas Fit
description: Muted stone and lilac training companion with ink text, warm cards, floating pill navigation, and device-following light/dark themes.
colors:
  bg: "#dad7de"
  bg-raised: "#ebe7e2"
  surface: "#ebe7e2"
  surface-2: "#e1dbe8"
  surface-3: "#d3cadc"
  surface-hover: "#dcd5e3"
  hairline: "#cec5d2"
  hairline-strong: "#aaa0b5"
  text: "#211d27"
  text-2: "#494351"
  action: "#b8a3cf"
  action-ink: "#211d27"
  action-deep: "#aa92c4"
  action-text: "#51318a"
  focus: "#51318a"
  header-bg: "#dad7de"
  outer-bg: "#c5c1ca"
  accent: "#b8a3cf"
  good: "#31541f"
  warn: "#77451b"
  danger: "#962b3c"
  muscle-primary: "#e86672"
  muscle-secondary: "#a88bda"
  muscle-neutral: "#dddce0"
  nav-bg: "#28242e"
  nav-text: "#f8f7f3"
  muscle-activity-low: "#c0cdaa"
  muscle-activity-mid: "#8ea976"
  muscle-activity-high: "#54794b"
dark-colors:
  bg: "#1c1921"
  bg-raised: "#2d2834"
  surface: "#28242d"
  surface-2: "#332d3d"
  surface-3: "#463b52"
  surface-hover: "#41384c"
  hairline: "#403a48"
  hairline-strong: "#6a6175"
  text: "#f0eaf5"
  text-2: "#c6becf"
  action: "#c0a8d8"
  action-ink: "#211d27"
  action-deep: "#b59bce"
  action-text: "#d2bce8"
  focus: "#d2bce8"
  header-bg: "#1c1921"
  outer-bg: "#121016"
  good: "#b6d39e"
  warn: "#e1be92"
  danger: "#f3a4af"
  nav-bg: "#17141c"
typography:
  display:
    fontFamily: "'Baloo 2', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  headline:
    fontFamily: "'Baloo 2', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.02em"
  title:
    fontFamily: "'Baloo 2', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.01em"
  body:
    fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  supporting:
    fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  button:
    fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 650
rounded:
  compact: "8px"
  s: "10px"
  control: "12px"
  field: "14px"
  l: "16px"
  default: "20px"
  card: "24px"
  feature: "28px"
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
    backgroundColor: "{colors.nav-bg}"
    textColor: "{colors.nav-text}"
  workout-set-row:
    textColor: "{colors.text}"
    padding: "10px 12px 4px"
---

# Design System: Atlas Fit

## Overview

**Creative North Star: "Stone, lilac, and ink"**

A training-first mobile app on a calm, low-glare canvas: muted stone backgrounds, warm off-white cards, soft lilac actions, dark-purple text actions, and a dark floating navigation pill. The neon-lime and pure-white treatment was deliberately retired after the user reported it too bright and hard to read; the current palette is quieter without going generic. The user's Sport application reference established the app-like structure (four tabs, floating pill, rounded cards, sticky header), not a pixel-exact reproduction; Atlas Fit retains its own training flows, data, artwork, and licensed media.

**Key Characteristics:**
- Muted tonal layers and generous rounded cards rather than glossy effects or high-contrast white.
- Device-following light and dark themes with a System/Dark/Light override in Settings.
- Locally hosted heading type with native body and control type.
- Clear action states and independently encoded anatomy.
- Safe-area-aware, single-column layouts and focused logging.

## Colors

The frontmatter records the reusable values from `src/design/tokens.css` and `src/features/bodygraph/Bodygraph.css`; CSS remains the implementation source of truth. `colors` holds the light theme, `dark-colors` holds the `:root[data-theme='dark']` overrides.

### Primary
Muted lilac (`action`) fills Start, Finish, and completed-set controls; `action-ink` supplies dark labels that stay readable on lilac in both themes. Dark purple (`action-text`) carries links and textual actions in light mode, and pale lilac (`#d2bce8`) does the same in dark mode. Purple (`focus`) supplies focus outlines. Saturated lime and pure white are not part of the system.

### Secondary
Rose (`muscle-primary`) and lavender (`muscle-secondary`) identify primary and secondary exercise targets. Dark amber (`warn`) and dark rose (`danger`) carry readable warning and destructive/error text in light mode; lighter counterparts (`#e1be92`, `#f3a4af`) keep the same meaning in dark mode. Success text uses dark green (`good`), light green in dark mode.

### Neutral
Muted stone (`bg`) anchors the lower canvas. Warm off-white cards and lilac surface levels separate fields, cards, and selected segments; dark mode swaps these for charcoal and plum surfaces. Ink (`text`) carries main content; muted dark purple (`text-2`) carries supporting text in light mode, soft lavender-gray in dark mode. Hairlines separate dense rows; stronger hairlines frame fields. The sticky header uses the same tone as `bg` so scrolling content cannot show through its controls.

Neutral anatomy uses `muscle-neutral`. The three activity greens encode low, medium, and high logged involvement, not target classification or measured recovery.

**The Separate Semantics Rule.** Keep action states independent of rose/lavender muscle targets and the activity scale; always provide text legends or labels.

**The Theme Rule.** Text and surfaces come from tokens in both themes; never hardcode a background or text color that only works in one theme. Every text/background pair must hold 4.5:1 (body) or 3:1 (large) in light and dark.

## Typography

Baloo 2 supplies headings and Nunito supplies body text, numbers, labels, and controls. Both are variable Latin WOFF2 files served from `public/fonts/`, with their SIL OFL licences alongside them; there are no runtime hosted-font calls. Source Sans 3 remains bundled as a fallback.

The frontmatter captures shared display, page headline, section title, body, supporting, and button roles. Today uses a closely related workout title (30px); focused logging uses a compact session title (1.25rem) and exercise title (1.4rem). These are contextual variants, not an oversized marketing hierarchy. Workout and Progress numbers use tabular numerals. Editable fields and workout selectors use 16px text to avoid iPhone focus zoom.

## Layout

The application is a centered, single-column shell (maximum 500px), including on desktop. Shared pages use gutters (20px), panel padding (16px), and section gaps (20–22px). Progress uses content gutters (16px). A muted outer canvas (`outer-bg`, stone in light mode and near-black in dark mode) frames the app on desktop; it does not become a dashboard grid.

Headers and bottom controls include safe-area insets. Four tabs sit in a black floating pill; an active-session resume strip adds content clearance. Logging replaces tabs with a sticky compact header and floating action toolbar. Workout sheets cap at 500px and the rest timer at 448px. Narrow-width adjustments occur at 360px and 380px; planner controls collapse at 600px.

Set logging uses aligned columns for set number, previous/target, load, reps, and Done. Wrapping controls and expandable options preserve readable fields instead of squeezing extra information into that row.

## Elevation & Depth

Depth is mostly tonal: warm off-white cards, subtle strokes, and scrims, with no action glow. Soft shadows distinguish floating controls. Bottom sheets use solid card surfaces with rounded top corners and bounded scrolling (88dvh).

**The Matte Layers Rule.** Separate ordinary content with tone and hairlines; reserve shadows for floating elements.

## Shapes

Shared controls use pill rounding; panels use 20px rounding and featured cards use 28px. Planner fields and inner segments retain compact corners (8px). Library and history entries use rounded card surfaces; dense set rows remain aligned within their exercise card.

## Components

- **Buttons:** primary lilac with dark ink; secondary lilac-tinted surface; ghost transparent; destructive dark rose text. Shared buttons are at least 46px high, compact and icon controls at least 44px. Pressed shared buttons scale to .98; hover changes the fill without washing out labels. Focus uses a purple outline (2px, 3px offset). Disabled states lower opacity.
- **Fields and filters:** native body type, visible borders, and ink caret. Standard inputs use readable text (16px). Selected chips use a lilac fill and dark-purple text; selected segments use the third surface level and ink text.
- **Cards and lists:** rounded card panels group meaningful tasks. Thumbnails show actual licensed media without restyling its artwork in the shared picture component; unavailable media has an honest fallback. Long exercise names can wrap rather than being truncated in Today previews.
- **Navigation:** Today, Plan, Library, and Progress have inline SVG icons and labels in a floating dark pill; the active destination uses the action lilac. Labels keep readable contrast in every hover and active state. Settings is reached from Today. Active logging hides the tabs and provides “Save & exit” and “Finish workout” controls. An unfinished local session has a visible Resume path and is protected from replacement.
- **Workout logging:** compact context and editable load/reps/Done rows lead. Actual demonstrations and form cues expand on request. Warm-up/working kind, copying, and effort sit behind set options. Completed rows use a subtle lilac tint and filled Done control; placeholder targets are not recorded performance.
- **Muscle map:** retain the original rounded, faceless, independently selectable front/back artwork. Front/back and target/activity switches are ordinary segments. Rose/lavender/neutral fills describe targets; activity uses its separate green scale. A selectable muscle list supplements small regions; the inspector shares the light palette. Artwork acceptance remains a user decision, not a design-system approval.
- **Motion:** short state transitions (180ms ease-out; alternate token 220ms ease-out) support feedback. Reduced-motion preference removes animations, transitions, and smooth scrolling.

## Do's and Don'ts

### Do:
- **Do** use shared stone/lilac/ink tokens across every screen, including dialogs and inspectors.
- **Do** keep logging inputs visible, touch controls comfortable, and fixed-control clearance safe-area-aware.
- **Do** pair anatomical colors with legends and a selectable text alternative.
- **Do** preserve licensed media, attribution, and the local font licence; retain programmatic icon provenance.

### Don't:
- **Don't** use muscle classification colors as brand action colors.
- **Don't** replace real illustrations or saved performance with decorative substitutes.
- **Don't** turn ordinary cards into glowing or heavily shadowed surfaces.
- **Don't** add hosted-font dependencies or navigation tabs to the focused workout route.

## Interface language

Use short, sentence-case labels that explain the action. A workout is one training session; a routine is a reusable workout template. Explain technical measures when shown: total lifted is weight × reps for completed working sets, excluding warm-ups and skipped exercises. Movement ids such as `hpush` remain stable in storage but appear as readable names in the UI. Empty states and errors should offer a real next action, not imply success or invent data.

Verification and remaining device-testing limits are recorded in `qa/UI_REFINEMENT.md`. CSS is the implementation source of truth; older sidecar tonal previews may still describe the superseded forest theme.
