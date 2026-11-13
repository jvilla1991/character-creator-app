Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/session-mode.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/session-mode.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Live session mode (`components/session-mode/`)

Looked at: demo campaign "The Veiled Compass" → Start Session as DM, in the browser pane. States: lobby → load "Goblin Ambush (demo)" → Start Encounter → Next Turn ×2 (active + on-deck glows), and the DM-side forms for clock/location/shop/loot/encounter loader/session note. I could not reach a live shop or loot pool in demo: `loot.service.ts:27` and the shop equivalent return `demoUnsupported()`, so "Prepare Loot" fails with a "Could not prepare the loot." toast. I reviewed those states from source only. Demo always builds `dm: true` (`session.service.ts:1056`), so I rendered the **player face** and the **rest vote** (both faces) by pushing a modified in-memory snapshot into `SessionService.stateSubject` through `ng.getComponent`. That used the real templates and changed no source. Widths: 375×812 (binding), 800 and 1280. Themes: midnight, vellum and candlelit, with transitions frozen. Reduced-motion and keyboard behaviour were checked from source.

## Design specificity verdict

**Authored for this product at the centre, generic at the edges.** The initiative board, the whole-viewport turn vignette (`session-mode.component.scss:13`), the green "up" / gold "on deck" row glows, the "Summoning the initiative order…" empty state and the rest-vote modal belong to a table game and nothing else. The header (`eyebrow` + Cinzel `sheet-name` + italic subtitle) and the panel chrome are true Astral Chart.

Everything below the roll log was built in a different dialect. That covers the encounter loader, shop panel, loot panel, the `btn-mini` controls in the initiative panel, and the session-note textarea. They use 12px-radius cards (`shop-panel.component.scss:8`, `loot-panel…:8`, `encounter-loader…:5`) and 6–8px inner radii. Their fallback tokens do not exist in the system (`--bg-elev`, `--muted`, both resolving to literal `rgba(255,255,255,…)`). Segment controls are filled solid starlight. `btn-mini` falls back to **Arial** (the computed font of `.encounter-bar .btn-mini`, `.cue-mute .btn-mini`, `.xp-all-bar .btn-mini` and `.dm-adjust .btn-mini`). At 375px you can see the seam: the top half reads as a star chart, the bottom half as a generic admin form. Coherence with The Astral Chart is **partial**. The identity is right, but enforcement stops at the panel boundary of the newer components.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Turn state is excellent: row glow, device vignette and Round in the eyebrow. But "whose turn" is never in the header, and HP, initiative and advance failures only `console.error` (`initiative-panel.component.ts:215,225`, `session-mode.component.ts:558`). |
| 2 | Match between system and real world | 3 | Strong in-world voice ("on deck", "take your place in the order", "Keep going (no)"). The whole screen is titled "Initiative" even in the lobby, and "steady" means "no conditions". |
| 3 | User control and freedom | 2 | **End Session** has no confirmation (`session-mode.component.ts:575`) and sits beside Close. A player's **Leave** has none either (`:605`). Yet the less destructive End Encounter does confirm (`:540`). |
| 4 | Consistency and standards | 1 | Two visual dialects (see verdict): Arial `btn-mini`, 6–12px radii, celestial-filled segments. Close vs Leave look identical but do very different things. |
| 5 | Error prevention | 2 | PC removal and End Encounter confirm. Loaded enemies arrive at initiative 0. The DM's damage "−" and heal "+" are adjacent 26px squares on a scrolling row. |
| 6 | Recognition rather than recall | 2 | At 375px the DM must remember that AC, Conditions and Adjust exist off to the right. "Green is up, gold is on deck" is a colour legend to memorise. The roll log shows totals with no roll purpose. |
| 7 | Flexibility and efficiency | 2 | Ctrl+Enter for notes, pinned spell cards and a per-device cue mute are good. There is no shortcut or sticky control for Next Turn, the DM's most repeated action. |
| 8 | Aesthetic and minimalist design | 2 | Preparation and play share one scroll. Shop, loot and encounter-loader forms sit permanently under the live board, and an empty "Spells (0)" carousel takes the DM's first fold. |
| 9 | Error recovery | 1 | Toasts are generic ("Could not prepare the loot.", "Could not open the shop.") with no cause and no next step. Several failures are silent. |
| 10 | Help and documentation | 2 | `title` tooltips carry real guidance (rest rules, Set date semantics), but they are invisible on touch, the primary device. |
| | **Total** | **20/40** | Acceptable, at the bottom of the band |

