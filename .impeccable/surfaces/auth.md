# Audit — Login / register / reset-password

Target: `src/app/charactermanager/components/login`, `register`, `reset-password` and the
`.login-*` rules in `src/styles.css`. `/login` and `/register` redirect a signed-in visitor, so they
were scanned with the detector CLI's clean browser (`--viewport 375x812`, midnight only);
`/reset-password` was measured in-page in all three themes. Login contrast in all three themes was
already fixed and verified in Phase 0 (adoption plan §8). Method: [README](README.md).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | Password reveal toggle 16×16; "Sign in" link 13px tall |
| 2 | Performance | 3 | Fine |
| 3 | Theming | 4 | 0 hexes; 0 definite failures (reset-password, all themes) |
| 4 | Responsive Design | 1 | Page cannot scroll (`body { overflow: hidden }`); two sub-24px targets |
| 5 | Implementation Integrity | 2 | Double-submit on Enter; two standing glows beyond the One Standing Glow |
| **Total** | | **13/20** | **Acceptable** |

## Implementation Integrity Verdict

**Pass.** Phase 0 already fixed the label size and placeholder contrast here. One correction to
the record: adoption plan §9 says the login page's three `dark-glow` findings are "all the One
Standing Glow". They are not — only `button.btn.primary` is. The other two are
`div.login-card` (gold box-shadow) and `div.login-brand-name` (gold text-shadow), both glowing at
rest.

## Executive Summary

- **13/20 — Acceptable.** P0: 0 · P1: 3 · P2: 2 · P3: 1

## Detailed Findings by Severity

**[P1] Password reveal toggle is 16×16** — `button.reveal-toggle` (reset-password; shared pattern).
WCAG 2.5.8 minimum is 24×24, and it sits inside the input where a mis-tap focuses the field.
Extend the hit area to 40px with padding. → `/impeccable adapt`

**[P1] Enter on the username field logs in twice** — `login.component.html:32` binds
`(keydown.enter)="login()"` on an input inside `<form (ngSubmit)="login()">` (line 23), and Enter in
a form input also fires implicit submission. Two concurrent `login()` calls; on a slow table Wi-Fi
that can surface as a spurious error. Remove the keydown binding. (Found by the design review,
confirmed in source.) → `/impeccable harden`

**[P1] Auth pages cannot scroll** — `body { overflow: hidden }` (The Panel Owns Its Scroll Rule)
applies to the auth screens too, which have no panel scroll of their own, so a register card taller
than a small phone's viewport (or a phone with the keyboard up) is clipped with no way to reach the
submit button. Give `.login-page` `overflow-y: auto; height: 100dvh`. (Design review finding; the
rule is confirmed in `styles.css`.) → `/impeccable adapt`

**[P2] Card and brand name glow at rest** — `div.login-card`, `div.login-brand-name`.
DESIGN.md **The One Standing Glow**: "a second standing glow is a bug". Either remove them, or — if
the owner wants the login page to stay the one ceremonial screen (plan §5 lists `bolder` as a
possible exception here) — record that exception in DESIGN.md so the detector findings stop being
ambiguous. → `/impeccable quieter`

**[P2] "Sign in" text link is 37×13** — `a.auth-link`. Inline-text links are exempt from 2.5.8, but
on a phone this is the only way back from reset. Give it block padding. → `/impeccable adapt`

**[P3] "Reset link incomplete" error is the first thing shown** when the page is opened without a
token — correct, but it sits under the form rather than replacing it, so the inputs look usable.
→ `/impeccable clarify`

## Positive Findings

- Labels at 11px, placeholder token at `opacity: 1` — the Phase 0 fixes hold.
- 0 literal colours, 0 definite contrast failures in all three themes.
- The in-world voice ("Enter the Vault") is intact.

## Recommended Actions

1. **[P1] `/impeccable harden`** — remove the duplicate Enter handler.
2. **[P1] `/impeccable adapt`** — let the auth page scroll; reveal toggle and link targets.
2. **[P2] `/impeccable quieter`** — or a DESIGN.md exception for the login card.
3. **`/impeccable polish`**
