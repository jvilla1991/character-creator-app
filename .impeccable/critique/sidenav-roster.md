Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/sidenav-roster.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/sidenav-roster.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Sidenav / roster rail and mobile drawer

Looked at: the `/charactermanager` shell in a browser tab at 1024px (rail) and 375×812 (drawer), in both roles. DM shows the campaign list; Player shows the hero roster with search. Midnight in both, plus vellum and candlelit on the rail. Source: `sidenav.component.html/.scss/.ts`, `campaign-sidebar.component.html/.ts`, `main-content.component.html/.scss`, and the matching `styles.css` blocks.

## Design specificity verdict

**Authored.** The rail is the clearest piece of The Astral Chart outside the sheet:
- a sigil brand mark with "a chronicle of heroes & hauntings",
- a faint sigil tile behind the content at `--sigil-opacity`,
- Cinzel names over Newsreader-italic sub-lines,
- a 2px gold left marker on the active hero (celestial on the active campaign),
- a banner-crest glyph for campaigns,
- a mono `L7` level tag.

Nothing here would sit unchanged in another product. The weak point is the mobile drawer. It is a competent generic off-canvas pattern that does not carry the context the rail carries (see the stale title below).

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | The active row is marked well (marker + `aria-current`). The mobile top-bar title is stale: it showed "Lyra Moonwhisper" while I was on the DM campaign dashboard. |
| 2 | Match with real world | 3 | In-world voice throughout. "1 heroes" pluralisation on the campaign row. |
| 3 | User control & freedom | 2 | The drawer has no close button and does not close on Escape. The scrim is a 52px strip at 375px. |
| 4 | Consistency & standards | 3 | Roster and campaign rows share one pattern. The hamburger is labelled "Open party menu" even in DM mode, where it opens campaigns. |
| 5 | Error prevention | 3 | Nothing destructive lives here. |
| 6 | Recognition over recall | 3 | Race / class / level on hero rows, hero count and level band on campaign rows. No live-session indicator on a campaign row. |
| 7 | Flexibility & efficiency | 2 | Search exists for heroes only. The search placeholder promises "players", but the roster holds only your own heroes. |
| 8 | Aesthetic & minimalist | 3 | Calm and restrained. A footer with two full-width buttons plus the account row is heavy on a phone. |
| 9 | Error recognition & recovery | 2 | An empty roster shows "No heroes match that name." even with no search typed. The DM campaign list has no empty state at all. |
| 10 | Help & documentation | 2 | Nothing explains "Join Campaign" or what the invite code is for. |
| | **Total** | **25/40** | Acceptable. |

## Cognitive load

Failures: **1 of 8, which is low**.
- **Working memory: fail on mobile.** Once the drawer closes, the top bar is the only context. It shows the active *hero* name, or "Table Mimic", never the active campaign in DM mode. So the user has to remember which campaign they opened.
- No decision point exceeds 4 options. The player footer has Forge / Join / Account; DM has New Campaign / Account.

## Emotional journey

- **Peak:** the brand block plus the roster on desktop. It reads as a cartographer's index of heroes.
- **Valleys:**
  - On a phone the drawer opens with no visible way out besides a thin dark strip. Tapping the hamburger again is impossible because the drawer covers it.
  - A first-time player with zero heroes is told "No heroes match that name", which sounds like they did something wrong.
- **Reassurance:** selecting a hero auto-closes the drawer and lands on the sheet, a good one-tap handoff. Nothing here is high-stakes.

## What's working

1. **The active-row treatment.** A celestial 14% fill, a 35% hairline and a 2px gold marker, plus `aria-current`, is state through tone and hairline exactly as *The Hairline Rule* intends.
2. **Drawer mechanics.** The drawer uses `100dvh`, `min(86vw, 340px)`, a 44px hamburger, 48px rows below 820px, and closes on hero, campaign or footer actions (`sidenav.component.ts:76-105`). Those are the right mobile bones.
3. **Role-adaptive footer.** "Forge Hero / Join Campaign" for players versus "New Campaign" for DMs keeps each role's primary action in the thumb zone.

## Priority issues

**[P1] Mobile top bar shows stale or wrong context**
- **What:** `sidenav.component.html:156` renders `activePc?.name || 'Table Mimic'` regardless of role. After visiting a hero as player and switching to DM, the bar read "Lyra Moonwhisper" above the Veiled Compass dashboard. As DM it otherwise never shows the campaign.
- **Why it matters:** On a phone the drawer is closed nearly all the time, and this title is the only "where am I" signal. *The Phone Is The Table Rule* and Nielsen #1.
- **Fix:** Bind the title per role. DM shows the active campaign name; Player shows the active hero; fall back to "Table Mimic". Optionally add a 11px `--text-dim` eyebrow ("Campaign" / "Hero") above it.
- **Suggested command:** /impeccable clarify

