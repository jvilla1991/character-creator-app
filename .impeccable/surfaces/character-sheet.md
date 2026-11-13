# Audit — Character sheet + panels

Target: `src/app/charactermanager/components/character-sheet/` (vitals strip, tab bar, 15 panel
components) and the `.panel`/`.equip-*`/`.abilities` rules in `src/styles.css`. Measured on Lyra
Moonwhisper (Bard 7) across the Sheet / Spells / Inventory / Notes / Log tabs, player view, at
375×812 in all three themes. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Vellum tab bar at 1.34:1; 68 text nodes under the 11px floor on one tab |
| 2 | Performance | 3 | Sticky tab bar `backdrop-filter: blur(8px)` over a scrolling panel; otherwise lean |
| 3 | Theming | 1 | Five undefined tokens fall back to dark-theme literals; named colour `gold` |
| 4 | Responsive Design | 2 | No page overflow, but inventory names clipped to 34px and mobile grid rules overridden |
| 5 | Implementation Integrity | 2 | Three standing gold glows at rest; ten cards-in-cards |
| **Total** | | **10/20** | **Acceptable (significant work needed)** |

## Implementation Integrity Verdict

**Fail, narrowly.** The sheet is unmistakably this product — Cinzel panel titles, the vitals
bar, the gold/starlight accents — but its implementation has drifted from the system it claims.
It references tokens that do not exist (`--panel-bg`, `--line`, `--accent`, `--bg-elev`,
`--surface-1`), each with a hard-coded midnight fallback, so the sheet only fully works in the
theme it was built in. That is The Three Themes Rule failing at the source level, not a palette
problem.

## Executive Summary

- **10/20 — Acceptable.** P0: 0 · P1: 5 · P2: 4 · P3: 2
- Top issues:
  1. **[P1] The sheet tab bar is unreadable in vellum** (1.34:1 active, 2.28:1 inactive).
  2. **[P1] Undefined tokens** leak dark literals into every theme.
  3. **[P1] 68 text nodes below 11px** on the Sheet tab alone.
  4. **[P1] Inventory item names clipped to 34px** at 375px.
  5. **[P1] "DM Notes" render to the character's owner** with no role check (latent).
- Next: token sweep (Phase 3 slice 1) fixes 1–2 and most of the vellum failures across the app.

## Detailed Findings by Severity

**[P1] Sheet tab bar unreadable in vellum**
- **Location:** `character-sheet/character-sheet.component.scss:120` — `background: var(--panel-bg, rgba(18, 18, 32, 0.96))`
- **Category:** Theming / Accessibility
- **Impact:** `--panel-bg` is not defined, so every theme gets a near-black bar. Its labels use
  theme tokens, so in vellum dark ink sits on the dark bar: active tab **1.34:1**, inactive
  **2.28:1** (measured, re-verified from computed styles). This bar is the sheet's only
  navigation on a phone.
- **WCAG:** 1.4.3 Contrast (Minimum)
- **Recommendation:** `background: color-mix(in oklch, var(--surface) 96%, transparent)` and
  `border-bottom: 1px solid var(--border)`; delete the fallbacks.
- **Suggested command:** `/impeccable colorize` (narrowly — token substitution only)

**[P1] Undefined tokens with dark-only fallbacks**
- **Location:** `--panel-bg`, `--line` (`character-sheet.component.scss`, `pc-notes`, `pc-log`
  templates), `--accent` ×8 (`inventory-panel.component.scss` — falls back to the CSS named colour
  `gold`, `#ffd700`), `--bg-elev`, `--surface-1` (`editable-number.component.scss`)
- **Category:** Theming
- **Impact:** None of these resolve, so the fallback is what ships — white-alpha lines and
  `#ffd700` text that were tuned for midnight only. The reviewer measured silver / electrum /
  platinum coin amounts at about 1.0–1.3:1 in vellum.
- **Recommendation:** map each to a real token (`--line`→`--border-soft`, `--accent`→`--gold`,
  `--bg-elev`→`--surface-2`, `--surface-1`→`--surface`, `--panel-bg`→ see above). Add a CI grep
  that fails on `var(--x` for any `--x` not declared in `styles.css` (local custom properties
  such as `--dx`, `--spin` excepted).
- **Suggested command:** `/impeccable colorize`

**[P1] Functional text below the 11px floor**
- **Location:** Sheet tab: `span.skill-ability` 9px ×18, `button.condition` 10px ×17,
  `span.eyebrow` 10px ×7, `div.ability-name` 9px ×6, `button.exhaustion-pip` 10px ×6,
  `span.coin-name-abbr` 9px ×5, `div.ability-save` **8px**; Spells tab: `button.spell-prep-btn` 9px ×8
- **Category:** Accessibility
- **Impact:** These are not decoration — "STR", "save", "Prepared", condition names are what a
  player glances at. Detector: 62 `undersized-ui-text` on the Sheet tab.
