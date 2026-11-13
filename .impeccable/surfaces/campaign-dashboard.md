# Audit — Campaign dashboard

Target: `src/app/charactermanager/components/campaign-dashboard/` (header, party-board,
party-treasury, curated-shops / -encounters / -loot, campaign-notes, campaign-week). Measured as DM
on "The Veiled Compass" at 375×812 in all three themes. The three curated sections are `@defer (on
viewport)` and were measured after a real scroll loaded them. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Curated-list copy 1.13–1.16:1 in vellum; note buttons 18×16 |
| 2 | Performance | 3 | `@defer` on the heavy curated sections — good |
| 3 | Theming | 1 | 44 white-alpha literals; `--muted` / `--bg-elev` undefined in all three curated lists |
| 4 | Responsive Design | 2 | 4-up stat strip clips "CONDITIONS" at 375px |
| 5 | Implementation Integrity | 2 | Strong product voice; nested interactive rows; standing glows |
| **Total** | | **10/20** | **Acceptable** |

## Implementation Integrity Verdict

**Pass on voice, fail on theming.** The header (campaign name in display caps, setting and arc in
italic, invite chip) is the most "Astral Chart" composition in the app. But the three curated lists
were written against tokens that do not exist, so in vellum the DM's whole preparation area loses
its secondary text.

## Executive Summary

- **10/20 — Acceptable.** P0: 0 · P1: 3 · P2: 4 · P3: 1
- Top issues:
  1. **[P1] Vellum: curated encounters / loot / shops secondary text at 1.13–1.16:1.**
  2. **[P1] Clickable list rows contain a nested "Copy JSON" button** (known, deferred).
  3. **[P1] Note edit/delete buttons are 18–20×16px.**
  4. **[P2] Stat strip clips its own label at 375px.**

## Detailed Findings by Severity

**[P1] Curated lists lose their secondary text in vellum**
- **Location:** `curated-encounters`, `curated-loot`, `curated-shops` `.scss` —
  `var(--muted, rgba(255,255,255,0.6))` ×6 / ×6 / ×5 (+0.5/0.7 variants), `var(--bg-elev, …)`.
- **Category:** Theming / Accessibility
- **Impact:** measured in vellum: `div.shop-sub` "3 creatures" **1.16:1**, row chevron **1.13:1**,
  the empty-state instructions ("No loot lists yet. Create one, fill it with spoils, then drop it
  from Session Mode.") **1.16:1**. The empty state is the onboarding for this feature.
- **Recommendation:** `--muted` → `--text-dim`, `--bg-elev` → `--surface-2`.
- **Suggested command:** `/impeccable colorize`

**[P1] Nested interactive rows** — `li.shop-row` opens on click and contains "Copy JSON"
(`curated-shops.component.html:32`, `curated-loot…:16`, `curated-encounters…:16`). Already in
`docs/a11y-notes.md`; confirmed. Fix: name becomes the button. → `/impeccable harden`

**[P1] Tiny note controls** — `button.note-del` "Edit note" 20×16 and "Delete note" 18×16, adjacent
(`campaign-notes`). Below WCAG 2.5.8's 24px and easy to hit the wrong one on a phone; delete has no
confirm. → `/impeccable adapt`

**[P2] Stat strip clips at 375px** — Heroes / Avg Level / Top Pass. Perc / Conditions stay four-up;
"CONDITIONS" is clipped and "TOP PASS. PERC" wraps to three lines. Go 2×2 below 480px.
→ `/impeccable adapt`

**[P2] Sub-11px labels** — 15 nodes: `span.eyebrow` 10px ×5, `span.num` 9px ×3,
`span.board-cond` **8px** ×2, `span.label` 10px. **The 11px Floor Rule.** → `/impeccable typeset`

**[P2] Standing glows** — `h1.sheet-name` gold text-shadow on the campaign title, besides the
primary button. **The One Standing Glow.** → `/impeccable quieter`

**[P2] Party-board hero names truncate** (`div.board-hero-name` 118px for 130px of name). Reuse the
phone row design from the session board. → `/impeccable adapt`

**[P3] Cards-in-cards** — `div.note` inside the notes panel (detector `nested-cards` ×2). Fine as is.

## Positive Findings

- Midnight and candlelit: **0 definite failures** on the whole dashboard.
- `@defer (on viewport)` keeps the heavy curated sections off first paint.
- Destructive "Delete this campaign" is an icon button with a proper `aria-label`.
- Party treasury and campaign week: clean in all three themes.

## Recommended Actions

1. **[P1] `/impeccable colorize`** — curated-list tokens.
2. **[P1] `/impeccable harden`** — row/name button split; delete-note confirm.
3. **[P1] `/impeccable adapt`** — note targets, stat strip, hero-name rows.
4. **[P2] `/impeccable typeset`**, **`/impeccable quieter`**
5. **`/impeccable polish`**
