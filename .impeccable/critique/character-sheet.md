Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/character-sheet.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/character-sheet.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Character sheet

Looked at: `/charactermanager` in demo mode, live in the browser pane. Covered Lyra Moonwhisper (bard, spellcaster) and Throk Ironjaw in the **DM cross-link view** (Back to campaign, editable numbers, Grant Level-Up, DM edit modal opened on current HP) and Lyra in the **player's own-sheet view** (`tm_role=player`, then put back to `dm`). Tabs checked: Sheet, Spells, Inventory, Notes and Log. Widths: 375×812 and desktop (1024). Themes: midnight (all tabs), vellum (Spells, Inventory, Sheet → coin purse, background), candlelit (Sheet header and vitals). **Source only:** the survival and supplies panels, because neither demo campaign has the survivalConditions variant. Slot-inventory mode, also no demo campaign. Spell description text, because the demo spells have no descriptions.

---

## Design specificity verdict

**Authored, not interchangeable — but the authorship thins out toward the edges.** The parts you see first are clearly The Astral Chart:
- the Cinzel header with its gold ✦ separators
- the hairline vitals strip with its crimson→gold HP bar (the system's signature component, done right)
- the ability tiles where the modifier is large and the score is small mono underneath
- the drop-capped Newsreader bio
- in-world empty states ("Lyra wields no magic — only steel and conviction", "No items yet — buy equipment at a shop during a session…")

An unrelated product could not lift this unchanged.

Coherence breaks down in three ways:
1. **Pieces built outside the token system.** The mobile tab bar, the inventory controls, the coin tints, spell-description ink, and the spell cast/warn strips all use undefined tokens with dark-theme fallbacks or literal colours. They hold in midnight and fall apart in vellum. That breaks **The Three Themes Rule** in exactly the places a phone user touches most.
2. **Glow is decoration here.** The sheet name, every proficient or expert skill dot, every spent spell slot, every full supply pip and the vitals strip's drop shadow are all lit at rest. That goes against **The Glow Is State Rule**, **The One Standing Glow** and the Elevation rule ("Cards do not float").
3. **The phone layout was not composed — it was allowed to happen.** The desktop header's 120px portrait, 36px name and wrapped XP figure push HP to y≈521 at 375px.

Missed opportunity: the vitals strip is the product's single best idea for "Player between turns", yet on a phone it sits below the fold, behind identity chrome.

---

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Every save, grant and inspiration failure goes only to `console.error` (`character-sheet.component.ts:198`, `:145`, `:334`, `:347`), so the sheet looks saved when it is not. Spell-slot pips are filled = *spent*, with a gold glow, which reads as "available". |
| 2 | Match System / Real World | 3 | Fluent 2024 vocabulary (Heroic Inspiration, d20 Tests, exhaustion levels, prepared cap). But "Sleight" is shown for Sleight of Hand (`utils/character-math.ts:84`), and the DM's slot readout "2/4" means used/max, not remaining. |
| 3 | User Control and Freedom | 3 | The DM edit modal has Cancel and Escape. Drop → Discard is a two-step. Missing-component cast has "Cast anyway / Cancel". Rename is double-click only, with no visible or keyboard path (`character-sheet.component.html:31`). |
| 4 | Consistency and Standards | 2 | Three themes diverge (tab bar, coins, inventory accent). Slot counts edit inline while every other DM number opens the logged modal. The sheet tabs use Newsreader 13px while the global `.tab` uses Cinzel 11px. Four button shapes (2px `.btn`, 4px `.inv-btn`, 6px `.insp-use` / `.spend-die-btn`, 10px/pill `.spell-prep-btn`). |
| 5 | Error Prevention | 2 | The DM sets HP as an absolute value (42 → type 35) and has to do the subtraction mid-combat. Condition chips toggle on a single tap. The trash icon sits beside Level Up (it does open a confirm). |
| 6 | Recognition Rather Than Recall | 2 | Key rules live in `title` tooltips that touch screens never show: why Level Up is disabled, exhaustion effects at level 0, the inspiration rule, the hit-die rule. The only DM-editable cue is a dashed underline. |
| 7 | Flexibility and Efficiency | 2 | Spell name search and school filter, Ctrl+Enter in notes, Enter/Escape in editors. No HP ± quick action, no collapse-all for spells, no way to jump to a panel on the long Sheet tab. |
| 8 | Aesthetic and Minimalist Design | 2 | Strong identity, but at 375px the header eats about 64% of the first screen. All 16 condition chips show at all times. Spells render expanded by default. Several standing glows. |
| 9 | Error Recovery | 1 | No user-facing error state anywhere on the sheet. A failed PUT leaves the optimistic edit (or none) with no message and no retry. |
| 10 | Help and Documentation | 2 | Good in-world empty copy and rule tooltips (Save DC formula, exhaustion), but tooltip-only, so missing on phones. The Notes tab in the DM view is a header with nothing under it and no explanation. |
| **Total** | | **21/40** | **Acceptable** |

---

## Cognitive load

Failures, **4 of 8 (high):**
- **Visual hierarchy (fail):** at 375px the most important glance targets (HP, AC) start at y≈521 of 812. Portrait, eyebrow, a 2-line clipped name, a 2-line subtitle, a 3-line XP figure and two rows of actions all outrank them.
- **Minimal choices (fail):** the Conditions panel shows **16 toggle chips + 6 exhaustion pips + 5 inspiration pips (DM)** as one undifferentiated field, none of them grouped. The header in DM view has **6 actions** (Connect, Roll, Level Up, Grant Level-Up, Delete, plus the editable level/XP).
- **Progressive disclosure (fail):** every spell is expanded by default (`spellbook-panel.component.ts:142-147`, `isExpanded` returns true unless toggled). With real descriptions a 20-spell bard becomes a wall of text. The empty demo descriptions show this as a stray 16px border stub under every row.
- **Chunking (fail):** Skills is an 18-row flat list with no grouping by ability. The Sheet tab stacks 8–9 panels into a single ~3,750px scroll on a phone.

Passes: single focus per tab, grouping (panels plus hairlines do this well), one-thing-at-a-time (modals are focused), working memory (mostly — though "filled pip = spent" asks the player to remember an inverted convention).

Decision points with more than 4 visible options: Conditions chips (16), header actions in DM view (5 buttons), mobile tab bar (5 tabs: at the limit, acceptable), spell row in DM + live session (name, C/R badges, school, time, range, Prepare, Cast: 7 elements on one row).

---

## Emotional journey

- **Peak:** opening a sheet on desktop. The 48px Cinzel name, gold ✦ subtitle and gradient-ruled vitals strip feel like unrolling a star chart. The drop-capped bio and quoted traits in Background & Story are the warmest moment in the app.
- **Valleys:**
  - At 375px the hero's own name is clipped ("LYRA MOONWHIS…", `scrollWidth 280` vs `clientWidth 195`). The first thing the player sees is their character's name cut off.
  - In vellum the bottom tab bar is a black slab with invisible labels, so the player cannot tell which tab they are on.
  - Arms & Equipment at 375px truncates every weapon to "R…", "H…", "D…".
- **High-stakes reassurance:** weak.
  - Level Up is disabled with the reason only in a tooltip.
  - A DM HP change has a log-entry field (good) but no preview of the result.
  - A failed save is silent.
  - Delete Character does go through a confirm modal (good).
  - Heroic Inspiration "Use" spends it immediately, with no confirm or undo. Low stakes, but it is a once-per-rest resource.

---

## What's working

1. **The vitals strip as a component.** It reads one number per cell (Cinzel 30px), with a dim-italic caption that explains it ("d20 + mod", "short rest to spend", "level 7"). The HP bar is the DESIGN.md signature, executed faithfully. On desktop it is the right glance target.
2. **The DM edit modal is a genuinely good pattern.** Clicking any DM-editable number opens a focused, focus-trapped dialog with an optional log line, prefilled with the auto-diff ("DM changed current HP 42 → 42"). That gives the player a readable audit trail in the Log tab ("DM changed AC 14 → 15") — the visibility split made into a feature.
3. **Mobile reflow in the panels that got attention:**
   - inventory rows stack, with ~40px buttons (`inventory-panel.component.scss:247-264`)
   - spell rows wrap so the name gets its own line (`styles.css:986-1009`)
   - coin labels swap to CP/SP/EP at ≤480px instead of overflowing
   - the tab bar is pinned in the thumb zone
   
   Where a panel was designed for the phone, it works.

---

## Priority issues

**[P0] The mobile tab bar and other untokenised colours break vellum (and are off-theme in candlelit)**
- **What:** `.sheet-tabs` on ≤820px uses `var(--panel-bg, rgba(18,18,32,0.96))`, `var(--line, …white…)` and `var(--celestial-2, …)` (`character-sheet.component.scss:76, 96-97, 118-120, 130`). `--panel-bg` and `--line` are not defined anywhere in `styles.css`, so every theme gets the near-black fallback.
  - In vellum the active tab label is `#1a3060` on ≈`#1b1a27`: about **1.3:1**, effectively invisible.
  - Inactive labels are `#605338` on the same slab: about **2.3:1**.
  - In candlelit it is a cool navy slab under a sepia page.
  
  The same "undefined token with a dark fallback" pattern appears in several other places:
  - `--accent` (undefined) falls back to CSS named `gold` (#FFD700) for the inventory "equipped" tag, Sell, Equip-on and "+ Grant item" (`inventory-panel.component.scss:174, 204-205, 209-214, 225-226`)
  - `.spell-desc / .spell-higher / .spell-material` are hard-coded `rgba(255,255,255,0.7)` (`styles.css:964-967`), which is white text on parchment
  - coin tints are literal hexes (`styles.css:1081-1085`); in vellum, silver/electrum/platinum amounts measure about **1.0–1.3:1** against `--bg-2`, so "48", "0" and "3" are unreadable
  - `.spell-cast-strip.warn/.blocked` use `#fbbf24` / `#f87171` and `.spell-badge.conc` uses `#7dd3fc` (`styles.css:909-910, 940`)
- **Why it matters:** this is the primary navigation on a phone, on one of three first-class themes. **The Three Themes Rule** and **The AA Floor Rule** are both broken. The CI contrast gate cannot catch it because these values are not tokens.
- **Fix:**
  - Tab bar background → `color-mix(in oklch, var(--surface) 96%, transparent)`; border → `var(--border)`; active colour → `var(--gold)` to match `.tab.active`.
  - Replace `--accent` with `--gold`.
  - Spell description ink → `var(--text-2)`.
  - Warn/blocked → `var(--gold)` / `var(--crimson)`; concentration badge → `var(--celestial)`.
  - Define coin tints per theme as `--coin-cp/-sp/-ep/-pp` tokens inside each `[data-theme]` block so `check:contrast` covers them.
  - Then grep the sheet folder for `var(--[a-z-]+, ` fallbacks and delete every fallback whose token does not exist.
- **Suggested command:** /impeccable colorize (scoped to token conformance — no palette repaint)

**[P0] "DM-only notes" render on the player's own sheet**
- **What:** `PC.notes` is declared `// DM-only notes` (`models/pc.ts:131`), but `background-story.component.html:76-83` renders it labelled "DM Notes" whenever it is non-empty, with no visibility gate. In the player view of Lyra it shows "Owes the Crimson Lantern 60gp. Has a contact in Neverwinter named Olivar."
- **Why it matters:** PRODUCT.md calls the DM/player split a hard rule ("No change may leak DM-only state to a player view"). Even if the backend strips `notes` for owner reads in production, the template has no gate, and demo mode shows it.
- **Fix:**
  - Gate the block on the DM context: pass `[showDmNotes]="editable"` from `character-sheet.component.html:244`.
  - Confirm the owner-read DTO omits `notes`.
  - If these notes are actually meant to be shared, rename the label and the model comment so the intent is unambiguous.
- **Suggested command:** /impeccable harden

**[P1] At 375px the header buries the vitals and clips the hero's name**
- **What:** `.sheet-header` keeps the desktop composition below 1100px: a 120px portrait in a `120px 1fr` grid, and `.sheet-name { font-size: 36px !important }` (`styles.css:499-509`). At 375px:
  - "Lyra Moonwhisper" clips to "LYRA MOONWHIS"
  - the subtitle wraps to 2 lines
  - "0 / 34000 XP" wraps to 3 lines in a sliver beside a 6px track
  - the actions take 2 rows
  
  HP starts at **y≈521 of 812**. Proficiency and Hit Dice are below the fold.
- **Why it matters:** **The Phone Is The Table Rule** ("dense is acceptable, cramped and clipped are not") and the PRODUCT principle "Time-to-answer beats completeness". The "Player between turns" needs HP or AC in one glance and gets a portrait.
- **Fix:** add a ≤560px header variant:
  - 56px portrait inline with the name
  - name at 24–28px with `overflow-wrap: anywhere` (no `!important`)
  - subtitle as one line (class · Lv 7) with species on hover/second line
  - XP figure under the bar instead of beside it
  - actions as one compact icon-plus-label row, or moved into the bottom bar's overflow
  
  Target: HP/AC visible at or above y≈260.
- **Suggested command:** /impeccable adapt

**[P1] Mobile overrides for the ability and equipment grids never apply (source order)**
- **What:** the `@media (max-width: 720px)` block that sets `.abilities` to 2 columns and `.equip-grid` to 1 column (`styles.css:621-626`) is declared **before** the base `.abilities` rule (`styles.css:668`) and the base `.equip-grid` rule (`styles.css:783`). Specificity is equal, so the later base rules win. Computed at 375px: `.equip-grid` is still `136.5px 136.5px`.
- **Why it matters:** Arms & Equipment truncates every weapon name to a single letter ("R…" for Rapier of the Last Lullaby, "H…", "D…"). The damage column survives but the player can't tell which weapon it belongs to. That is a clipping failure under **The Phone Is The Table Rule** on the Inventory tab.
- **Fix:** move the 720px block below the base `.equip-grid` rule (or co-locate each override with its base rule). Re-check abilities at 375px afterwards: three columns currently fit, so decide deliberately whether 2 columns is still wanted.
- **Suggested command:** /impeccable layout

**[P1] Silent save failures and tooltip-only explanations**
- **What:**
  - `persist()`, `toggleLevelGrant()`, the grant flows and the inspiration calls all end in `console.error` only (`character-sheet.component.ts:145, 198, 334, 347, 407, 419, 432, 444, 468`).
  - Separately, the disabled Level Up reason (`levelUpHint`), the exhaustion effects, the inspiration rule and "Click to edit …" exist only as `title` attributes, which never appear on touch.
- **Why it matters:** a player who taps a condition at the table, or a DM who grants a feature, gets no signal that it failed. The next poll quietly reverts it. On a phone the player is never told *why* Level Up is greyed out.
- **Fix:**
  - Route every error callback through the existing `<app-toast>` live region with in-world copy ("The ink didn't take — Lyra's sheet wasn't saved. Try again.").
  - Under the disabled Level Up, render the hint as visible 11px dim text ("Reach 34,000 XP or ask your DM").
  - Show the exhaustion effect line at level 0 too, as a muted rule summary.
- **Suggested command:** /impeccable clarify

---

## Persona red flags

**Player between turns (phone, one glance, needs one number)**
- Unlocks the phone on the Sheet tab and sees a portrait and a clipped name. HP is two-thirds of the way down the screen.
- On the Spells tab, slot pips show ●●○○ for Level 1. They read that as "2 left" when it means 2 *spent*: filled plus gold glow is `.spell-slot.used` (`styles.css:848`).
- Wants a spell's casting time: every spell is expanded by default, so they scroll through descriptions.
- In vellum they cannot see which bottom tab is active.

**DM mid-combat (running initiative while talking)**
- Opens Throk's sheet from the party board to apply 7 damage. The edit modal asks for the *new absolute* HP (`dm-edit-modal.component.html:8-17`), so the DM computes 78−7 aloud. There is no "−7" entry, unlike the initiative panel's damage/heal controls.
- Spell slots edit inline as "2/4" (used/max) with no modal and no log line, unlike every other DM number.
- The trash icon (Delete character) sits at the end of the DM's header action row on a *player's* sheet (`character-sheet.component.html:159`). It is confirmed, but it is a needless loaded control in a cross-link view.
- In the DM view the Inspiration pips render as an overlapping chain of rings (padding plus −4px margin on a 9px dot, `conditions-panel.component.scss:63-68`), so the DM cannot tell 3 from 4 at a glance.

**Casey (distracted mobile)**
- The bottom tab bar is in the thumb zone (good).
- But exhaustion pips are 22px, inspiration "Use" is 20px tall, survival and supplies ± steppers are `line-height: 20px` (`survival-panel.component.html:24-29`, `styles.css:868`), and the Prepare pill is about 22px tall even after the mobile bump. All are below 44px.
- Rename needs a double-click, which is impossible to discover on touch.

**Sam (accessibility)**
- Every ability tile announces "save" whether or not the save is proficient. The marker is hidden with `opacity: 0`, not `display: none` (`ability-scores.component.html:11`, `styles.css:709-717`).
- `app-editable-number` declares `role="button"` but handles only Enter, not Space (`editable-number.component.html:136-144`).
- The sheet tabs have `role="tab"` but no `aria-controls` / `tabpanel` and no arrow-key navigation.
- Unprepared spells sit at `opacity: 0.5` (`spellbook-panel.component.scss:23`), which drops their text under AA in every theme.
- Text below **The 11px Floor Rule**:
  - `.ability-save` 8px
  - `.spell-badge` 8px
  - `.ability-name`, `.skill-ability`, `.coin-name`, `.story-prof-label` 9px
  - `.spell-prep-btn` / `.spell-cast-btn` / `.spell-cast-level` 9px on desktop
  - `.eyebrow`, `.condition`, `.exhaustion-label` / `.exhaustion-pip`, `.insp-use`, `.spell-time` / `.spell-range` 10px
- The spellbook expandable row is already in `a11y-notes.md` "Found but deferred" — not re-raised here.

**Jordan (first-timer)**
- The Inventory tab shows "Arms & Equipment" (with a Potion of Healing ×3) directly above "Inventory: No items yet". Two lists, and the empty one says they own nothing.
- The Conditions panel lists "Inspired" as a toggle chip right above a separate Heroic Inspiration meter and badge.
- The Notes tab in the DM view is a bare header with no message.
- "Sleight" is a truncated skill name.

---

## Minor observations

- Standing glows at rest, against **The Glow Is State Rule** and **The One Standing Glow**:
  - `.sheet-name` text-shadow (`styles.css:520`)
  - `.skill.prof/.expert .skill-dot` (the expert dot carries the *celestial* glow, "always a bug": `styles.css:737-738`)
  - `.spell-slot.used`, `.supply-pip.full`, `.insp-pip.filled`
  - `.inspired-badge` pulsing infinitely (`conditions-panel.component.scss:114`)
  - `.vitals` uses `box-shadow: var(--shadow)`, the modal-only ambient shadow (`styles.css:556`)
- `.ability` has `cursor: pointer` and a gold hover glow for *players*, where clicking does nothing (`styles.css:673-686`). That is a false affordance.
- `.spell-prep-btn` uses a literal `rgba(255,255,255,0.25)` border and `rgba(212,175,55,…)` hover (`spellbook-panel.component.scss:36-47`). The white border disappears in vellum.
- The spellbook header at 375px: "SPELLBOOK", "Save DC 15 · Spell Atk +7" and "Prepared 8 / 11" have no gap and overflow the header (scrollWidth 315 > 293). The header needs `flex-wrap` plus a gap.
- `level-ready-badge` and `inspired-badge` use Newsreader 11px with 0.02em tracking, while chips elsewhere are Cinzel. That is inconsistent chip voice (and breaks **The Tracking Ladder Rule** if moved to Cinzel without tracking).
- Inline `style=""` attributes carry layout and colour in survival-panel, coin-purse, background-story, pc-notes, pc-log, equipment-panel and vitals-strip. That is fine for now (px→token is a later slice), but they block theming fixes.
- `pc-notes` and `pc-log` rows use `var(--line, rgba(255,255,255,0.06))`, an undefined token, so they are invisible dividers in vellum.
- Demo data shows Lyra at Level 7 with "0 / 34000 XP" while her Log says "Awarded 450 XP". Worth checking whether the XP bar shows *total* XP against the *next threshold* as intended (0 total at level 7 is suspicious).
- Survival panel (source): the exhaustion summary is `font-weight: 600; font-size: 13px` inline, with gold-or-crimson colouring for a signed number. Negative exhaustion ("−1 exhaustion") will confuse anyone who knows the 2024 rule, where exhaustion never goes below 0.

---

## Questions to consider

1. **What if the phone sheet opened on the vitals, not the portrait?** A sticky 2-row HP/AC/Init strip under the app bar on every tab (not just Sheet) would answer "Player between turns" from any tab. Would the player ever miss the 120px portrait?
2. **Should Conditions be a picker rather than a field of 16 chips?** Show only the *active* conditions as chips, with "+ Condition" opening the list. At the table, almost every glance is "what am I suffering from?", not "what could I suffer from?".
3. **Are "Arms & Equipment" and "Inventory" one concept or two?** If the legacy weapons/gear lists are just a pre-shop artefact, would folding them into the interactive Inventory (with an "equipped" filter) remove the most confusing moment on the Inventory tab?
