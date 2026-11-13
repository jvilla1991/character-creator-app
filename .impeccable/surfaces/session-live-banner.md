# Audit — Session live banner

Target: `src/app/charactermanager/components/session-live-banner/` (banner + "Join the Session"
picker modal). **Source review only for the audit** — demo mode disables multi-client discovery, so
the banner never renders on its own. (The design reviewer forced it to render via the component's
`live` signal; see `.impeccable/critique/session-live-banner.md`.) Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2 | Banner appearance is not announced; picker `select` unnamed; no Escape |
| 2 | Performance | 4 | Trivial |
| 3 | Theming | 2 | Literal `rgba(120,170,255,0.08)` tint; mismatched fallbacks |
| 4 | Responsive Design | 3 | Stacks to a full-width button under 560px — good |
| 5 | Implementation Integrity | 2 | 12px radius and inline styles off-system |
| **Total** | | **13/20** | **Acceptable** |

## Implementation Integrity Verdict

**Pass, small drift.** Right idea — a celestial call-to-action that only appears when something is
live, which is precisely what DESIGN.md reserves celestial for. Built slightly outside the system.

## Executive Summary

- **13/20 — Acceptable.** P0: 0 · P1: 1 · P2: 3 · P3: 1

## Detailed Findings by Severity

**[P1] Session-start is silent to assistive tech** — `div.session-banner` appears with no
`role="status"`/live region (`session-live-banner.component.html:3`). The one moment a player most
needs to know about is unannounced. Put a live region on an always-present host (as the toast does).
→ `/impeccable harden`

**[P2] Picker `select` has no accessible name** — `<label>Character</label>` is not bound to the
`select` (no `for`/`id`) — line ~26. → `/impeccable harden`

**[P2] Off-system corner and tint** — `border-radius: 12px` (**The Hairline Rule** / Shapes:
2–3px house voice) and `background: rgba(120,170,255,0.08)` (literal). Use
`color-mix(in oklch, var(--celestial) 8%, transparent)` and `--radius-panel`. → `/impeccable colorize`

**[P2] Inline styles in the picker** — four `style="color: var(--…)"` attributes; part of the app's
190 inline `style=` uses. → `/impeccable polish`

**[P3] No Escape on the picker** (`cdkTrapFocus` is present — good — but `appEscapeClose` is not).
→ `/impeccable harden`

## Positive Findings

- Picker traps focus (`cdkTrapFocus cdkTrapFocusAutoCapture`) and is labelled.
- Mobile layout is deliberate: text over a full-width "Join Session".
- Empty eligible-hero state explains why ("Join the campaign first").

## Recommended Actions

1. **[P1] `/impeccable harden`** — live region, select label, Escape.
2. **[P2] `/impeccable colorize`** — tint and radius onto tokens.
3. **`/impeccable polish`**
