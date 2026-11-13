Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/toasts-empty-states.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/toasts-empty-states.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Toasts and empty states

Looked at, in a browser tab:
- the "No Hero Selected" empty state at 375×812 (player, no hero),
- the filtered-roster empty state ("No heroes match that name.") at 375px,
- the curated-card empty states in midnight and vellum at 1024px,
- the toast, live at 375px. I raised a long message through the app's own `NotificationService` via Angular dev tools in my tab only.

From source:
- `toast/`, `notification.service.ts`, `character-sheet/empty-state/`;
- the dashboard's "No Campaign Chosen", party board, treasury, notes, Manage Party and curated empties;
- `campaign-sidebar` (which has no empty state);
- all ~30 `notify()` call sites.

## Design specificity verdict

**Empty states: authored. Toast: generic.**
- The full-page empty states ("No Hero Selected", "No Campaign Chosen") carry a large concentric-circle star sigil in gold at 50%, a tracked Cinzel title and a Newsreader-italic invitation ("inscribe a new soul to begin"). That is The Astral Chart at its most characteristic.
- The inline empties are mostly in voice: "Empty coffers.", "Capture the first ruling or revelation.", "fill it with spoils, then drop it from Session Mode".
- The toast is a 10px-rounded pill-ish box with a generic info glyph for every message. It could belong to any app, and its radius contradicts the near-sharp corner language.

## Heuristic scores

Heuristic 7 is scored `n/a`: toasts and empty states are passive feedback surfaces, so accelerators do not apply. Total is out of 36.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | One toast at a time, and a new one silently replaces the old (`notification.service.ts:17-21`), so "Claimed Longsword" can be overwritten by the next event. |
| 2 | Match with real world | 3 | Empty-state copy is excellent and in voice. |
| 3 | User control & freedom | 2 | Toast dismisses on click only; there is no keyboard dismiss (already in a11y-notes "Found but deferred": **Toast keyboard dismissal**). |
| 4 | Consistency & standards | 2 | Toast radius 10px. Inline empties are a mix of inline-styled italic divs, `.muted` and `.note-empty`. Curated empties use undefined tokens. |
| 5 | Error prevention | 2 | A misdiagnosing empty state ("No heroes match that name." with no query) steers users wrong. |
| 6 | Recognition over recall | 2 | "Choose a name from the chronicle" refers to a drawer that is hidden on phones, with no link to it. |
| 7 | Flexibility & efficiency | n/a | Passive feedback; no accelerators apply. |
| 8 | Aesthetic & minimalist | 3 | The sigil empty states are beautiful and calm. |
| 9 | Error recognition & recovery | 2 | Error toasts are well-phrased ("Could not drop the loot.") but look identical to success toasts and offer no retry. |
| 10 | Help & documentation | 3 | Curated empties teach the next step ("Create one, then import a category to stock it."). |
| | **Total** | **21/36 (58%)** | Acceptable. |

## Cognitive load

Failures: **1 of 8, which is low**.
- **Working memory: fail on mobile.** The hero empty state asks the user to recall that the chronicle lives behind the hamburger.

No decision point exceeds 4 options. The empty states correctly offer one CTA.

## Emotional journey

- **Peak:** "No Hero Selected" with the gold sigil. It makes an empty screen feel like an invitation.
- **Valleys:**
  - A player who *has* three heroes opens the app on a phone and is offered only "Forge a Hero", a creation CTA, while their existing heroes are hidden.
  - A long error toast renders as a 187px-wide, 124px-tall column.
  - In vellum, curated empty-state instructions are invisible.
- **High-stakes reassurance:** a failed loot claim or rest vote comes back as a toast styled identically to "Claimed …". The table cannot tell good news from bad at a glance.

## What's working

1. **Full-page empty states** (`empty-state.component.html`, `campaign-dashboard.component.html:193-210`). One sigil, one title, one sentence, one CTA. This is textbook, and branded.
2. **The live region is done right.** `role="status"` + `aria-live="polite"` sit on the always-rendered host (`toast.component.ts`), so messages are announced.
3. **Instructional inline empties.** The curated and notes empties name the next action in the product's voice rather than saying "No data".

## Priority issues