## Cognitive load

Failures: **5 of 8, which is high.**

- **Single focus — fail.** The DM's live job (run turns, apply damage) shares one column with three preparation forms and a note composer.
- **Chunking — fail.** Each initiative row carries up to 7 interactive targets for the DM: the init input, an HP input, −, +, an XP input, +XP, 5 inspiration pips and ✕.
- **Visual hierarchy — fail at 375px.** The first fold is the empty spell carousel, the title, End Session/Close and the Clock. The initiative board and Next Turn are below it.
- **Minimal choices — fail.** See the decision points below.
- **Progressive disclosure — fail.** Shop, loot and encounter forms are always expanded. Only the roll log and the spell carousel collapse.
- Grouping, one-thing-at-a-time (the rest vote is exemplary) and working memory pass, apart from the off-screen-column recall noted above.

Decision points with more than 4 visible options:

- DM clock panel: Start the Clock, Set date, Long Rest, Short Rest, plus Set location next door.
- Player header: End Turn, Short Rest, Leave, Close. That is exactly 4, but at 375px they render as four equal-weight tiles.
- Shop "What does it sell?": 5 segments (Weapons, Armor, Components, Gear, Transport). These overflow at 375px; "Gear" is clipped and "Transport" is off-canvas.
- DM row Adjust cell: 9+ targets.
- Encounter bar: Enemy name, AC, HP, Add Enemy, Players-see select, Turn-cue select, Mute.

## Emotional journey

- **Peak:** your own turn. The whole phone edge pulses green, your row glows and **End Turn** appears as the primary action. This is the best moment in the product and fully on-brand.
- **Second peak:** the rest vote. It is a blocking modal with a big Cinzel countdown, ✓/?/✕ ballots, "you" marked and two clear answers. Calm, legible, and it holds in vellum.
- **Valley 1 (DM, 375px):** finding the HP controls. You must side-scroll the board (scrollWidth 762 in a 293px viewport) to reach Adjust, and the scrollbar track renders bright white on midnight.
- **Valley 2 (vellum):** the active combatant's name turns invisible at the exact moment it matters (see P0).
- **Valley 3 (DM, high stakes):** **End Session** is one un-confirmed tap from **Close**. If it fails, the error handler simply closes the screen (`session-mode.component.ts:578`). There is no reassurance at the session's most irreversible moment, while the routine End Encounter gets a `window.confirm`.

## What's working

1. **The turn signal system.** It uses three redundant channels (device vignette, row ring and wash, tinted name and init number) driven by per-viewer ids, so a hidden enemy's turn never lights a player's screen (`session-mode.component.html:4-12`, `initiative-panel.component.scss:1-34`). It answers "is it me?" in one glance and is the session's signature.
2. **The rest-vote modal** (`rest-vote-modal.component.html`). It is deliberately blocking for players and non-blocking with override for the DM, with ballots that use glyph *and* colour. It is token-clean and held up in all three themes. It is the model the rest of session mode should be judged against.
3. **Visibility rules expressed in the UI.** "Players see: No enemies / health hidden / Enemies & health" is one plain-language select. Withheld HP shows an em dash with "The DM keeps this creature's health hidden". PRODUCT.md's hard rule is legible to the DM rather than buried.

## Priority issues

### P0 — Active and on-deck combatant names are invisible in vellum
- **What:** `.current-turn .board-hero-name` and `.board-num.lit` are hard-coded `#7fe0ae`, and on-deck is `#f0d391` (`initiative-panel.component.scss:17,32`). Measured against vellum's parchment, that is **1.24:1** for the active name and **1.13:1** for on-deck. Midnight and candlelit pass (>11:1). The glows, washes and the whole-device vignette are literal `rgba(76,175,125,…)` / `rgba(217,178,95,…)` too (`session-mode.component.scss:28-46`). They bypass `--emerald` / `--gold`, so they cannot adapt per theme.
- **Why:** the one fact the table needs ("whose turn is it?") disappears in a first-class theme. This breaks The Three Themes Rule and The AA Floor Rule, and The Glow Is State Rule's colour roles (DESIGN.md gives "live" to celestial, but the turn uses an off-system green).
- **Fix:** drive the name and init tint from `var(--emerald)` / `var(--gold)`, or keep text at `--text` and let the ring carry the state. Build the ring and wash with `color-mix(in oklch, var(--emerald) N%, transparent)`. Add the turn-name pairs to `npm run check:contrast`.
- **Command:** /impeccable colorize

