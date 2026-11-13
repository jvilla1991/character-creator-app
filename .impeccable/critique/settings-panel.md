Method: dual-agent (A: isolated design-review sub-agent · B: detector + measured browser evidence, gathered in the parent before A's output was read). B ran in the parent rather than its own sub-agent; isolation of A from B held.

# Critique — Settings panel

**Design Health Score: 23/40 — Acceptable.** Weakest: Status, Control, Consistency, Error
Prevention (2 each). Audit: 13/20.

## Design Specificity Verdict

**LLM assessment:** authored in its look (gold-hairline slide-over, theme swatches that preview
each theme, "Critical fanfare"), generic in its structure — a stock profile drawer with account
fields first and four different control idioms for single choices.

**Deterministic scan:** `dark-glow` on `aside.slideover` (gold) and `button.role-seg.dm`
(**celestial** — "always a bug" per DESIGN.md), `theme-swatch.active`; `undersized-ui-text` on swatch
labels (9px) and role segments (10px). Measured: one vellum near-miss (4.3:1, 9px "digital");
Escape does not close; a toggle and an input are unnamed.

**Agreement:** unnamed toggles, false-affordance account fields (confirmed: `[value]` with no save),
no Escape, sub-floor labels. **Reviewer-only:** the role switch — which rebuilds the whole app — is
styled and behaves like a preference, with no acknowledgement; "Default Theme" sets the current
theme; errors lack `role="alert"`. **Detector-only:** the celestial rest glow.

## Overall Impression

Pleasant, but the most consequential control in the app (DM ↔ player) is hidden among dice
preferences and gives no feedback when it changes everything.

## Priority Issues

- **[P1] Toggles and choice buttons have no names or states.** → `/impeccable harden`
- **[P1] Account fields look editable and save nothing.** → `/impeccable harden`
- **[P2] Role switch reads as a preference, no feedback.** → `/impeccable layout`, `/impeccable clarify`
- **[P2] Sub-floor text and gold saturation** (every title gold + border + glow). →
  `/impeccable typeset`, `/impeccable quieter`

**Questions skipped:** batch run across ten surfaces. The owner-direction questions this surface raises are consolidated in `docs/impeccable-adoption-plan.md` §10.

Technical detail, evidence and file locations: `.impeccable/surfaces/settings-panel.md`.

---

## Appendix — Assessment A (design review, as written by the isolated reviewer)

### Assessment A — Settings panel (role switch, theme picker)

Looked at: the settings slide-over opened from the account row, in a browser tab at 375×812, in the midnight theme. I used the role switch (DM → Player → back to DM) and inspected all its controls through the DOM. Theme rendering in vellum and candlelit was covered via the swatches and the global token review. Source: `settings-panel.component.html/.ts`, `role-switch/`, and `styles.css:1479-1522, 1745-1898`. Not exercised: the change-password and admin reset-link sections, which are hidden in demo mode, so I reviewed them from source. I restored `tm_role` to `dm` (what I found) after my switch. Later in the session another reviewer set it to `player`; I left that alone.

## Design specificity verdict

**Authored in its look, generic in its structure.** The look is right:
- a gold-hairline slide-over with a big Cinzel name and gold-ringed portrait,
- theme swatches that preview each theme's ground, gold and accent bars,
- "Critical fanfare — celebrate natural 20s",
- a crowned "Dungeon Master" segment.

The *structure* is a stock profile/settings drawer. Account fields come before preferences, and four different control idioms are used for what are all single choices (tabs, mini-segments, toggles, swatches). The role switch, the most consequential control here because it swaps the entire app, is styled like a preference.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Switching role rebuilds the whole app behind the panel with no acknowledgement. "Password changed." is a dim 12px line. |
| 2 | Match with real world | 3 | Good copy. "Default Theme" actually sets the *current* theme. |
| 3 | User control & freedom | 2 | No Escape to close (none in `settings-panel.component.ts`). Close ✕ is 28×28. Sign Out has no confirmation, and in demo it ends the demo. |
| 4 | Consistency & standards | 2 | Four control types for single choices. Role switch is `role="tablist"`/`tab` with no tabpanel. |
| 5 | Error prevention | 2 | Display Name / Email look editable but have no save, so edits silently vanish. |
| 6 | Recognition over recall | 3 | Theme swatches show the theme rather than naming it. |
| 7 | Flexibility & efficiency | 2 | No keyboard shortcut for theme or role. Fine for frequency. |
| 8 | Aesthetic & minimalist | 2 | Every section title is gold, plus a gold border, gold glow, gold active swatch, gold "digital" and gold toggles. *The Scarce Accent Rule* fails. |
| 9 | Error recognition & recovery | 2 | `passwordError` / `resetError` render without `role="alert"` (`settings-panel.component.html:71, 97`). |
| 10 | Help & documentation | 3 | Every pref row has an italic one-line explanation. |
| | **Total** | **23/40** | Acceptable. |

## Cognitive load

Failures: **2 of 8, which is moderate**.
- **Visual hierarchy: fail.** Five gold section headings at equal weight. Nothing says which setting matters (role).
- **Grouping: fail.** Identity and account (name, email, password, sign-out) is split from top to bottom around preferences.

Decision points: none over 4 at once.

## Emotional journey

- **Peak:** the theme swatches. Clicking Candlelit and watching the whole app shift is the most delightful moment in the product.
- **Valleys:**
  - Typing a new display name, closing, and finding it unchanged.
  - Switching to Player and seeing nothing happen in the panel itself. The change is only visible after closing.
- **High-stakes reassurance:** none. Sign Out is a full-width crimson button in the thumb zone with no confirm. In demo mode it clears the demo, which the brief itself flags as shared-state destructive.

## What's working

1. **Theme swatches as previews** (`settings-panel.component.html:119-133`). Recognition over recall, and a direct expression of *The Three Themes Rule* as a product feature.
2. **Pref rows with italic sub-lines** ("ask adv/disadv before rolling"). Each one is self-documenting in the house voice.
3. **Dialog semantics.** `role="dialog"`, `aria-modal`, `cdkTrapFocus` with auto-capture, and Sign Out pinned in a footer outside the scroll region (*The Panel Owns Its Scroll Rule*).

## Priority issues

**[P1] Toggles and choice buttons have no accessible names or states**
- **What:**
  - The three `.toggle` buttons (`settings-panel.component.html:156, 164, 172`) are empty `<button>`s with `aria-pressed` and no name. A screen reader announces "toggle button, pressed" three times.
  - Theme swatches and the digital/manual `seg-mini` buttons expose no selected state (`aria-pressed` absent, verified).
  - Display Name / Email `<label>`s have no `for`/`id` (verified: `labels.length === 0`).
  - The role switch uses `tablist`/`tab` semantics for what is a two-way setting.
- **Why it matters:** Sam cannot tell which dice options are on, which theme is active, or what the fields are. The toggles were not covered in the a11y pass.
- **Fix:**
  - Add `[attr.aria-label]` to each toggle (or `aria-labelledby` pointing at its `.pref-label`).
  - Add `[attr.aria-pressed]` to swatches and seg-mini.
  - Add `id`/`for` pairs to the fields.
  - Change the role switch to `role="radiogroup"` with `role="radio"` + `aria-checked`.
- **Suggested command:** /impeccable harden

**[P1] Account fields are a false affordance**
- **What:** `<input [value]="user.name">` and `<input [value]="user.email">` (`:31-38`) are editable, but nothing persists them. In demo the email field renders empty.
- **Why it matters:** The user believes they renamed themselves. That is a silent failure (Nielsen #5) on the first section of the panel.
- **Fix:** Until profile editing exists, render them as read-only text (`.profile-name`-style rows, or `readonly` with `--text-dim` ink and a "Managed by your account" sub-line). Hide the email row when it is empty.
- **Suggested command:** /impeccable clarify

**[P2] Role switch is the most consequential control but reads as a preference, with no feedback**
- **What:** "View As" swaps the sidebar, main view and permissions model. It sits among cosmetic prefs and gives no confirmation. The active DM segment carries a celestial `box-shadow: var(--glow)` at rest (`styles.css:1515-1521`, measured `rgba(143,180,255,.25) 0 0 20px`). DESIGN.md says "a celestial glow at rest is always a bug".
- **Fix:**
  - Close the panel on role change, or show a toast ("Now viewing as Dungeon Master").
  - Remove the rest glows from `.role-seg.active` and `.role-seg.dm.active`, keeping the fill and border.
  - Raise `.role-seg` from 10px to 11px.
- **Suggested command:** /impeccable quieter

**[P2] Sub-floor text and gold saturation**
- **What:** `.theme-swatch-label` is 9px (`styles.css:1834`), `.seg-mini button` 9px (`:1882`), `.role-seg` 10px (`:1500`), all breaking *The 11px Floor Rule*. Every `.panel-title` is gold, and the slide-over itself carries `var(--glow-gold)` at rest (`:1757`), breaking *The Scarce Accent Rule* and *The Glow Is State Rule*.
- **Fix:** Raise these labels to 11px. Make section titles `--text-2` and keep gold only for the active swatch, active segment and on-toggles. Drop the panel's rest glow and keep the gold hairline.
- **Suggested command:** /impeccable typeset

## Persona red flags

- **Casey:** close ✕ is 28px at top-right, out of thumb reach, with no Escape and no swipe. Toggles are 24px tall and seg-mini buttons 26px. Sign Out is the biggest, most reachable target in the panel.
- **Sam:** see P1. Also `passwordError` is not announced.
- **DM mid-combat:** if they open settings to flip "Advantage prompt", the role switch sits first and largest. A mis-tap drops them into Player view mid-session.
- **Jordan:** "View As" does not explain that it changes what you can do, not just what you see.

## Minor observations

- The swatch preview colours are hard-coded hex in TS (`settings-panel.component.ts:55-58`), which is acceptable for previews. Vellum's swatch gold `#8a5e22` differs from the real vellum `--gold` `#714d1c`.
- `.theme-swatch:hover { transform: translateY(-1px) }` is the only lift in the system ("Cards do not float").
- "Default Theme" should read "Theme". "Password changed." should use `--emerald` or `--text` rather than `.pref-sub` dim italic.

## Questions to consider

1. Should the role switch live in the rail itself (where its effect is visible) rather than inside settings?
2. Do players need to see the role switch at all, or should DM appear only for accounts that own a campaign?
3. Would Sign Out be better as a quiet text link, given it is the least-used and most destructive action here?
