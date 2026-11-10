---
name: Table Mimic
description: An astral chart for a D&D table — gold and starlight on deep midnight, in three themes.
colors:
  bg: "#080b18"
  bg-2: "#0d1224"
  surface: "#131934"
  surface-2: "#1a2148"
  surface-3: "#232b58"
  border: "#2a3464"
  border-soft: "#1f2548"
  text: "#ece3cc"
  text-2: "#b8b2a0"
  text-dim: "#9195af"
  placeholder: "#9195af"
  gold: "#d4b06a"
  gold-2: "#e8c98a"
  gold-deep: "#8a6a3a"
  celestial: "#8fb4ff"
  celestial-2: "#c0d4ff"
  celestial-deep: "#3a5aa0"
  crimson: "#d67c7b"
  emerald: "#6fa872"
  violet: "#a189d5"
typography:
  display:
    fontFamily: "Cinzel, serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Cinzel, serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  title:
    fontFamily: "Cinzel, serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.05em"
  body:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "Cinzel, serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.18em"
  numeric:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0em"
rounded:
  sharp: "2px"
  panel: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "999px"
spacing:
  2xs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "14px"
  3xl: "20px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "9px 14px"
  button-hover:
    textColor: "{colors.gold}"
  button-primary:
    textColor: "{colors.gold-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "9px 14px"
  button-primary-hover:
    textColor: "{colors.text}"
  input:
    backgroundColor: "{colors.bg-2}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.sharp}"
    padding: "9px 12px"
  panel:
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
---

# Design System: Table Mimic

## Overview

**Creative North Star: "The Astral Chart"**

Table Mimic reads as a star chart kept by a cartographer who also runs a dungeon. The ground is
deep midnight; the marks on it are gold leaf and starlight blue. Sigils and faint radial washes
sit behind the content like constellations drawn on the page, never competing with it. The
register is arcane and cosmic rather than bookish — this is an instrument for navigating a
campaign, not a rulebook to be read.

The system is **restrained by intent**. Chrome is thin: hairline borders, near-sharp corners, a
single hairline-bordered panel that repeats everywhere. Colour does the work that borders and
boxes do in other systems — the accent is scarce and meaningful, and ornament is confined to the
background. Depth is tonal, never lifted.

One thing makes this system unusual and governs everything else: **it ships three complete
themes**, and all three are first-class. The token names below are constant; their values are
redefined per theme. A screen that only holds together in the default theme is not finished.

**Key Characteristics:**

- Gold and starlight accents on a deep midnight ground, with two sibling themes
- Inscriptional caps (Cinzel) for labels, editorial serif (Newsreader) for prose, mono for numbers
- Near-sharp corners (2–3px); pills reserved for status
- Tonal depth through three stacked surface steps, never drop shadows
- Glow is a state signal, not decoration
- Dense by nature — built for glanceable reading on a phone at a table

## Colors

A cold, deep ground carrying two warm-and-cool accents, plus a small semantic set. Values in the
frontmatter are the **midnight** theme, which is the default defined on `:root`.

### Primary

- **Arcane Gold** (`#d4b06a`): the signature accent. Active states, focus borders, headings that
  need weight, the primary button's border and label, currency and treasure. Its lighter sibling
  **Gilt** (`#e8c98a`) carries primary button labels; **Deep Gilt** (`#8a6a3a`) exists only
  inside gradients and tints and is never used as text.

### Secondary

- **Starlight** (`#8fb4ff`): the cool counterweight. Selection, links, informational emphasis,
  and the celestial wash behind the login and empty states. **Pale Starlight** (`#c0d4ff`) and
  **Deep Starlight** (`#3a5aa0`) extend it for hover and recessed use.

### Tertiary

- **Rose Crimson** (`#d67c7b`): damage, errors, destructive actions, the bloodied health bar.
- **Moss Emerald** (`#6fa872`): healing, success, "play" affordances.
- **Thistle Violet** (`#a189d5`): a third categorical accent used sparingly for chips and tags.

### Neutral

- **Void** (`#080b18`) and **Deep Void** (`#0d1224`): the page ground and the inset ground that
  inputs sit on.
- **Astral Surface** (`#131934`), **Raised** (`#1a2148`), **Highest** (`#232b58`): the three
  stacked surface steps that carry all elevation.
- **Constellation Line** (`#2a3464`) and **Faint Line** (`#1f2548`): hairline borders and
  dividers.
- **Parchment Ink** (`#ece3cc`), **Muted Ink** (`#b8b2a0`), **Dim Ink** (`#9195af`): the text
  ramp, strongest to faintest.

### Named Rules

