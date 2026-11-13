Method: dual-agent (A: isolated design-review sub-agent · B: detector + measured browser evidence, gathered in the parent before A's output was read). B ran in the parent rather than its own sub-agent; isolation of A from B held.

# Critique — Login / register / reset-password

**Design Health Score: 26/40 — Acceptable (near Good).** Weakest: Status, Consistency, Error
Prevention, Error Recovery (2 each). Audit: 13/20.

## Design Specificity Verdict

**LLM assessment:** authored — the strongest brand moment in the app (gold-hairline card with inset
plate, sigil, "Enter the Vault", "Inscribe Your Name"). Not a template login.

**Deterministic scan (CLI, clean browser, 375×812):** `/login` and `/register` — 3 `dark-glow` each:
`div.login-card`, `div.login-brand-name`, `button.btn.primary`. Only the button is the One Standing
Glow; the other two contradict DESIGN.md (and correct adoption plan §9). `/reset-password`, measured
in all three themes: 0 definite contrast failures; reveal toggle 16×16, "Sign in" link 37×13.

**Agreement:** the standing glows (reviewer also notes an 80px black drop shadow). **Reviewer-only,
both confirmed in source:** pages cannot scroll (`body { overflow: hidden }`), and Enter on the
username field calls `login()` twice. Also: password minimum is 6 on register but 8 on reset;
"Ask your DM for a reset link" is the wrong mechanism (an admin issues them). **Audit-only:** the
sub-24px reveal toggle.

## Overall Impression

Beautiful and nearly finished. The two real defects are mechanical and cheap.

## Priority Issues

- **[P1] Auth pages cannot scroll** — submit unreachable on small phones / keyboard up. →
  `/impeccable adapt`
- **[P1] Double submit on Enter; no in-flight state on login.** → `/impeccable harden`
- **[P2] Inconsistent password rules; unlabelled register fields.** → `/impeccable clarify`
- **[P2] Card and brand-name glow at rest** — remove, or record a login-only exception in
  DESIGN.md. → `/impeccable quieter`

**Questions skipped:** batch run across ten surfaces. The owner-direction questions this surface raises are consolidated in `docs/impeccable-adoption-plan.md` §10.

Technical detail, evidence and file locations: `.impeccable/surfaces/auth.md`.

---

## Appendix — Assessment A (design review, as written by the isolated reviewer)

### Assessment A — Login / Register / Reset password

Looked at: **`/reset-password` live** in a browser tab: with a token, without one, and the short-password error path. Widths were 375×812 and 375×420 (keyboard-open proxy); themes midnight and vellum. **`/login` and `/register` from source and styles only.** In demo mode the route guard redirected both to `/charactermanager`. I did not log out, so the shared demo flag was untouched. All three pages share `.login-page`/`.login-card` chrome (`styles.css:1376-1471`), so the live reset page stands in for the card's rendering. Source: `login/`, `register/` and `reset-password/` `.html/.ts/.scss`.

## Design specificity verdict

**Authored, and the strongest brand moment in the app.** The card is a gold-hairline frame with an inset 6px inner border, a sigil mark, "TABLE MIMIC" in tracked Cinzel with a gold halo, a gradient gold divider, and in-voice copy:
- "Enter the Vault"
- "Join the Compendium · Bind your name to the arcane record"
- "Inscribe Your Name" / "Inscribing…"
- "Forgot your password? Ask your DM for a reset link."

That is product-specific, not a template login. Coherence slips in small ways:
- The subtitle "Arcane Character Compendium" differs from the rail's "a chronicle of heroes & hauntings".
- Reset-password drops the sigil mark that its two siblings have.
- `.auth-or` asks for `'EB Garamond'` (`login.component.scss:9`), a font the app never loads.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Register shows "Inscribing…". Login has no in-flight state and the button stays live. Reset keeps its label while submitting. |
| 2 | Match with real world | 3 | Voice is excellent. "Ask your DM for a reset link" is wrong in mechanism: resets are an ADMIN authority (PRODUCT.md), not a DM one. |
| 3 | User control & freedom | 3 | Cross-links between all three pages, a demo-mode exit, and a password reveal. |
| 4 | Consistency & standards | 2 | Password minimum is 6 on register and 8 on reset and change-password. Label/input association: login and reset yes, register no. |
| 5 | Error prevention | 2 | Register's 6-character rule exists only as placeholder text. Login's username field has `(keydown.enter)="login()"` on top of form `ngSubmit` (see P2). |
| 6 | Recognition over recall | 3 | Correct `autocomplete` tokens throughout, so password managers work. |
| 7 | Flexibility & efficiency | 3 | Enter submits; one-tap demo entry. |
| 8 | Aesthetic & minimalist | 3 | Beautiful card. A standing gold glow plus a black 80px drop shadow (`styles.css:1394`) reads as a grey smudge on vellum. |
| 9 | Error recognition & recovery | 2 | Reset errors are specific and in voice. Login's "Login failed. Please try again." does not say whether it was the network or the credentials. |
| 10 | Help & documentation | 3 | The forgot-password guidance sits on the login card itself, the right help at the right moment. |
| | **Total** | **26/40** | Acceptable, near Good. |

## Cognitive load

Failures: **1 of 8, which is low**.
- **One thing at a time: fail on reset-password without a token.** It shows a full form, a disabled submit, and an error saying the link is incomplete, all at once (verified live). The user is asked to read a form they cannot use.
- Register has 6 fields in 4 rows, which is acceptable for account creation.

## Emotional journey

- **Peak:** first sight of the login card. "Enter the Vault" is the right first line for a D&D table.
- **Valleys:**
  1. On a short phone, or with the keyboard up, the card cannot be scrolled (P1).
  2. Reset success is a single dim line, "Your password has been reset.", in `--text-dim` (`reset-password.component.scss:8`). The moment of relief gets the quietest ink on the page.
- **Reassurance:** register's mismatch message appears live as you type the confirm field, which is good. Login gives nothing while waiting.

## What's working

1. **Brand and voice.** This card sets the tone for the whole product in one screen without hurting the form's legibility. Labels are 11px with 0.2em tracking, honouring *The 11px Floor Rule* (`styles.css:1204-1214`, with a comment explaining why).
2. **A11y basics already in place.** `<main>` landmark, `role="alert"` on errors, and a labelled reveal toggle that drives both password fields together.
3. **Reset-password copy.** It handles missing, invalid and expired tokens with one honest, actionable message ("ask your DM for a new one").

## Priority issues

**[P1] Auth pages cannot scroll, so the card bottom is unreachable on small phones or with the keyboard open**
- **What:** `body { overflow: hidden }` (`styles.css:171`) is meant for the app shell (*The Panel Owns Its Scroll Rule*). The auth pages, though, use `.login-page { min-height: 100vh }` with no scroll container of their own. Verified at 375×420: the reset card runs to y=435 and wheel/touch scroll stays at 0. Estimated card heights including page padding: register ≈683px, login ≈680px. Both exceed an iPhone SE's visible area before the keyboard opens.
- **Why it matters:** On a phone, a new player cannot reach "Inscribe Your Name" or "Sign in". That is *The Phone Is The Table Rule*, and it blocks onboarding.
- **Fix:** Make `.login-page` its own scroll region: `height: 100dvh; overflow-y: auto;` with `align-items: safe center` (or `margin: auto` on the card) so tall cards top-align instead of clipping. Below 480px, trim card padding from 36/40 to 24/20.
- **Suggested command:** /impeccable adapt

**[P2] Login submits twice on Enter and bypasses its own guard; no pending state**
- **What:** `login.component.html:32` binds `(keydown.enter)="login()"` on the username input inside a `<form (ngSubmit)="login()">`. Enter in that field fires both handlers, so two auth requests go out. It also calls `login()` while `form.invalid`, skipping the disabled-button guard. `login()` (`login.component.ts:30`) has no `loading` signal, so the button stays live and unlabeled during the request.
- **Why it matters:** Duplicate requests, a flash of "Invalid username or password" on an empty password, and no feedback on a slow table Wi-Fi.
- **Fix:** Delete the `(keydown.enter)` binding. Add the `loading` signal pattern already used in register: disable while pending and swap the label to "Opening the Vault…".
- **Suggested command:** /impeccable harden

**[P2] Inconsistent password rules and unlabelled register fields**
- **What:**
  - Register enforces `minLength(6)` (`register.component.ts:29`), with the rule shown only as placeholder "Min. 6 characters".
  - Reset and settings change-password require 8 (`reset-password.component.ts:56`, settings placeholder "At least 8 characters").
  - Register's `<label>`s have no `for`/`id` (`register.component.html:27-77`), so every field is unlabelled to a screen reader.
  - The "Confirm" label is ambiguous out of context.
- **Why it matters:** A player who registers with 6 characters later cannot reuse that password on reset. Sam hears "edit text" six times.
- **Fix:** Use one minimum (8) everywhere, stated as visible helper text under the password field rather than as a placeholder. Add `id`/`for` pairs; rename "Confirm" to "Confirm password".
- **Suggested command:** /impeccable clarify

**[P2] Reset-password dead-end and flat success**
- **What:** With no token, the form renders with a disabled button and the error below it (verified). On success, the confirmation is one `--text-dim` line.
- **Fix:** With no token, hide the form and show only the message plus "Back to Sign In". On success, use `--text` and the panel-title treatment ("Your password is renewed"), keeping the primary button.
- **Suggested command:** /impeccable polish

## Persona red flags

- **Jordan (first-timer, invited by the DM):**
  - The register card on a phone clips the submit.
  - The password rule is invisible once you start typing.
  - Nothing tells them that after registering they need the DM's invite code to join the table.
- **Casey:** the 2-column password row at 375px gives each input about 125px, so masked text plus the eye icon is tight. There is no pending state on login over bad Wi-Fi.
- **Sam:** register fields are unlabelled. The `reveal-toggle` hit area is a bare 16px icon (`styles.css:1267-1280`).

## Minor observations

- Vellum: the `.login-page` celestial wash renders as a grey-blue smudge top-left, and the literal `rgba(0,0,0,.6)` 80px shadow looks dirty on parchment. Use `--shadow`, which vellum already softens to `0 4px 16px` with warm brown.
- The `.login-card` gold glow at rest (`styles.css:1394`) is a second standing glow, against *The One Standing Glow*.
- `.auth-or` font-family `'EB Garamond'` should be `Newsreader`.
- `register.component.scss` re-declares `.auth-footer`/`.auth-link`, duplicating the globals.
- The "Enter in Demo Mode" button gets equal visual weight with the primary on a real deployment. Consider making it a link-style secondary for real users.

## Questions to consider

1. Should "Forgot your password?" name *who* can help ("ask your table's admin") now that DM and ADMIN are separate authorities?
2. Could register end by asking for the invite code, so a new player lands seated at the table instead of on an empty roster?
3. Is the 80px black shadow doing anything on midnight that the gold hairline and inner border are not already doing?
