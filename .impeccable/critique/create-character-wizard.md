Method: dual-agent (A: isolated design-review sub-agent · B: detector + measured browser evidence, gathered in the parent before A's output was read). B ran in the parent rather than its own sub-agent; isolation of A from B held.

# Critique — Create-character wizard

**Design Health Score: 19/40 — Poor (just under Acceptable).** Weakest: Consistency (1), Error
Recovery (1). Audit: 8/20 — Poor.

## Design Specificity Verdict

**LLM assessment:** authored in voice ("Forge a New Hero", "Inscribe", the Origin Feat card, a
2024-PHB-shaped flow) but only half in the system. The visual layer is an older language — literal
violet `#8a5cf6` / `#a78bfa` for progress, selection, chips and counters — never moved onto The
Astral Chart.

**Deterministic scan:** `dark-glow` on `div.step-dot.active` (#8a5cf6) and `div.modal.wizard`;
`undersized-ui-text` ×6 (ruleset badges 8–9px, method tabs 10px, "soon" 7px); `low-contrast` on
disabled "2014 5e" / "Roll Dice" (disabled controls are exempt from 1.4.3). Measured in vellum:
ability labels 1.11:1, future step numbers 1.06:1; midnight/candlelit future steps 3.1:1.

**Agreement:** vellum invisibility and the off-palette violet are both assessments' top two. Here
the `dark-glow` "AI purple" slop finding is a **true positive**. **Reviewer-only, confirmed in
source:** the modifier column shows the score ("INT 17 +17") — `score | modifier` passes the raw
score (`ability-scores-step.component.html:44,87`, `review-step.component.html:157`); the saved
character is computed separately and is correct. Also: disabled Next/Inscribe look enabled (no
`.btn:disabled` style in `styles.css`); no close/Escape on a phone, and Cancel on step 1 deletes the
draft without asking. **False positive:** `low-contrast` on disabled placeholders.

## Overall Impression

The flow is well thought through and on voice; the paint is from another app, and in vellum the
ability step cannot be completed.

## Priority Issues

- **[P0] Vellum: ability labels, totals and wizard chrome invisible.** → `/impeccable colorize`
- **[P1] Modifier column shows the score, not the modifier.** → `/impeccable harden`
- **[P1] Disabled Next / Inscribe look enabled; Next goes dead without saying why.** →
  `/impeccable harden`, `/impeccable clarify`
- **[P1] Off-palette violet with a standing glow.** → `/impeccable colorize`
- **[P2] No close / Escape on a phone; Cancel wipes the draft silently.** → `/impeccable harden`

**Questions skipped:** batch run across ten surfaces. The owner-direction questions this surface raises are consolidated in `docs/impeccable-adoption-plan.md` §10.

Technical detail, evidence and file locations: `.impeccable/surfaces/create-character-wizard.md`.

---

## Appendix — Assessment A (design review, as written by the isolated reviewer)

### Assessment A — Create-character wizard

Looked at: the 9-step wizard (`components/create-character-modal/` + all `steps/`), walked live in the browser pane at 375×812 as a player (Elf / Wizard / Sage, Standard Array and Point Buy both exercised, one cantrip added, Option A kit), through to Review and back out via Back ×8 → Cancel (nothing inscribed, draft cleared, roster still 3). Themes: midnight throughout; vellum on Spells + Ability Scores; candlelit on Ability Scores. Desktop (800×600 pane) checked at Review. Escape tested at step 1 and step 9. Source read for every step.

## Design specificity verdict

**Authored, but only half in this system.** The voice is unmistakably Table Mimic. "Forge a New Hero", "Every legend begins with a name written in ink, and most end the same way", "Inscribe" as the commit verb, the gold-bordered Origin Feat card, and a 2024-PHB-shaped flow (background grants the +2/+1 and the origin feat, Sorcerer/Warlock pick a subclass at level 1). None of this would fit another product unchanged. The phone build is also deliberately designed: a full-screen sheet with a pinned progress row and a sticky thumb-zone action bar.

The visual layer, though, is a second, older design language that was never moved onto The Astral Chart. The progress dots, the "chosen/locked" chips, the spell selection state, the source-filter pills, the ability bonus figures and the counters are all a **literal violet `#8a5cf6` / `#a78bfa`** that is not in the palette (Thistle Violet is `#a189d5`, and it is meant only for "chips and tags"). The active dot also carries a **violet glow at rest**. 49 declarations use `rgba(255,255,255,…)` text and borders. So the wizard reads as a purple SaaS stepper wearing gold headings. It breaks The Three Themes Rule outright in vellum (details below) and dilutes The Scarce Accent Rule: the selection colour changes from gold (picker rows) to violet (skills, spells) to celestial (subclass cards) depending on the step.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Disabled "Next →"/"Inscribe" look exactly like enabled ones (no `.btn:disabled` rule anywhere). Step dots are bare numbers, and the total jumps 8→9 when a caster is picked. The spells counter sits ~4,000px down a 51-row list. |
| 2 | Match System / Real World | 2 | Strong 2024 vocabulary, but the modifier column shows the **score** ("INT 17 **+17**", "CHA 8 **+8**"), Speed on Review is hard-coded "30 ft", Elf "Lineages" are listed but never chosen, and the Review copy says "Click Inscribe" on a phone. |
| 3 | User Control and Freedom | 2 | Back works, the Review Edit buttons jump to a step, and the draft persists across disconnects. But on a phone there is no close or Escape: leaving from Review takes 9 taps, and the 9th (Cancel, in the same spot as Back) silently throws the draft away. |
| 4 | Consistency and Standards | 1 | Three different "selected" colours (gold / violet / celestial). Off-palette violet and rgba-white literals. Tabs and chips come in four sizes (9–12px) and three radii. Numbers use Cinzel where DESIGN.md says JetBrains Mono. |
| 5 | Error Prevention | 2 | Good: the standard array removes values already used, the bonus selects disable duplicates, and the skill cap holds. Bad: Point Buy advances with **27/27 points unspent**, spells advance at 1/3 cantrips and 0/6 spells with no warning, and Magic Initiate's two cantrips and one spell are never collected. |
| 6 | Recognition Rather Than Recall | 3 | The accordion shows traits, saves and feat right under the choice, and Review summarises everything. But the six array values are hidden inside each select, and the +2/+1 selects sit *below* the grid they change. |
| 7 | Flexibility and Efficiency | 2 | Enter advances from the name field and Review edits jump straight to a step. But the dots are not navigable, and each spell costs two taps (expand, then "Add to spells") plus scrolling: 9 spells means about 18 taps. |
| 8 | Aesthetic and Minimalist Design | 2 | The arcane headings and the feat card are lovely. A dead "2014 5e / Coming Soon" toggle bar takes the top 60px of the phone sheet on every step, and violet clashes with gold on every screen. |
| 9 | Error Recovery | 1 | No error messaging at all. Next simply goes dead without saying why. A failed spell fetch quietly falls through to "No spells match your search." |
| 10 | Help and Documentation | 2 | Each step's subtitle explains the decision, and traits and feats carry descriptions. There is no "what matters for a Wizard" cue on the class, ability or spell steps. |
| **Total** | | **19/40** | **Poor (just under Acceptable)** |

## Cognitive load

**3 of 8 failed (moderate).**
- **Chunking: fail.** Spells is one flat list of 51 rows (filters: All / Cantrip / 1st only). Backgrounds is 16 rows under source headers.
- **Minimal choices: fail.** Species 9, class 12, background 16, spells 51. All are reasonable domain sets, but none has a "recommended for your class" cue, so every step is a wall of options.
- **Working memory: fail.** On Ability Scores you must remember which abilities your class wants (Class showed only "Hit Die d6 / Saves INT, WIS" two steps back). The +2/+1 assignment comes *after* the grid. On Spells the progress counter is off-screen, so you have to remember how many you have picked.
- Passes: single focus (the full-screen sheet), grouping, visual hierarchy of title/sub/choice, one decision per step, progressive disclosure (the accordion).

Decision points with more than 4 visible options: Species (9), Class (12), Background (16 + 3 source filters), Proficiencies (6 class skills plus 2 language selects of about 16 each), Spells (51 rows + 3 filters + search), Ability Scores (6 selects + 3 method tabs + 2 bonus selects at once).

## Emotional journey

- **Peak:** step 4, when Sage expands to show the gold-bordered **Origin Feat: Magic Initiate (Wizard)** card. It feels like a real 2024 character sheet taking shape. Review's gold HP / AC / Initiative strip is a second, smaller peak.
- **Valley 1:** Ability Scores. Six bare "—" selects with no visible array, and the "+17" modifiers make a careful player distrust the whole tool. In vellum the ability labels and totals vanish (see P0).
- **Valley 2:** Spells. 51 rows, two taps per pick, and the "1/3 cantrips · 0/6 spells" counter is buried below the list, so you never see progress.
- **High-stakes moment (Inscribe):** reassurance is decent. Review lists everything and has Edit links. But it shows the wrong modifiers and no warning that 2 cantrips and 6 spells are still missing, so "Everything looks right?" is answered with false confidence. The end of the flow (peak-end) is weaker than it should be.
- **Abandon moment:** Cancel at step 1 discards the saved draft with no confirmation. A player thumbing Back quickly to fix their name lands on Cancel in the same spot and loses everything.

## What's working

1. **The phone sheet is properly designed for the table.** `create-character-modal.component.scss:113-182` turns the modal into a full-height sheet: a pinned progress row, a body that scrolls on its own (The Panel Owns Its Scroll Rule), and a sticky 48px Back/Next bar in the thumb zone. This is exactly The Phone Is The Table Rule done right.
2. **Accordion pickers put the consequence next to the choice.** Selecting a species, class or background expands its size/speed/traits, hit die/saves, or bonuses/proficiencies/feat directly beneath it (`_wizard-shared.scss:67-105`). The player never has to flip to a separate detail pane.
3. **Disconnect-safe drafts.** The draft is saved on every step change, on unload and on destroy, and restored on reopen (`create-character-modal.component.ts:392-402`). That is real care for a group sharing flaky table Wi-Fi.

## Priority issues

**[P0] Vellum theme: ability labels, totals and wizard chrome are invisible**
- **What:** 49 `rgba(255,255,255,α)` literals (text, borders, fills) render white-on-parchment in vellum. Seen live: on Ability Scores the STR…CHA labels and the "= 10 … = 17" totals cannot be seen. The "2014 5e / Coming Soon" bar and the future step dots (8, 9) disappear. Worst offenders: `ability-scores-step.component.scss:21,42,47,128`; `_wizard-shared.scss:11,21-22,57,62`; `review-step.component.scss:26,50,79-80,104,110,121,139-157`; `create-character-modal.component.scss:38,49-50,74-76,102`; `species-step.component.scss:22,31,40,48`; `equipment-step.component.scss:54,69,79,94,103-104`; `background-step.component.scss:21,38-39,95`; `class-step.component.scss:62`.
- **Why it matters:** It breaks The Three Themes Rule ("a change verified in one theme is unverified") and the AA floor promised in PRODUCT.md. A vellum player cannot see which score they just assigned.
- **Fix:** Map each literal to a token: 0.85–0.9 → `var(--text)`, 0.5–0.75 → `var(--text-2)`, 0.3–0.45 → `var(--text-dim)`, borders 0.05–0.12 → `var(--border-soft)` / `var(--border)`, fills 0.03–0.06 → `var(--surface-2)` or `color-mix(in oklch, var(--text) 4%, transparent)`. Then run `npm run check:contrast` and look at all three themes.
- **Suggested command:** /impeccable colorize (token-only re-map, no repaint)

**[P1] Ability modifiers show the score, not the modifier**
- **What:** `{{ score | modifier }}` passes the *score* to a sign-formatter (`ModifierPipe` only adds "+"). The result is "INT 15 +2 = 17 **+17**", "CHA 8 **+8**". Locations: `ability-scores-step.component.html:44` and `:87`, `review-step.component.html:157`. The saved character is computed separately (`modNum`) and is correct, so only the display is wrong. It still appears on the two screens players use to check their build.
- **Why it matters:** A D&D player reads the modifier, not the score. "+17" destroys trust in the tool's maths at the exact step meant to build it.
- **Fix:** Bind `{{ modOf(score) | modifier }}` (`Math.floor((score - 10) / 2)`), or add a `abilityMod` pipe. Add a spec pinning 8 → "−1" and 17 → "+3".
- **Suggested command:** /impeccable harden

**[P1] Disabled Next / Inscribe are visually identical to enabled**
- **What:** `styles.css:413-456` defines `.btn` / `.btn.primary` with no `:disabled` state. Measured live: the disabled Next has opacity 1, `cursor: pointer`, and the same gradient and standing glow. On step 1 with an empty name, on Proficiencies before 2 skills, and on Ability Scores before the bonuses are set, the big gold button looks ready and does nothing.
- **Why it matters:** This is the only feedback the wizard gives for an incomplete step, and it is invisible. The user taps, nothing happens, and they assume the app is broken.
- **Fix:** Add a global `.btn:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }`. This also removes the glow from a disabled primary, so The One Standing Glow only stands when the button is live. Add a one-line reason beside the action bar ("Choose 2 more skills").
- **Suggested command:** /impeccable polish

**[P1] Off-palette violet progress and selection system, with a standing violet glow**
- **What:** `create-character-modal.component.scss:80-91` paints the step dots `#8a5cf6` with `box-shadow: 0 0 10px rgba(138,92,246,.5)` at rest. Violet `#a78bfa` / `rgba(138,92,246,…)` also marks locked skills and the "chosen" counter (`proficiencies-step.component.scss:30,41-43,84-86`), spell selection, filter tabs and badges (`spells-step.component.scss:28-30,73-79,108-109,123,147-148`), source pills (`background-step.component.scss:26-31`), and the bonus figures (`ability-scores-step.component.scss:34,123`; `review-step.component.scss:164`).
- **Why it matters:** It breaks The Glow Is State Rule (a second standing glow), The Three Themes Rule (literals), and The Scarce Accent Rule. The user has to learn three "selected" colours (gold row, violet chip, celestial subclass card) for one meaning.
- **Fix:** Progress dots: done = `--gold` hairline + `--gold` check, active = gold fill tint (`color-mix(gold 18%, surface-2)`) with gold text and no glow, future = `--border` / `--text-dim`. Use **gold for every "selected"** state. Use `--violet` (the token) only for the "granted by background" lock, so locked reads as a different category.
- **Suggested command:** /impeccable colorize

**[P2] Exit and abandon paths on phone: no close, no Escape, and Cancel wipes the draft without asking**
- **What:** At 375px the sheet fills the screen (no backdrop to tap), has no × and no `appEscapeClose`. Escape did nothing on step 9. The left action button is "Back" on steps 2–9 and becomes "Cancel" on step 1 (`create-character-modal.component.html:212-214`). `cancel()` clears the draft immediately (`create-character-modal.component.ts:752-757`).
- **Why it matters:** Leaving from Review is 9 taps, and the last one destroys work without confirmation. This sits on top of the known "Modals without Escape support" item in `docs/a11y-notes.md`, but the irreversible draft loss is new.
- **Fix:** Add a × in the pinned progress row (aria-label "Close — your draft is kept") that closes *without* clearing the draft. Wire `appEscapeClose` to that same close. Rename the step-1 button "Discard hero" and ask for confirmation once any step past 1 has been visited.
- **Suggested command:** /impeccable harden

## Persona red flags

- **Casey (distracted mobile):** The step-1 left button changes from Back to **Cancel** under a thumb tapping Back repeatedly, and Cancel deletes the draft. The point-buy `−`/`+` steppers are **24×24px** with 6px gaps (`ability-scores-step.component.scss:144-158`). Review "Edit" buttons use **8px** labels. The spell counter is off-screen, so after an interruption Casey cannot tell how many spells are left. Native `<select>`s for the standard array mean six separate pop-up pickers.
- **Sam (accessibility):** The step dots are `div`s with no "Step 6 of 9" (already in a11y-notes, so not new). Accordion heads lack `aria-expanded`. Point-buy `−`/`+` have no `aria-label` (screen reader says "minus button"). The six `.ability-select`s have no label (the visible "STR" is a sibling `span`). The `.class-pick.disabled` skills (Medicine / Religion at opacity .3) are still focusable `<button>`s, not `disabled`. Text below 11px: ruleset bar 9px/8px, "Soon" 7px, Review stat labels 8px, Review edit 8px, feat eyebrow 9px, spell "Selected" badge 8px, `.btn.sm` 9px ("Add to spells"). All break **The 11px Floor Rule**.
- **Jordan (first-timer):** Class shows only "Hit Die d6 · Saving Throws INT, WIS", while the subtitle promises "hit points, fighting style…". Nothing says a Wizard wants INT, so Ability Scores is guesswork. Elf "Lineages: Drow, High Elf, Wood Elf" looks like a choice but cannot be picked. The Magic Initiate feat says "You learn two Wizard cantrips…" and the wizard never asks which. Spells can be skipped at 1/9 picked, and Review only says "Cantrips: Fire Bolt".
- **Player between turns:** Mostly not this surface's job. But the Review strip shows the right one-glance numbers (HP 8, AC 11, Init +1), and then the ability tiles underneath show "+17". The one number a player would glance at for a check is wrong.
- **DM mid-combat:** Not the primary user. Risk: a player building a replacement character at the table, on Review, hits Back nine times while the DM waits. A "Save & close" exit would let them come back to it after the encounter.

## Minor observations

- The wizard forces the primary-button gradient `color-mix(in oklch, gold 30%, surface-2)`, which renders **plum/mauve** in midnight (measured as oklch hue ≈ 320°), not gold. The likely cause is oklch hue interpolation between gold and the navy `surface-2`, which passes through magenta. Candlelit renders gold. This is a global `.btn.primary` issue (`styles.css:428-430`), but it is most visible here because the button is huge and on screen for all nine steps. Mixing in `oklab` (no hue arc) should keep it gilt; verify all three themes with `check:contrast`.
- `review-scroll` caps at 340px (`review-step.component.scss:41`), and `species-detail` at 220px (`species-step.component.scss:7`). Both are nested scrollers inside the already-scrolling sheet: scroll-in-scroll on a phone, plus ~85px of dead space under Review. On desktop two scrollbars sit side by side.
- Review "Speed 30 ft" is hard-coded (`review-step.component.html:20`, and `speed: 30` at `create-character-modal.component.ts:707`), even though species detail carries the real speed.
- Review stats and ability tiles use Cinzel 17–18px, and the point-buy value uses JetBrains Mono. DESIGN.md says figures that are compared use JetBrains Mono.
- `.detail-card` radius 8px and `.equip-card` 4px drift from the 2–3px house corner (The Hairline Rule / Shapes).
- The "1st" spell filter reads as "IST" in Cinzel small caps.
- The Player field on step 1 is an empty disabled input in demo mode. It reads as a broken field rather than "you".
- `.equip-card.active` and `.class-pick.active` carry `--glow-gold` as a *selected* state. That is defensible as "state", but with the primary button also glowing, three gold glows are on screen at once on Equipment.
- `.detail-card.updating` pulses forever via `@keyframes pulse-opacity` with no `prefers-reduced-motion` guard in `_wizard-shared.scss`.

## Questions to consider

- What if the class step said in one line what the class *wants* ("Spellcaster — Intelligence") and Ability Scores pre-suggested the standard array in that order, so Jordan's first character is good by default?
- Does a 51-row spell list belong in a nine-step phone flow at all? What if Spells showed "Recommended starting spells" pre-ticked (count-correct), with "Customise" as the opt-in?
- If the 2014 ruleset is not coming soon, why does a disabled toggle own the most valuable 60px of every step on a phone?
