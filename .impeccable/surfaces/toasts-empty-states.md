# Audit — Toasts and empty states

Target: `src/app/charactermanager/components/toast/`, `character-sheet/empty-state`, and the empty
states of the roster, campaign view, curated lists and roll log. The toast was raised through
Angular's dev API (`NotificationService.notify`) since demo mode has nothing that fires one.
Measured at 375×812 in all three themes. Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Toast has no keyboard dismiss; curated empty states 1.16:1 in vellum |
| 2 | Performance | 4 | Fine |
| 3 | Theming | 2 | Empty-state copy in curated lists uses undefined `--muted` |
| 4 | Responsive Design | 2 | Toast squeezed to 188px on a 375px phone |
| 5 | Implementation Integrity | 3 | Empty states are on-voice; toast radius off-system |
| **Total** | | **14/20** | **Good** |

## Implementation Integrity Verdict

**Pass.** The empty states are some of the best writing in the app ("No hero selected — Choose a
name from the chronicle, or inscribe a new soul to begin") and render cleanly in midnight and
candlelit. The toast's live region is set up correctly on the host. Defects are layout and theming.

## Executive Summary

- **14/20 — Good.** P0: 0 · P1: 1 · P2: 3 · P3: 1

## Detailed Findings by Severity

**[P1] Curated-list empty states invisible in vellum** — "No loot lists yet…", "No curated shops
yet…", and the session loot panel's "No curated loot lists yet —" use `var(--muted, rgba(255,255,255,.6))`:
**1.16:1**. These sentences are the only instructions for those features. (Same root cause as the
campaign-dashboard and session-mode findings.) → `/impeccable colorize`

**[P2] Toast squeezed to half the phone** — `.toast { position: fixed; left: 50%; transform:
translateX(-50%); max-width: 92vw }` (`toast.component.scss`). A shrink-to-fit box starting at
`left: 50%` can only use the remaining half, so at 375px it measured **188px wide, 85px tall** for a
one-line message. Use `left: 16px; right: 16px; margin-inline: auto; width: fit-content`.
→ `/impeccable adapt`

**[P2] Toast cannot be dismissed from the keyboard** — click-anywhere dismiss on a `div` (already in
`docs/a11y-notes.md`). Add a labelled close button. → `/impeccable harden`

**[P2] Toast off-system** — `border-radius: 10px` and a `0 10px 30px` drop shadow. DESIGN.md allows
the ambient shadow for things that "genuinely sit above the page", which a toast does; the 10px
corner is the real drift (**Shapes**: 2–3px). → `/impeccable polish`

**[P3] Empty-state subtitle sits on the decorative wash** — `div.empty-sub` (`--text-dim`, 16px
italic) is 6.31:1 on the solid ground; only a worst-case stacking of both radial washes would pull it
under AA, which does not happen at its position. No action; noted so it is not re-raised.

## Positive Findings

- Toast host carries `role="status" aria-live="polite"` permanently, so messages are announced.
- Empty states always include the next action ("Forge a Hero").
- 0 definite failures in midnight and candlelit.

## Recommended Actions

1. **[P1] `/impeccable colorize`** — `--muted` → `--text-dim`.
2. **[P2] `/impeccable adapt`** — toast width.
3. **[P2] `/impeccable harden`** — toast close button.
4. **`/impeccable polish`**
