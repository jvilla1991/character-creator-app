# Audit — Sidenav + roster

Target: `src/app/charactermanager/components/sidenav/`, `campaign-sidebar`, `main-content` (shell
and empty state). Measured at 375×812 (mobile drawer open and closed) in all three themes, as player
(roster) and DM (campaign list). Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Drawer has no dialog semantics, focus move or trap; no headings |
| 2 | Performance | 3 | Two `backdrop-filter` blurs on drawer + scrim |
| 3 | Theming | 4 | 0 hexes, 0 definite contrast failures in any theme |
| 4 | Responsive Design | 2 | Choosing a campaign leaves the drawer open over what it loaded |
| 5 | Implementation Integrity | 2 | Rows are `div`s with click handlers; standing glows |
| **Total** | | **13/20** | **Acceptable** |

## Implementation Integrity Verdict

**Pass.** The cleanest surface in the app for theming — no literal colours, nothing fails contrast
in any theme. Its problems are behavioural (drawer focus and dismissal) and the 10px labels.

## Executive Summary

- **13/20 — Acceptable.** P0: 0 · P1: 2 · P2: 3 · P3: 1

## Detailed Findings by Severity

**[P1] Mobile drawer is not a dialog** — opening the drawer leaves focus on
`button.mobile-menu-btn`; no `role="dialog"`/`aria-modal`, no `inert` on the page behind, scrim is
click-only. Already in `docs/a11y-notes.md` ("Sidenav drawer scrim"); confirmed in-browser. Fix:
move focus to the first row, trap it, Escape closes, `inert` the main column.
→ `/impeccable harden`

**[P1] Selecting a campaign or hero does not close the drawer** — at 375px, tapping "The Veiled
Compass" loads the dashboard *behind* the drawer, which stays open. Every navigation costs a second
tap on the scrim. → `/impeccable adapt`

**[P2] Roster and campaign rows are clickable `div`s** — `div.roster-item`, `div.campaign-item`,
`div.account-row`. They carry `tabindex`/labels, but are not buttons/links. → `/impeccable harden`

**[P2] Sub-11px labels** — `div.roster-level` "L7" 10px ×3, `span.party-name` "Your Campaigns" 10px,
`span.party-count` 10px; `div.brand-sub` is 11px italic body (detector `tiny-text`).
**The 11px Floor Rule.** → `/impeccable typeset`

**[P2] No headings in the shell** — the empty state's "No Hero Selected" / "No Campaign Chosen" is
a `div`; the page has no `h1` until a sheet opens. → `/impeccable harden`

**[P3] Primary button glow in the drawer footer** — "New Campaign"/"Forge Hero" are `.btn.primary`:
this *is* The One Standing Glow, expected output.

## Positive Findings

- **0 definite contrast failures in all three themes; 0 literal colours.**
- Active row carries a left gold marker and `aria-current`, as DESIGN.md specifies.
- Menu button is labelled ("Open party menu"); controls are all named.

## Recommended Actions

1. **[P1] `/impeccable harden`** — drawer focus/trap/Escape/inert; real buttons; headings.
2. **[P1] `/impeccable adapt`** — close the drawer on navigation below 820px.
3. **[P2] `/impeccable typeset`** — 10px labels.
4. **`/impeccable polish`**