**The Three Themes Rule.** `midnight` (default), `vellum` (light parchment) and `candlelit`
(sepia) redefine every token above under a `[data-theme]` selector. Never write a literal colour
in a component — the token is the only interface. A change verified in one theme is unverified.

**The AA Floor Rule.** Every text token clears 4.5:1 against every surface token, in every theme
— 135 combinations, enforced by `npm run check:contrast` in CI. Adding or darkening a token
without re-running it is how this breaks.

**The Scarce Accent Rule.** Gold marks what is active, valuable, or focused. When most of a
screen is gold, none of it is.

**The Ramp Separation Rule.** The three text steps sit roughly 1.4× apart in contrast. Fixing a
contrast failure by sliding one step toward another collapses the ramp; move its neighbour too.

## Typography

**Display Font:** Cinzel (with `serif` fallback)
**Body Font:** Newsreader (with `Georgia, serif`)
**Label/Mono Font:** JetBrains Mono (with `monospace`)

**Character:** Cinzel is an inscriptional Roman capital — it reads as carved rather than written,
and it carries every heading and label. Newsreader is an editorial serif that keeps long prose
(spell descriptions, background text) readable at small sizes. JetBrains Mono appears only where
numbers must align: hit points, ability scores, dice results, currency.

### Hierarchy

- **Display** (Cinzel 600, 48px, 1.1, 0.04em): the drop capital and the largest dice result. Rare.
- **Headline** (Cinzel 600, 24–36px, 1.2, 0.04em): page and empty-state titles ("No Hero Selected").
- **Title** (Cinzel 500, 16–18px, 1.3, 0.05em): modal titles, section headings.
- **Body** (Newsreader 400, 13–15px, 1.45): all prose. Italic is used for flavour text.
- **Label** (Cinzel 500, 11px, 0.18em, uppercase): buttons, panel titles, field labels, tabs.
- **Numeric** (JetBrains Mono 500, 13px, tabular): any figure that is compared or totalled.

### Named Rules

**The 11px Floor Rule.** No functional text ships below 11px. Letterspaced micro-labels are
functional text and are not exempt; being on the scale does not launder a legibility failure.

**The Tracking Ladder Rule.** Tracking rises as size falls: 0.04em on display, 0.05em on titles,
0.18em on buttons, 0.22em on the smallest eyebrow labels. Uppercase Cinzel below 12px without
tracking is illegible.

## Layout

A two-column application shell: a fixed roster/navigation rail beside a flexible content column
(`grid-template-columns: 320px minmax(0, 1fr)`), narrowing to 260px below 820px and collapsing to
a drawer below that. The page itself does not scroll — `body` is `overflow: hidden` and each
panel owns its own scroll region, so the chrome stays put while content moves.

The spacing rhythm is a 2px grid built on **8px**, by far the most-used gap (62 occurrences),
with 4px and 6px for tight intra-component grouping and 10–14px between groups. Panels pad
18–20px.

The scales above are declared as `--space-*`, `--radius-*`, `--text-*` and `--track-*` tokens in
`src/styles.css`, theme-independent (unlike the colour tokens, which are redefined per theme).
They were extracted from values the implementation already used, so defining them changed
nothing visually; most existing declarations still carry raw px and migrating them is a separate
pass. The type scale deliberately has **no step below 11px** — naming a smaller size would
launder the floor. The 9px and 10px values still in the codebase are known debt, not a tier.

Breakpoints observed: 820px (shell collapse), 640px, 560px, 480px. `prefers-reduced-motion` is
honoured.

### Named Rules

**The Panel Owns Its Scroll Rule.** The shell never scrolls. A new surface that needs to scroll
scrolls inside its panel, not by growing the page.

**The Phone Is The Table Rule.** Players hold phones during play. Any session surface must stay
workable at 375px — dense is acceptable, cramped and clipped are not.

## Elevation & Depth

This system is **tonally layered, not lifted**. Depth comes from three stacked surface tones
(`surface` → `surface-2` → `surface-3`) separated by hairline borders, plus a translucent panel
(`color-mix(surface 75%, transparent)` over `backdrop-filter: blur(4px)`) that lets the sigil
background show through. Cards do not float.

Glows exist, but they are **state**, not decoration: a focused input takes a gold glow; an active
or live element takes the celestial one. A glow at rest is a bug.

### Shadow Vocabulary

- **Ambient page shadow** (`box-shadow: 0 8px 32px rgba(0,0,0,0.5)`): modals and drawers only —
  the one place something genuinely sits above the page.
- **Focus glow, gold** (`box-shadow: 0 0 18px rgba(212,176,106,0.22)`): input focus, primary
  button.
- **Live glow, celestial** (`box-shadow: 0 0 20px rgba(143,180,255,0.25)`): active session state.

### Named Rules