- **Standard:** DESIGN.md **The 11px Floor Rule**; **The Tracking Ladder Rule** (9px Cinzel caps).
- **Recommendation:** move to `--text-11`/`--text-12` with the ladder's tracking; let density come
  from tighter gaps, not smaller type.
- **Suggested command:** `/impeccable typeset`

**[P1] Inventory item names clipped to ~34px at 375px**
- **Location:** `.equip-item-name` (`styles.css`), inventory/equipment grids
- **Category:** Responsive
- **Impact:** measured name boxes of 34px holding 156px of text — weapon names render as "R…",
  "H…". The 720px rule meant to drop `.equip-grid`/`.abilities` to one column
  (`styles.css` ~621–626) sits **before** the base rules (~668, ~783), so the base rules win and the
  mobile layout never applies.
- **Recommendation:** move the media block after the base rules (or raise specificity), then
  re-measure at 375px.
- **Suggested command:** `/impeccable adapt`

**[P1] "DM Notes" shown to the character's owner (latent visibility hazard)**
- **Location:** `panels/background-story/background-story.component.html:76-83`;
  model comment `models/pc.ts:131` (`notes?: string; // DM-only notes`)
- **Category:** Implementation Integrity (product rule)
- **Impact:** the panel renders `pc.notes` under a "DM Notes" label with no role check, and the
  backend (`character-manager-service` `PC.notes`) serialises the field to the owner. No UI
  currently *writes* `PC.notes` (only demo seed data has it), so nothing leaks in production today
  — but the first DM-notes editor would leak to players. PRODUCT.md: *the DM/player visibility
  split is a hard rule*.
- **Recommendation:** hide the block unless the viewer is the campaign DM, and strip `notes` from
  the player-facing payload server-side. A fix needs both repos.
- **Suggested command:** `/impeccable harden`

**[P2] Standing glows beyond the One Standing Glow**
- **Location:** `div.portrait.xl` (gold box-shadow), `h1.sheet-name` (gold text-shadow); reviewer
  also saw skill dots and spent spell slots glowing.
- **Category:** Implementation Integrity
- **Standard:** DESIGN.md **The Glow Is State Rule** / **The One Standing Glow**
- **Recommendation:** drop the rest glows; keep glow for focus and live state.
- **Suggested command:** `/impeccable quieter`

**[P2] Touch targets under 24px**
- **Location:** `button.exhaustion-pip` 22×22 (×6), `button.spell-prep-btn` 75×18 (×8);
  23 of 33 controls on the Sheet tab are under 44px.
- **Category:** Responsive / Accessibility — WCAG 2.5.8
- **Recommendation:** extend hit areas with padding or a `::before` inset, keep the visual size.
- **Suggested command:** `/impeccable adapt`

**[P2] One heading on a sheet of fifteen panels**
- **Location:** whole sheet — the only heading is `h1.sheet-name`; panel titles are `div`s.
- **Category:** Accessibility — WCAG 1.3.1 / 2.4.6
- **Impact:** screen-reader users cannot jump between Abilities / Skills / Spellbook.
- **Recommendation:** panel titles become `h2` (styles unchanged).
- **Suggested command:** `/impeccable harden`

**[P2] Spellbook rows are clickable `div`s containing buttons** — already recorded in
`docs/a11y-notes.md` ("Spellbook expandable rows"). Confirmed still present. → `/impeccable harden`

**[P3] Ten cards-in-cards** (detector `nested-cards` ×10). Mostly the panel-in-panel pattern the
system uses deliberately; review only when the panels are reworked. → `/impeccable distill`

**[P3] Sticky tab bar blurs a scrolling region** — `backdrop-filter: blur(8px)` repaints on every
scroll frame on low-end phones. Cheap to keep; drop it if the bar gets an opaque tone anyway.
→ `/impeccable optimize`

## Patterns & Systemic Issues

- **Undefined tokens with literal fallbacks** — the single biggest theming defect in the app
  (see §10 of the adoption plan): `--muted` ×34, `--bg-elev` ×16, `--accent` ×13, `--line`,
  `--panel`, `--panel-bg`, `--surface-1`.
- **Sub-11px labels** concentrate here and in the wizard.

## Positive Findings

- Midnight and candlelit: **0 definite contrast failures** across all five tabs.
- No horizontal page overflow at 375px; the shell honours The Panel Owns Its Scroll Rule.
- Icon-only controls are named (`aria-label`s on pips and steppers) — 0 unnamed controls.

## Recommended Actions

1. **[P1] `/impeccable colorize`** — replace the five undefined tokens; fix the tab bar.
2. **[P1] `/impeccable adapt`** — reorder the 720px block; widen targets.
3. **[P1] `/impeccable typeset`** — lift the 68 sub-11px labels onto the scale.
4. **[P1] `/impeccable harden`** — DM-notes visibility (both repos), panel headings, spell rows.
5. **[P2] `/impeccable quieter`** — remove rest glows.
6. **`/impeccable polish`** — final pass in all three themes at 375px.