### P1 — The initiative board does not fit a phone, for the DM or the player
- **What:** the global `.board-row { min-width: 720px }` (`styles.css:1624`) plus the panel's own columns (`initiative-panel.component.ts:207`, with a 184px Adjust column for the DM) force horizontal scrolling. At 375px only Init, Combatant and a sliver of HP are visible. AC, Conditions and Adjust are off-canvas, and names truncate ("Lyra Moonw…"). The player's own HP number is clipped at the right edge. Separately, `main` itself scrolls sideways (499/367) because `.enemy-form` does not wrap (`initiative-panel.component.scss:176`), and the shop category segments overflow.
- **Why:** this is a direct violation of The Phone Is The Table Rule ("cramped and clipped are not" acceptable) and The Panel Owns Its Scroll Rule (the page-level column scrolls horizontally). "Player between turns" cannot get their one number. "DM mid-combat" has to side-scroll to deal damage.
- **Fix:** below 640px, render each combatant as a two-line card. Line 1: init, name, HP x/y with bar, AC. Line 2: condition chips. For the DM, collapse Adjust into a single "HP ±" input that expands on tap. Drop `min-width: 720px` on the session board, wrap `.enemy-form`, and let `.seg` wrap.
- **Command:** /impeccable adapt

### P1 — Shop, loot and encounter forms are unreadable in vellum and off-system everywhere
- **What:** `.field-label`, `.seg-btn`, `.muted` and the meta text use `var(--muted, rgba(255,255,255,0.6))`, but `--muted` is not defined, so they render as 60% white. On parchment, "Shop source", "What does it sell?", "Who's at the shop?", "Loot source" and the inactive segment labels vanish (verified on screen). The active segment is `--text` on a solid `--celestial` fill, which measures **1.62:1 in midnight, 1.84:1 in vellum and 1.60:1 in candlelit** (`shop-panel.component.scss:49-52`, mirrored in `loot-panel.component.scss`). Cards use `--bg-elev` (also undefined, so a grey-white wash) and 12px radii.
- **Why:** this breaks The Three Themes Rule ("the token is the only interface"), The AA Floor Rule and the near-sharp corner language. A DM opening a shop mid-session in vellum cannot read the form.
- **Fix:** replace `--muted` with `--text-dim` and `--bg-elev` with `--surface-2`. Use radius 2–3px. Restyle the selected segment the way DESIGN.md's chips specify ("selected chips raise the fill, not the border"): `color-mix(--celestial 18%, --bg-2)` with `--celestial-2` text. Set `font-family: inherit` / Cinzel on `btn-mini` so Arial disappears.
- **Command:** /impeccable polish

### P1 — Preparation lives inside play, and the live controls are below the fold on a phone
- **What:** the DM's live screen stacks spell carousel → header → clock/location → turn controls → board → encounter bar → XP-to-all → roll log → encounter loader → shop form → loot form → session note (`session-mode.component.html:14-294`). At 375px the first fold is an *empty* "Spells (0)" carousel and the clock. Next Turn sits under the board header and scrolls away as the board grows. "Whose turn is it?" is not stated anywhere in the header.
- **Why:** this contradicts PRODUCT.md principle 3 ("do not force one layout to serve both") and principle 1 ("time-to-answer beats completeness"). It fails the "DM mid-combat" persona, who needs Next Turn and the active row within reach at all times.
- **Fix:** put the active combatant's name ("Goblin 1 · on deck: Goblin 2") in the header subtitle. Pin a compact turn bar (Next Turn, Round, active name) to the bottom of the panel on mobile. Collapse Shop, Loot and Encounter loader into a "Table tools" disclosure (or tabs) that is closed by default during ACTIVE status. Hide the spell carousel when it has 0 pins, keeping a small "Pin spell" affordance instead.
- **Command:** /impeccable layout

### P2 — Irreversible session actions are unguarded, and failures are silent
- **What:** End Session (DM) and Leave (player) fire immediately and close the screen even on error (`session-mode.component.ts:575-580, 605-616`). HP, initiative and advance errors only `console.error`. Loot and shop errors are generic toasts.
- **Why:** ending a session by mistake ends it for the whole table. A failed damage application that looks applied desyncs the table's HP.
- **Fix:** confirm End Session and Leave with consequence copy ("Ends the session for every player — initiative and the roll log are cleared"). Separate the danger button from Close (move it to the far end, or behind an overflow). Route every session error through `notifications.notify` with the action named ("Damage to Goblin 1 didn't apply — try again").
- **Command:** /impeccable harden

