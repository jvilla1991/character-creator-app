# Audit — Modals

Target: `dice-roller-modal`, `level-up-modal`, `item-composer`, `spell-picker`,
`character-sheet/dm-edit-modal`, plus `main-content/delete-confirmation-modal`,
`create-campaign-modal`, `join-campaign-modal` and the global `.modal*` rules in `src/styles.css`.
Dice roller and level-up were measured in-browser at 375×812 in all three themes; the others by
static analysis and by the design review. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Escape works on 2 of ~10 dialogs; level-up leaves focus on `<body>` |
| 2 | Performance | 3 | Dice physics is the only heavy thing, and it is scoped to its modal |
| 3 | Theming | 2 | Level-up 24 white-alpha literals; item composer `--accent`/`--panel` undefined |
| 4 | Responsive Design | 2 | Level-up: 69 sub-24px targets in a 1,262px-tall dialog on a phone |
| 5 | Implementation Integrity | 2 | No shared modal chrome — each dialog re-implements close, title and focus |
| **Total** | | **11/20** | **Acceptable** |

## Implementation Integrity Verdict

**Fail on consistency.** The dice roller is the best-built dialog in the app — labelled, modal,
focus on close, Escape works, reduced-motion handled. That quality did not propagate: the family has
no shared shell, so Escape, focus placement, titles and corner radii vary dialog to dialog.

## Executive Summary

- **11/20 — Acceptable.** P0: 0 · P1: 4 · P2: 3 · P3: 1

## Detailed Findings by Severity

**[P1] Escape closes only two dialogs** — `appEscapeClose` is used by dice-roller and level-up only.
Verified: dice roller and level-up close on Escape; the settings slide-over does not. Delete
character, create/join campaign, manage party, delete campaign, session picker, long rest, item
composer, spell picker and DM edit do not. Already in `docs/a11y-notes.md`. → `/impeccable harden`

**[P1] Disabled primary actions look enabled** — no `.btn:disabled` style exists in `styles.css`
(only `.spell-cast-btn:disabled`), so "Save", "Answer the Call", "Inscribe" and "Roll" look tappable
while inert. (Design review finding, confirmed in source.) → `/impeccable harden`

**[P1] Level-up leaves focus on `<body>`** — opened from the sheet, `document.activeElement` was
`BODY`; a keyboard or switch user starts outside the dialog. Dice roller does this right
(focus to `button.dice-close`). → `/impeccable harden`

**[P1] Level-up is a 1,262px scroll with 69 sub-24px targets on a phone** — spell-choice checkboxes
are native 13×13; `span.slot-lvl` 9.92px ×4. Make each choice row the label (full-row hit area) and
lift labels to 11px. **The 11px Floor Rule**, WCAG 2.5.8. → `/impeccable adapt`

**[P2] Undefined tokens in the item composer** — `var(--accent, gold)` ×5 (CSS named `#ffd700` in
every theme) and `var(--panel, rgba(0,0,0,0.2))`. → `/impeccable colorize`

**[P2] White-alpha literals in level-up** — 24 `rgba(255,255,255,…)`; same vellum risk as the
wizard. → `/impeccable colorize`

**[P2] Dice roller: "d4" label 4.16:1 in every theme, and a 9px button** — `span.die-label` sits on
the die face colour; `button.btn.sm` 9px. In vellum the empty-field hint "Your dice field is empty —
drag dice here" measures 2.24:1. → `/impeccable typeset`

**[P3] Dialog titles are not headings** — `dice-roller-title`, `level-up-title` are `div`s used via
`aria-labelledby` (labelled correctly, but not navigable as headings). → `/impeccable harden`

## Patterns & Systemic Issues

- A single `<app-modal>` shell (title, close, Escape, focus-in, `cdkTrapFocus`, 3px radius) would
  close most of this list at once. That is extraction work rather than a fix — a candidate for the
  `extract` command once the a11y slice lands.

## Positive Findings

- Every dialog measured has `role="dialog"`, `aria-modal="true"` and a label.
- Dice roller: focus, Escape, reduced motion, named controls — the reference implementation.
- Midnight and candlelit: 0 definite failures on level-up.

## Recommended Actions

1. **[P1] `/impeccable harden`** — Escape everywhere, focus-in on open, heading titles.
2. **[P1] `/impeccable adapt`** — level-up choice rows on a phone.
3. **[P2] `/impeccable colorize`** — item composer tokens, level-up literals.
4. **[P2] `/impeccable typeset`** — dice labels.
5. **`/impeccable polish`**