**[P1] Toast collapses to half the screen width on phones**
- **What:** `.toast { position: fixed; left: 50%; transform: translateX(-50%); max-width: min(90vw,440px) }` (`toast.component.scss:4-11`). A fixed box anchored at `left: 50%` shrink-wraps into the *remaining* 50% of the viewport. Measured at 375px: a long message renders 187.5px wide and 123.5px tall, a five-line column sitting over the thumb zone.
- **Why it matters:** Toasts carry session events ("The DM ended the session.", XP awards, loot claims). That is *The Phone Is The Table Rule* on the surface a player glances at between turns.
- **Fix:** Use `left: 16px; right: 16px; margin-inline: auto; width: fit-content; max-width: 440px; transform: none` (and adjust the keyframe), or `inset-inline: 0; margin: 0 auto`. Set radius to `var(--radius-panel)`.
- **Suggested command:** /impeccable adapt

**[P2] No severity, so error and success toasts are indistinguishable, and newer toasts erase older ones**
- **What:** One info glyph and one celestial border for everything (`toast.component.html:3-5`). `notify(message)` takes no kind. A single slot with a fixed 4s timer regardless of length (`notification.service.ts:17`).
- **Why it matters:** "Claim failed." and "Claimed Longsword." look the same. A 20-word error disappears in 4s.
- **Fix:** Add `kind: 'info' | 'success' | 'error'` and map it to the existing semantic tokens: `--emerald` and `--crimson` hairline and glyph, same surface, so no palette change. Scale the duration with length (about 60ms/char, min 4s). Errors stay until dismissed. Keep at most 2 visible, stacked. Add the labelled dismiss button already listed in the a11y backlog.
- **Suggested command:** /impeccable clarify

**[P2] Empty states that misdiagnose or vanish**
- **What:**
  - (a) `sidenav.component.html:43-47`: "No heroes match that name." shows for an empty roster with no query.
  - (b) `campaign-sidebar.component.html`: no empty state for a DM with zero campaigns.
  - (c) The curated empties use `var(--muted, rgba(255,255,255,.6))` (`curated-shops.component.scss:139` and twins). Measured in vellum, they render white-on-parchment and are invisible, breaking *The Three Themes Rule*.
  - (d) Party board's "No heroes assigned to this campaign yet." offers no next step, though the invite code and Manage Party sit right above it.
- **Fix:**
  - (a) Split query-empty from roster-empty.
  - (b) Add "No campaigns yet — begin one below."
  - (c) Change `--muted` to `--text-dim`.
  - (d) Add "Share invite code **VEIL23** or use Manage Party to seat a hero."
- **Suggested command:** /impeccable onboard

**[P2] "No Hero Selected" on mobile offers creation, not selection**
- **What:** At 375px the empty state says "Choose a name from the chronicle", but the chronicle is in the closed drawer, and the only button is "Forge a Hero".
- **Fix:** Below 820px, add a secondary "Open the chronicle" button that calls `toggleDrawer()`. If the roster is non-empty, make *that* the primary and Forge the secondary. Better still, list the hero portraits inline (up to 3) as one-tap choices.
- **Suggested command:** /impeccable adapt

## Persona red flags

- **Player between turns:** a loot-claim result toast is half-width, multi-line and colourless. A failed claim looks like a success.
- **DM mid-combat:** XP-award and encounter-loaded toasts replace each other. If two fire in quick succession, the DM sees only the last.
- **Casey:** opens the app on a phone with heroes already made and is pushed toward "Forge a Hero".
- **Sam:** the toast is announced, but cannot be dismissed by keyboard (backlog). The full-page empty sigil is an SVG with no `aria-hidden`, so some readers may announce it as an unlabeled image.
- **Jordan:** empty roster tells them their (non-existent) search failed.

## Minor observations

- `.empty-sigil` carries `drop-shadow(var(--glow-gold))` at rest (`styles.css:1326-1331`), a standing decorative glow against *The Glow Is State Rule*. The sigil at 50% opacity reads fine without it.
- The toast keeps hex fallbacks (`var(--surface-2, #1c1f2b)` etc., `toast.component.scss:13-24`). They are harmless while the tokens exist, but they are literal colours in a component.
- The toast's `title="Dismiss"` tooltip is invisible on touch, and nothing visible signals that a tap dismisses it.
- The empty party board, empty treasury and empty Manage Party list each re-implement the same inline `style="color: var(--text-dim); font-style: italic; font-size: 13px"`. A shared `.empty-inline` class would make them consistent.

## Questions to consider

1. Should session-critical events (session ended, loot dropped, your turn) use a toast at all, or a persistent strip in the session banner that a glance can always find?
2. Could the full-page empty states use the space to show *state*, such as "The Veiled Compass is live — rejoin", instead of a generic invitation?
3. If the sigil empty state is the brand's best moment, should the inline empties (board, treasury, curated) get a 24px version of it rather than a grey italic line?