## Persona red flags

- **Player between turns:** at 375px their own HP (`.board-hp`) is clipped at the right edge of the board, and the Roll button sits *below* the board and the cue-mute row. The bottom tab bar from the embedded character sheet (Sheet / Spells / Inventory / Notes / Log) floats over the session column, which makes for two competing navigation models. The Campaign Clock panel shows "Clock not set" as an empty full-width panel when the DM hasn't started it.
- **DM mid-combat:** must side-scroll each row to reach `.dm-adjust`. The damage "−" and heal "+" are 26px buttons 4px apart (`initiative-panel.component.scss:138-154`), below the 44px target the global mobile block gives `.btn`. There is no sticky Next Turn. End Session is right beside Close with no confirm.
- **Casey (distracted mobile):** horizontal page scroll in `main`. The category segments clip. Pip targets are 9px dots padded to about 17px (`:84-104`). Tooltips carry the only explanation of the Short Rest disabled state ("No resting mid-encounter") and never show on touch.
- **Sam (accessibility):**
  - The green vignette pulses infinitely (`session-mode.component.scss:23`), and there is **no `prefers-reduced-motion` rule** in session mode or `styles.css`, despite DESIGN.md claiming it is honoured. Worse, the my-turn glow exists *only* inside the keyframes, so a blanket reduced-motion `animation: none` would delete the turn signal entirely. Give `.my-turn` a static box-shadow too.
  - The player countdown has `aria-live="polite"` on a value that changes every second (`rest-vote-modal.component.html:38`), which makes a screen reader announce constantly.
  - Turn state is not announced; there is no live region for "It's your turn".
  - The hero cell is click-only (already in a11y-notes "Found but deferred").
  - `.board-cond` chips are **8px** and the board headers **9px** (`styles.css:1631,1685`), which violates The 11px Floor Rule. The same applies to `.eyebrow` at 10px, `.roll-time` at 10px (`roll-log-panel.component.scss:79`) and the spell-card `dt` and `.tag` at 0.62rem ≈ 9.9px.
- **Jordan (first-timer):** Close vs Leave vs End Session is never explained on-surface. "steady" as the no-condition chip reads as a status. The DM screen has no hint of what order to do things in (load encounter, then set initiative, then Start).

## Minor observations

- Goblins loaded from an encounter show initiative `0` in an input rather than a prompt to roll. The board header still says "enter initiative" only in LOBBY.
- The roll log's total uses Cinzel 700 (`roll-log-panel.component.scss:62`). DESIGN.md assigns dice results to JetBrains Mono. Rows show "1d20 → 14" with no purpose (attack? Perception?), so the DM sees a number without meaning.
- The `.mine` roll row is distinguished by a gold border alone (colour-only signal).
- Spell carousel cards use `box-shadow: var(--shadow)` at rest and a 10px radius (`spell-carousel.component.scss:62-64`), which goes against "Cards do not float" and the Hairline Rule.
- Native checkboxes (shop roster) and the native horizontal scrollbar render in default light chrome on midnight and candlelit.
- `.session-note textarea` focuses to `--celestial` with radius 6px. Inputs elsewhere focus gold per DESIGN.md.
- Too many standing primaries at once for the DM: Start the Clock, Start Encounter/Next Turn, Load, Open Shop, Prepare Loot and Add Note all carry the gold glow. That strains The One Standing Glow and The Scarce Accent Rule.
- The `.board-hp` percentage duplicates the x/y figure and the bar, and takes horizontal space a phone does not have.
- On mobile, the top app bar sits above the rest-vote backdrop, so the hamburger stays tappable during a "blocking" vote.

## Questions to consider

1. If the session is the product's centre of gravity, why is the DM's live screen a scroll of eleven panels rather than one board with a turn bar and a drawer of tools? What would a session screen with *only* initiative, HP and Next Turn on screen feel like at the table?
2. Should the player's session view lead with *their* character (HP, AC, slots and a big Roll) and treat the initiative order as a one-line "Up: Throk · Next: you" strip, given they only need one number between turns?
3. Green means "your turn" here, gold means "on deck", and DESIGN.md says celestial is "live". Is the turn signal a new semantic colour that deserves a named token and rule, or should it be folded into the existing celestial/gold vocabulary?