**[P1] Drawer has no explicit close, no Escape, no focus handling, and stays in the tab order when closed**
- **What:**
  - The open drawer has no ✕.
  - Escape does nothing (verified).
  - The hamburger has no `aria-expanded`, and its label never changes.
  - Focus stays on the hamburger behind the scrim.
  - When closed, the drawer is only `translateX(-100%)` (`sidenav.component.scss:29`): `visibility: visible`, not `inert`, and 7 focusable controls remain tabbable off-screen.

  The scrim and focus-trap parts are already in a11y-notes "Found but deferred" (**Sidenav drawer scrim**). The Escape gap, the missing close button and the off-screen tab stops are additional.
- **Why it matters:** Casey (one-thumb) has a 52px strip to dismiss. Sam tabs into invisible controls.
- **Fix:**
  - Add a 44px ✕ in the brand row, shown only below 820px.
  - Add `(keydown.escape)` to close.
  - Set `[attr.aria-expanded]="drawerOpen"` and `aria-controls` on the hamburger.
  - Add `[inert]="isMobile && !drawerOpen"` (or `visibility: hidden` after the transition) on the closed drawer.
  - Apply `cdkTrapFocus` when open, and return focus to the hamburger on close.
- **Suggested command:** /impeccable harden

**[P2] Empty roster and empty campaign list say the wrong thing (or nothing)**
- **What:** `sidenav.component.html:43-47` shows "No heroes match that name." whenever `filteredPcs.length === 0`, including when the roster is truly empty and the query is blank. `campaign-sidebar.component.html:10` has no empty branch, so a new DM sees "YOUR CAMPAIGNS 00" over a blank rail.
- **Why it matters:** These are first-run moments. Jordan is misdiagnosed and then left without a next step.
- **Fix:** Split the condition. With a non-empty query, keep "No heroes match that name." With an empty roster, show "Your chronicle is empty. Forge a hero, or join a campaign with your DM's invite code." For an empty campaign list, show "No campaigns yet — begin one below." pointing at New Campaign.
- **Suggested command:** /impeccable onboard

**[P2] Rail micro-labels below The 11px Floor Rule**
- **What:** These are all 10px: `.party-name` ("YOUR CAMPAIGNS", `styles.css:297`), `.party-count` (`:306`), `.roster-level` (`:397`), `.account-email` (`:1548`) and `.campaign-next` (`:1608`).
- **Why it matters:** The roster level tag and section header are functional text read at arm's length on a phone.
- **Fix:** Raise to 11px and keep the tracking ladder (`--track-micro` on the uppercase header). That is a token-level change only.
- **Suggested command:** /impeccable typeset

## Persona red flags

- **Player between turns:** opening another hero, or checking which campaign is live, takes hamburger → scan → tap. Roster rows carry no live-session or HP glance, so there is no "one number" here.
- **DM mid-combat:** the campaign rows do not show which campaign has a live session (the `campaign-next` style exists but is not rendered in `campaign-sidebar.component.html`). The top bar does not name the campaign.
- **Casey:** dismissal is via a 52px scrim strip only. The settings entry is the account row at the very bottom, which is fine for thumbs but undiscoverable (gear glyph at 15px).
- **Sam:** off-screen tab stops; the drawer state is not exposed. Rows are `role="button"` with `aria-current`, which is good.

## Minor observations

- "1 heroes · Lv 5" (`campaign-sidebar.component.ts:91` passes the raw count; the template pluralises unconditionally).
- The hamburger `aria-label="Open party menu"` is used in both roles. "Open navigation" or a role-aware label would fit better.
- `.brand-mark` carries `drop-shadow(var(--glow-gold))` at rest (`styles.css:233` and `sidenav.component.scss:91`). That is a decorative standing glow against *The Glow Is State Rule*.
- The drawer's open shadow is a literal `rgba(0,0,0,0.6)` (`sidenav.component.scss:35`), as is the scrim's `rgba(0,0,0,0.55)`. In vellum a black shadow reads muddy, and `--shadow` exists for this.
- `main-content.component.scss` is almost entirely dead Material-era wizard CSS with literal hex (`#666`, `#1976d2`, `#f5f5f5`). Delete it so it cannot leak.

## Questions to consider

1. On a phone, should the top bar carry a one-tap hero/campaign switcher (title as a button) so the drawer is needed only for create and settings?
2. Would a tiny live-session dot on a campaign row (celestial, the one place a celestial state signal belongs) save the DM a trip into the dashboard?
3. Is "Search heroes, players, classes" a remnant of a multi-player roster? If players only ever see their own one to three heroes, does the search box earn its 60px on a phone?
