# Audit — Create-character wizard (9 steps)

Target: `src/app/charactermanager/components/create-character-modal/` and `steps/*` (species,
class, background, ability scores, proficiencies, spells, equipment, identity, review) plus
`steps/_wizard-shared.scss`. Measured at 375×812 in all three themes on the ability-scores step (the
wizard reopened on a saved draft at step 6); the other steps were covered by static analysis and by
the design review. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | Vellum: ability labels 1.11:1, future step numbers 1.06:1; no step announcement |
| 2 | Performance | 3 | One infinite pulse; otherwise fine |
| 3 | Theming | 0 | An off-palette violet (`#8a5cf6`, `#a78bfa`) and 49 white-alpha literals |
| 4 | Responsive Design | 2 | Fits 375px; 11 of 13 controls under 44px |
| 5 | Implementation Integrity | 2 | Reads as a different product from the rest of the app |
| **Total** | | **8/20** | **Poor (major overhaul)** |

## Implementation Integrity Verdict

**Fail.** The wizard is the one surface that never joined The Astral Chart. Its progress dots,
selection accents and checkboxes are a saturated violet (`#8a5cf6`, `#a78bfa`) that appears in no
DESIGN.md token, and its text is written as `rgba(255,255,255,…)` throughout. The detector's
`dark-glow` on `div.step-dot.active` (#8a5cf6) is the generic "AI purple" the slop rules describe —
here a genuine true positive. In midnight this reads as "a slightly different app"; in vellum it
breaks outright.

## Executive Summary

- **8/20 — Poor.** P0: 1 · P1: 4 · P2: 2 · P3: 1
- Top issues:
  1. **[P0] Vellum: the ability-score labels are white on parchment** (STR/DEX/… 1.11:1).
  2. **[P1] Off-palette violet** in progress, selection and checkboxes.
  3. **[P1] Future step numbers 1.06:1 vellum, 3.1:1 midnight/candlelit.**
  4. **[P1] 19 sub-11px values** in wizard styles — 7–10px method tabs and badges.
  5. **[P1] No "step N of M" for assistive tech** (already in `docs/a11y-notes.md`).

## Detailed Findings by Severity

**[P0] Ability labels invisible in vellum**
- **Location:** `steps/ability-scores-step/ability-scores-step.component.scss:17` (`.ability-label`,
  white-alpha), `review-step.component.scss:144` (`.review-ability-label`)
- **Category:** Theming / Accessibility
- **Impact:** STR / DEX / CON / INT / WIS / CHA measure **1.11:1** in vellum (visually confirmed:
  white text on parchment). A player assigning scores cannot see which row is which ability. P0
  because the step cannot be completed reliably in that theme.
- **WCAG:** 1.4.3
- **Recommendation:** `color: var(--text-2)`; sweep every `rgba(255,255,255,…)` in `steps/` to
  `--text` / `--text-2` / `--text-dim` / `--border*`.
- **Suggested command:** `/impeccable colorize`

**[P1] Off-palette violet accent**
- **Location:** `create-character-modal.component.scss:87-88` (`.step-dot.active` `#8a5cf6`),
  `ability-scores-step.component.scss:34`, `background-step.component.scss:31` (`accent-color`),
  `spells-step` / `proficiencies-step` `#a78bfa` ×4 each
- **Category:** Theming / Implementation Integrity
- **Standard:** **The Three Themes Rule** ("never write a literal colour"), **The Scarce Accent Rule**
- **Recommendation:** progress and selection use `--gold` (active) / `--celestial` (done); native
  controls `accent-color: var(--gold)`. This is *folding into tokens*, not a repaint.
- **Suggested command:** `/impeccable colorize`

**[P1] Step progress unreadable**
- **Location:** `.step-dot` future state (`create-character-modal.component.scss:65+`)
- **Impact:** future step numbers **1.06:1 vellum**, **3.1:1 midnight and candlelit**; the active
  dot's violet glow is a standing glow.
- **Recommendation:** future numbers `--text-dim` on `--surface-2`; drop the glow.
- **Suggested command:** `/impeccable colorize`

**[P1] Sub-11px text**
- **Location:** `span.ruleset-active` 9px, `span.ruleset-coming-soon` **8px**,
  `button.score-method-tab` 10px, `span.score-method-soon` **7px**; 19 sub-11px values across the
  wizard's stylesheets (the most of any surface).
- **Standard:** **The 11px Floor Rule**
- **Suggested command:** `/impeccable typeset`

**[P1] No step announcement** — `.wizard-steps` is visual only. Already recorded in
`docs/a11y-notes.md` ("Create-character wizard step dots"); confirmed. → `/impeccable harden`

**[P2] Unlabelled ability `select`s** — `select.ability-select` ×6 and the background-bonus selects
have no accessible name; the visible "STR" is not a `<label for>`. → `/impeccable harden`

**[P2] No Escape to close** — the wizard modal does not use `appEscapeClose` (only dice roller and
level-up do). → `/impeccable harden`

**[P3] "Coming soon" options occupy primary real estate** — "2014 5e" and "Roll Dice" are disabled
placeholders at the top of the flow (disabled text is exempt from contrast, but they cost a phone
row each). → `/impeccable distill`

## Patterns & Systemic Issues

- **49 white-alpha literals** — second only to session mode. Together with the violet these make
  the wizard the strongest single argument for the token sweep.

## Positive Findings

- The dialog is labelled ("Create a character") and focus moves into it on open.
- No horizontal overflow at 375px; Back/Next are full-width and thumb-reachable.

## Recommended Actions

1. **[P0] `/impeccable colorize`** — white-alpha → tokens; violet → gold/celestial.
2. **[P1] `/impeccable typeset`** — 7–10px labels.
3. **[P1] `/impeccable harden`** — step status line, select labels, Escape.
4. **[P3] `/impeccable distill`** — demote "coming soon" placeholders.
5. **`/impeccable polish`**