**The Glow Is State Rule.** Glow signals focus, activity, or liveness. Never apply it to make
something look richer at rest.

**The One Standing Glow.** Exactly one element breaks the rule above by design: the primary
button carries the gold glow at rest, because on a dark ground it is how the committing action
announces itself. It is the only standing glow in the system. A second standing glow is a bug,
and a celestial glow at rest is always a bug.

The detector reports this as `dark-glow` and it is **expected output, not a defect** — those
findings are the primary button. It is deliberately *not* suppressed: the rule has no
value-level ignore, so silencing it would also stop it catching celestial rest glows, which are
the failures worth knowing about. Read `dark-glow` findings by checking which element they sit
on before treating them as new.

## Shapes

Corners are **near-sharp**. 2px is the house radius (buttons, inputs, tabs, chips); panels use
3px; 4–8px appears on larger nested containers; `999px` pills are reserved for status and count
badges, and `50%` for avatars and dice. Nothing in the system is softly rounded.

Borders are hairlines — 1px, in `border` or a `color-mix` of an accent at 35–55% — and they do
the structural work that shadows do elsewhere. Panels carry a faint sigil geometry behind the
content at 6–12% opacity, clipped to the panel.

### Named Rules

**The Hairline Rule.** Structure is drawn with 1px borders and tone. If a boundary needs more
than a hairline to read, the tones on either side of it are wrong.

## Components

### Buttons

- **Shape:** near-sharp (2px radius)
- **Base:** transparent background, 1px `border` hairline, `text-2` label, Cinzel 11px uppercase
  at 0.18em, padding 9px 14px
- **Hover / Focus:** label shifts to gold, border brightens; `transition: all .15s`
- **Primary:** a vertical gradient mixing `gold` 30% and `gold-deep` 25% into `surface-2`, gold
  border, `gold-2` label (`gold-deep` in the vellum theme), gold focus glow. Hover deepens the
  mix to 40%/30% and shifts the label to `text`.
- **Danger / Play:** same base with `crimson` / `emerald` label and a 50–55% accent border;
  hover fills with the accent at ~20%.

### Chips

- **Style:** pill (`999px`) or 2px, accent text on an 8–18% `color-mix` of the same accent, with
  a 35–50% accent border. Used for conditions, tags, and counts.
- **State:** selected chips raise the fill, not the border.

### Cards / Containers

- **Corner Style:** 3px (`panel`)
- **Background:** `surface` at 75% over a blurred backdrop
- **Shadow Strategy:** none — see Elevation & Depth
- **Border:** 1px `border`
- **Internal Padding:** 18–20px

### Inputs / Fields

- **Style:** `bg-2` inset ground, 1px `border`, 2px radius, Newsreader 15px, padding 9px 12px
- **Label:** Cinzel 11px uppercase at 0.2em, `text-dim`, 6px below
- **Placeholder:** the dedicated `placeholder` token at `opacity: 1` — never the browser default,
  which fails contrast
- **Focus:** gold border plus the gold glow

### Navigation

- **Style:** a 320px rail listing campaigns and the character roster; rows are Cinzel-named with
  Newsreader sub-text, a left gold marker on the active row, and `aria-current` set.
- **Mobile:** collapses to a drawer with a scrim below 820px.

### Vitals Bar (signature component)

A thin horizontal meter whose fill is a left-to-right `crimson → gold` gradient, dropping to flat
`crimson` when bloodied. It is the clearest expression of the system: a single hairline-bounded
strip carrying state through colour alone.

## Do's and Don'ts

### Do:

- **Do** write every colour as a token. The three themes are the product.
- **Do** run `npm run check:contrast` after touching any colour token.
- **Do** keep functional text at 11px or above, and raise tracking as size falls.
- **Do** use tone and hairlines for structure; let `surface` → `surface-2` → `surface-3` carry depth.
- **Do** keep the accent scarce — gold marks active, valuable, or focused.
- **Do** verify at 375px before calling a session surface done.

### Don't:

- **Don't** introduce a drop shadow to separate elements. Change the tone step instead.
- **Don't** leave a glow on an element at rest.
- **Don't** soften the corner language; 2–3px is the house voice, pills are for status only.
- **Don't** reach for a literal hex, `#757575`-style browser defaults included.
- **Don't** add `@angular/animations`. Motion here is CSS-only and deliberately so — the package
  was removed for 433 kB and should stay out.
- **Don't** let a fix for one theme regress another; all three ship together.

<!--
Tension worth recording: the stated component philosophy is "refined and restrained", but the
current implementation runs dense — 9–10px labels in places, tight 4–6px gaps in session panels,
and a type scale compressed into 9–16px. Treat restraint as the direction for new and reworked
surfaces rather than a description of every existing one.
-->
