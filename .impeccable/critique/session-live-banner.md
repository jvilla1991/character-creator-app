Method: dual-agent (A: isolated design-review sub-agent · B: detector + measured browser evidence, gathered in the parent before A's output was read). B ran in the parent rather than its own sub-agent; isolation of A from B held.

# Critique — Session live banner

**Design Health Score: 27/40 — Acceptable (near Good).** Weakest: Consistency (2), Flexibility (2),
Error Recovery (2). Audit: 13/20.

## Design Specificity Verdict

**LLM assessment:** mostly authored, slightly off-system. Celestial-for-live is the correct
semantic; the copy ("take your place in the order", "Take the Field") is on voice. The container
drifts: 12px radius, literal tint, Newsreader title where call-to-action headings use Cinzel.

**Deterministic scan:** not run on the rendered banner — demo mode never shows it (the reviewer
forced it via the component's `live` signal; the detector was not injected into that state). Source
review: literal `rgba(120,170,255,0.08)`, dead fallback hexes, `border-radius: 12px`.

**Agreement:** radius, tint and the unbound picker label. **Reviewer-only:** one-hero players still
go through the picker; the banner re-invites an already-seated player. **Audit-only:** the banner's
appearance is not a live region, so session start is silent to assistive tech.

## Overall Impression

Small, correct in intent, and the gentlest surface in the review. Its job is one tap; it currently
takes three.

## Priority Issues

- **[P1] Session start is not announced** (no live region). → `/impeccable harden`
- **[P2] Skip the picker with exactly one eligible hero.** → `/impeccable distill`
- **[P2] Knows nothing of "already seated"** — re-invites after Close. → `/impeccable harden`
- **[P2] Off-system container** (radius, tint, title face). → `/impeccable colorize`, `/impeccable typeset`
- **[P3] Picker select unnamed; "no hero" empty state is a dead end.** → `/impeccable harden`,
  `/impeccable onboard`

**Questions skipped:** batch run across ten surfaces. The owner-direction questions this surface raises are consolidated in `docs/impeccable-adoption-plan.md` §10.

Technical detail, evidence and file locations: `.impeccable/surfaces/session-live-banner.md`.

---

## Appendix — Assessment A (design review, as written by the isolated reviewer)

### Assessment A — "Session is live — join" banner (`components/session-live-banner/`)

Looked at: the player role on `/charactermanager` in the browser pane at 375×812, in midnight (screenshot) and vellum/candlelit (computed styles). Demo mode disables discovery: `getActiveForCampaign` returns `null` and the 5s poll clears the banner. So I **forced it to render** by setting the component's `live` signal through `ng.getComponent` and opening the picker with `openPicker()`, which exercised the real template and styles. I saw the PC picker in both its populated state and its "None of your heroes" empty state. The join request, the error toast and the live poll behaviour I reviewed from source only (`session-live-banner.component.ts`). I did not see the banner at desktop width; its layout there is from source (a flex row above 560px).

## Design specificity verdict

**Mostly authored, slightly off-system.** The copy is right for this table: "A session is live", "take your place in the order", "Join the Session", "Choose which hero takes the field", "Take the Field". The celestial border fits DESIGN.md, which gives starlight to "live" state, so the hairline-plus-tint is the correct semantic.

The container drifts, though:
- a **12px radius** (`session-live-banner.component.scss:8`) in a near-sharp 2–3px system;
- a literal `rgba(120,170,255,0.08)` wash (`:10`) instead of `color-mix(var(--celestial) 8%, transparent)`;
- dead fallback hexes (`#6f8cff`, `#9db4ff`);
- a title set in **Newsreader 600** (`.session-banner-title`) where every other call-to-action heading in the app uses Cinzel.

It reads like a product notification bar dressed in the right colours. The picker modal reuses the system `.modal` correctly and looks fully native to The Astral Chart.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | It appears within one 5s poll and the button shows "Joining…". It does not say whether *you are already seated*, so after Close the banner invites you to join a session you are already in. |
| 2 | Match between system and real world | 3 | Good in-world copy. One action has three names: "Join Session" / "Join the Session" / "Take the Field". |
| 3 | User control and freedom | 3 | Cancel and backdrop dismiss work. There is no Escape (already listed under "Modals without Escape support" in a11y-notes). |
| 4 | Consistency and standards | 2 | 12px radius, Newsreader title, literal tint. The `<label>Character</label>` is not associated with its `<select>` (`.labels.length === 0`, no `aria-label`). |
| 5 | Error prevention | 3 | Take the Field is disabled with no eligible hero and the first eligible PC is preselected. Nothing stops a duplicate join from a player who is already seated. |
| 6 | Recognition rather than recall | 3 | Options show "Name — Race Class" and the campaign name is emphasised. |
| 7 | Flexibility and efficiency | 2 | A player with exactly one eligible hero still goes through a modal and a dropdown: two taps plus a decision with nothing to decide. |
| 8 | Aesthetic and minimalist design | 3 | Compact: one line of title, one subline, one button, and on mobile it stacks to a full-width button. It does compete with a second standing-glow primary ("Forge a Hero") on the same screen. |
| 9 | Error recovery | 2 | "Could not join the session. Try again." gives no cause, such as the session having ended or a seat being taken. |
| 10 | Help and documentation | 3 | The empty state explains the prerequisite ("Join the campaign first") but offers no link to do it. |
| | **Total** | **27/40** | Acceptable, near Good |

## Cognitive load

Failures: **1 of 8, which is low.**

- **Minimal choices / one thing at a time — borderline fail.** For the single-hero case, the picker inserts a decision with only one answer.
- Everything else passes. Single focus, chunking, grouping, hierarchy (title → sub → one button), working memory and progressive disclosure (the picker only on demand) are all fine.

No decision point exceeds 4 options. The dropdown lists only the player's own heroes in that campaign.

## Emotional journey

- **Peak:** the banner appearing on its own while the player is idle on their sheet. "A session is live" with the DM's campaign name is a nice "the table has started" moment. It is the bridge from preparation to play.
- **Valley:** "None of your heroes are seated at this campaign yet. Join the campaign first." This is a dead end in a modal with a disabled primary and no route to the join flow.
- **Reassurance at the high-stakes moment:** joining is low-stakes and reversible, so the light touch is right. The gap is the opposite case: no reassurance that you're *already in*, which matters after a player taps Close in session mode and the banner reappears with "take your place in the order".

## What's working

1. **The semantic colour is correct.** A celestial hairline marks a *live* state, exactly as DESIGN.md's Glow Is State and Starlight rules intend, and the picker modal echoes it (`border-color: var(--celestial)`, celestial-2 title).
2. **Mobile behaviour is considered.** Below 560px the text wraps and the button goes full width (`scss:40-48`). At 375px it is a comfortable 44px+ target at the top of the content column, the first thing a player sees.
3. **Discovery is cheap and polite.** The poll pauses while the tab is hidden (`filter(() => !document.hidden)`), errors per campaign are swallowed so one bad campaign does not hide another, and the picker closes itself if the session ends while it is open.

## Priority issues

### P2 — Off-system container: soft corners, literal tint, wrong title face
- **What:** `border-radius: 12px` (`session-live-banner.component.scss:8`), `background: rgba(120,170,255,0.08)` (`:10`), fallback hexes (`:7,14`), and a `.session-banner-title` that inherits Newsreader at weight 600 (`:24-27`).
- **Why:** the 12px radius goes against DESIGN.md's Shapes rule ("Nothing in the system is softly rounded") and the literal tint breaks The Three Themes Rule. The tint is low enough to survive all three themes today, but it will not follow a future celestial retune. The title face breaks the label hierarchy.
- **Fix:** use radius `var(--radius-panel)` (3px) and `background: color-mix(in oklch, var(--celestial) 8%, transparent)`, and drop the fallbacks. Set the title in Cinzel 500 at the Title step (16px, 0.05em), or as an `.eyebrow`-style "SESSION LIVE" over the campaign name in Cinzel.
- **Command:** /impeccable polish

### P2 — Skip the picker when there is only one eligible hero
- **What:** `openPicker()` always opens a modal, even when `eligiblePcs.length === 1` (`session-live-banner.component.ts:92-101`).
- **Why:** "time-to-answer beats completeness" (PRODUCT.md principle 1). At an in-person table, a player usually has one hero per campaign.
- **Fix:** with exactly one eligible PC, label the banner button "Join as Lyra" and call `join()` directly. Keep the picker for two or more.
- **Command:** /impeccable distill

### P2 — The banner doesn't know you're already seated
- **What:** the banner renders for any live session in any of the player's campaigns (`:59-83`), whether or not one of their PCs is already a participant. After **Close** in session mode, it returns with "take your place in the order".
- **Why:** it suggests the player has dropped out, and invites a duplicate join or a confusing error.
- **Fix:** if the session snapshot already contains a participant `ownedByMe`, switch to "You're in the session · **Return to the table**" and call `uiState.openSession` directly.
- **Command:** /impeccable clarify

### P3 — Picker field has no accessible name, and the empty state is a dead end
- **What:** `<label>Character</label>` has no `for` and the `<select>` has no `id` or `aria-label` (`session-live-banner.component.html:30-31`). The empty state ("Join the campaign first") offers no action.
- **Why:** Sam hears an unnamed combobox. Jordan is told what to do but not given a way to do it.
- **Fix:** add `id="session-pc"` / `for="session-pc"`. In the empty state, replace the disabled primary with a "Join a campaign" button that opens the existing join-campaign modal.
- **Command:** /impeccable harden

## Persona red flags

- **Player between turns:** fine. The banner is the first element and the button spans the width. The only friction is the extra picker step.
- **DM mid-combat:** n/a. The banner is player-only (`sidenav.component.html:181`) and is replaced by "Back to Session" when a DM cross-links.
- **Casey (distracted mobile):** good tap target. If Casey taps Close by accident, the banner offers "Join Session" instead of "Return", which is the wrong mental model.
- **Sam (accessibility):** the banner is not a live region, so a screen-reader user is not told a session has started. Consider `role="status"` on the banner container. The picker `<select>` is unnamed. There is no Escape close (known, in a11y-notes).
- **Jordan (first-timer):** "Join Session", "Join the Session" and "Take the Field" are three names for one act. The empty state names a prerequisite without linking to it.

## Minor observations

- Only the *first* campaign with a live session is shown (`results.find(r => r != null)`). That is fine for one group, but silently ignores a second live session.
- The decorative glyph is correctly `aria-hidden`.
- `margin-bottom: 20px` and `gap: 14px` are raw px. That is expected debt (the px→token migration is a later slice).
- The 5s poll means the banner can lag the DM's Start Session by up to 5s. Acceptable given PRODUCT.md's "within a couple of seconds" expectation, but it is the slowest live channel in the app.

## Questions to consider

1. Should a live session *take over* the player's screen (a full-width celestial state on the sheet, or a gentle vignette like the turn cue) rather than a dismissible-looking bar? Is "the table has started" the most important thing the player app can say?
2. If the player is already seated, is there any reason for this to be a "join" banner at all, rather than a persistent "Return to the table" affordance in the app bar?
