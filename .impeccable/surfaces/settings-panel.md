# Audit — Settings panel

Target: `src/app/charactermanager/components/settings-panel/` (+ `role-switch`), opened from the
account row. Measured at 375×812 in all three themes. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Escape does not close; a toggle and an input have no name; 9–10px labels |
| 2 | Performance | 3 | Fine |
| 3 | Theming | 3 | One vellum near-miss (4.3:1); swatches correctly show each theme |
| 4 | Responsive Design | 3 | Full-height slide-over fits 375px; 8 of 14 controls under 44px |
| 5 | Implementation Integrity | 2 | Slide-over and selected role glow at rest |
| **Total** | | **13/20** | **Acceptable** |

## Implementation Integrity Verdict

**Pass with drift.** The panel is well-organised (role, account, theme, dice) and the theme
swatches are the right idea. Two rest glows break the glow rule, and the small labels break the
floor.

## Executive Summary

- **13/20 — Acceptable.** P0: 0 · P1: 3 · P2: 3 · P3: 0

## Detailed Findings by Severity

**[P1] Escape does not close the slide-over** — focus correctly lands on `button.slideover-close`,
but `keydown Escape` leaves it open (verified). Add `appEscapeClose`. → `/impeccable harden`

**[P1] Unnamed controls** — the dice-option `button.toggle` switches and one `input` (account field)
have no accessible name; the visible text beside them is not associated. Use `role="switch"` +
`aria-checked` + `aria-labelledby`. → `/impeccable harden`

**[P1] Display name and email look editable but save nothing** — `settings-panel.component.html:37`
binds `<input [value]="user.email">` with no model and no save action (display name likewise). A user
edits, closes, and the change silently disappears. Make them read-only text, or wire a save.
(Design review finding, confirmed in source.) → `/impeccable harden`

**[P2] Sub-11px labels** — `div.theme-swatch-label` 9px ×3, `button.role-seg` 10px ×2, roll-style
segment 9px ×2. **The 11px Floor Rule.** → `/impeccable typeset`

**[P2] Glows at rest** — `aside.slideover` carries a gold box-shadow glow, and the selected
`button.role-seg.dm` a **celestial** glow. DESIGN.md: "a celestial glow at rest is always a bug".
Selected state should raise the fill, as the Chips spec says. → `/impeccable quieter`

**[P2] Vellum near-miss** — selected roll-style segment "digital" 9px at **4.3:1**. Fixing the 9px
size (above) probably moves this; re-measure after. → `/impeccable colorize`

## Positive Findings

- `role="dialog"` with a label ("Profile and settings"); focus moves in on open.
- Midnight and candlelit: 0 definite failures.
- Theme swatches preview each theme in its own colours — the right affordance for The Three Themes Rule.

## Recommended Actions

1. **[P1] `/impeccable harden`** — Escape, switch semantics, field labels.
2. **[P2] `/impeccable typeset`**, **`/impeccable quieter`**
3. **`/impeccable polish`**
