Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/campaign-dashboard.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/campaign-dashboard.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Campaign dashboard

Looked at: `/charactermanager` in DM role with "The Veiled Compass" selected, in a browser tab at 1024×768 (desktop pane) and 375×812 (mobile preset). Midnight throughout; vellum and candlelit checked on the curated cards and the header/board. I read the source for every child (party-board, party-treasury, campaign-notes, campaign-week, curated-shops/-encounters/-loot) and the matching `styles.css` blocks. The curated *editors* could not be opened, because demo mode refuses `open()` (more on that below), so I reviewed them from source. **Player view:** a player never reaches this surface. `sidenav.component.html:165-186` renders it only in the DM branch. Players get the roster plus their sheet, so this page carries no visibility-split risk.

## Design specificity verdict

**Mostly authored, with a second, unauthored layer bolted on underneath.** The top half is unmistakably this product. A Cinzel campaign title carries a gold-dust text-shadow, the subtitle is Newsreader italic with a ✦ separator, the invite code sits in a celestial pill in JetBrains Mono, the vitals strip is hairline-bounded, and the Party Vitals Board uses the crimson→gold Vitals Bar. "Set your DCs" and "steady" are good in-world captions. That is The Astral Chart.

The three curated cards (shops / encounters / loot) are where coherence fails. They use a different component vocabulary:
- 12px card radius and 10px row radius (`curated-*.component.scss:5, :54`) against the house 2–3px.
- Sentence-case `h2` titles ("Curated Shops") against Cinzel letterspaced `.panel-title`s ("SESSION NOTES").
- `rem`-sized grey meta text.
- Undefined tokens `--muted` and `--bg-elev` that fall back to literal `rgba(255,255,255,…)`.

They read like a generic admin CRUD widget dropped into the chart, and they are category-interchangeable. Campaign Notes and Campaign Week sit back in the house style, so the page alternates between two languages as you scroll.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Start vs Resume Session reflects live state well. But every curated-editor failure is `console.error` only. Tapping "Goblin Ambush (demo)" in demo does nothing visible (console: "Curated encounters are not available in demo mode"). |
| 2 | Match with real world | 3 | Strong D&D/in-world vocabulary. "Raging" is shown as a crimson condition chip and counted in the crimson "Conditions" vital, which treats a buff as harm. |
| 3 | User control & freedom | 2 | Campaign delete has an exemplary confirm. Delete shop / encounter / loot list / note / item fire on one tap with no confirm and no undo. |
| 4 | Consistency & standards | 2 | Two visual systems on one page (curated cards vs panels). Three link/button idioms (`.btn`, `.btn.link`, `.note-del` glyph). |
| 5 | Error prevention | 2 | Delete-campaign is disabled while a session is live, which is good. Note ✕ sits 4px from ✎ at 18×16px, so a mis-tap is a lost note. |
| 6 | Recognition over recall | 3 | Invite code, session number and party aggregates are all on screen. "Pass. Perc" / "Pass. Ins" are abbreviations a new DM must decode. |
| 7 | Flexibility & efficiency | 2 | JSON import/export and Ctrl+Enter notes are real accelerators. Curated rows are click-only (known backlog), and party refresh is manual. |
| 8 | Aesthetic & minimalist | 2 | Strong header. Below it, seven full-width stacked sections at equal weight, with prep tools and at-a-glance status interleaved. |
| 9 | Error recognition & recovery | 1 | Import errors render inline (good). Every other failure (create, open, delete, save notes, save coins) is silent. |
| 10 | Help & documentation | 2 | Useful inline hints ("click a hero to open their sheet", JSON format notes, `title` on Refresh). The `title` tooltips are invisible on touch. |
| | **Total** | **21/40** | Acceptable, at the low end. |

## Cognitive load

Failures: **4 of 8, which is high**.
- **Single focus: fail.** The page mixes "how is my party right now" (vitals, board, treasury) with "author content for later" (shops, encounters, loot, notes, week) in one undifferentiated scroll. PRODUCT.md principle 3 says *Preparation and play are different jobs*. This page fuses them.
- **Visual hierarchy: fail** below the fold. Every section is a same-width card, and nothing says which one matters now.
- **Minimal choices: fail.** The header action row is Start Session / Manage Party / Delete plus Refresh Party floating below the vitals, and the shop editor's "Import a standard category" shows one `+ Category` button per category (more than 4).
- **Progressive disclosure: fail.** Three create-name inputs plus a notes composer are all open at once on first paint.
- Pass: chunking (vitals 4-up), grouping, one-thing-at-a-time inside each editor, working memory (the invite code is visible where needed).

Decision points with more than 4 options: the shop editor's category import row, and the loot editor (notes + Copy JSON + Import JSON + coin pile + item composer + per-line qty + ✕).

## Emotional journey

- **Peak:** first paint of the header. The campaign name in large Cinzel with a gold halo, the setting/arc subtitle and the VEIL23 pill feel like opening a campaign ledger. The green "▶ Start Session" is the right invitation.
- **Valleys:**
  1. On a laptop-width pane (1024px) the title block is shoved into the right two-thirds with an empty column on its left (see P1 below), so the peak is undercut on the screen a DM most likely preps on.
  2. The board needs horizontal scrolling even on desktop.
  3. In vellum the curated "No curated shops yet…" hint and every row's sub-line are white-on-parchment and effectively invisible.
  4. A curated row tap that silently does nothing.
- **High-stakes reassurance:** Delete Campaign is excellent. It has a crimson `alertdialog`, explains what is lost, says "Its characters are **released, not deleted**", and is disabled during a live session. Delete *shop / encounter / loot list*, though equally destructive of prep work, gets none of that.

## What's working

1. **Delete-campaign confirmation** (`campaign-dashboard.component.html:171-192`). It is specific about consequences and gated on live session. This is the model the other destructive actions should copy.
2. **Party Vitals Board rows.** Portrait initials, the class/level sub-line, the Vitals Bar going flat crimson when bloodied, AC lit gold, and a "steady" calm chip when nothing is wrong give genuinely glanceable party status, and the rows are keyboard-operable with an `aria-label`.
3. **Deferred curated sections** (`@defer (on viewport)`) with in-voice placeholders. They keep first paint cheap without a jarring spinner.

## Priority issues

**[P1] Curated cards break The Three Themes Rule: hint text and row meta vanish in vellum**
- **What:** `curated-shops.component.scss` (and the encounter/loot twins) colour `.muted`, `.shop-sub`, `.field-label`, `.item-meta` and `.chevron` with `var(--muted, rgba(255,255,255,0.6))`, and the card background with `var(--bg-elev, rgba(255,255,255,.04))`. Neither token exists in `styles.css`. Measured in vellum: `.muted` computes to `rgba(255,255,255,0.6)` on a `#ede2c4` ground, so "No curated shops yet…" and "3 creatures" are invisible. The card radius is also 12px (`:5`) and rows 10px (`:54`), which violates *Shapes: near-sharp*.
- **Why it matters:** DESIGN.md says "A change verified in one theme is unverified", and this also breaks *The AA Floor Rule*. A vellum DM loses every empty-state instruction and every row count on the prep surface.
- **Fix:** Replace `--muted` with `--text-dim`, `--bg-elev` with the `.panel` treatment (`color-mix(surface 75%)`), and drop the hex/rgba fallbacks entirely. Set `border-radius` to `var(--radius-panel)` on the card and `var(--radius-sharp)` on rows and inputs. Better still, render each curated card as a `.panel` with a `.panel-header`/`.panel-title` so it joins the house language. This is a token swap, not a repaint.
- **Suggested command:** /impeccable polish

**[P1] Header grid collapses into an empty left column at 821–1100px**
- **What:** The dashboard sets an inline `style="grid-template-columns: 1fr auto"` on `.sheet-header` (`campaign-dashboard.component.html:5`). Below 1100px, `styles.css:499-509` adds `grid-template-areas: "portrait id" "actions actions"` for the character sheet's portrait. With no portrait, `.sheet-id` lands in the second track. Measured at 1024px: columns `210px 394px`, and the campaign name starts at x=586 with a 210px hole to its left.
- **Why it matters:** This is the DM's prep width (laptop / tablet landscape), and the hero of the page looks broken.
- **Fix:** Give the dashboard header its own modifier class (`.sheet-header.campaign`) with `grid-template-areas: "id" "actions"` (or `"id actions"`) under the 1100px query, and delete the inline style.
- **Suggested command:** /impeccable layout

**[P1] Prep-work deletions are one tap with no confirm, and all curated failures are silent**
- **What:** `deleteShop()` (`curated-shops.component.ts:173`), `deleteEncounter()` (`curated-encounters.component.ts:116`), `deleteList()` (`curated-loot.component.ts:106`) and note `remove()` (`campaign-notes.component.ts:91`) call the API immediately. Every `error:` branch in these four components is `console.error` only (about 25 sites). Note ✎/✕ targets measured at 18–20×16px, side by side.
- **Why it matters:** A curated encounter or loot list is an evening of DM prep. Losing it to a mis-tap with no undo, or having a save fail invisibly, is exactly the "DM can prepare once and run from it" promise failing.
- **Fix:** Reuse the delete-campaign `alertdialog` pattern (name the thing and what goes with it) for shop / encounter / loot list. For notes, use an inline "Deleted · Undo" row for about 5s rather than a modal. Route every curated `error:` through `NotificationService.notify()` with the same "Could not … ." phrasing the session panels already use. Raise `.note-del` to at least a 32px hit area with 8px separation.
- **Suggested command:** /impeccable harden

**[P1] Party Vitals Board is unreadable at phone width, and its labels break The 11px Floor Rule**
- **What:** `.board-row` has `min-width: 720px` (`styles.css:1624`). At 375px the board is 293px wide with 720px of content, so AC, both passives and conditions are off-screen behind a horizontal scroll. Even at 1024px desktop it scrolls. Condition chips are **8px** (`styles.css:1685`), column heads 9px (`:1632`), the eyebrow 10px (`:185`). The 4-up vitals strip overflows: the "Conditions" vital measures scrollWidth 105px in an 83px cell, and the label clips at the right edge.
- **Why it matters:** *The Phone Is The Table Rule* ("cramped and clipped are not" acceptable) and *The 11px Floor Rule*. The condition chip, the one thing a DM scans the board for, is the smallest text in the app.
- **Fix:** Below 640px, reflow each member into a two-line card (name + HP bar on line one; `AC 15 · PP 11 · PI 14` and the chips on line two) instead of a min-width table. Raise `.board-cond` to 11px with `--track-micro`, and the head row to 11px. Let `.vitals` go 2×2 below 480px.
- **Suggested command:** /impeccable adapt

**[P2] Prep and status fused into one undifferentiated scroll**
- **What:** Status (vitals, board, treasury) and authoring (shops, encounters, loot, notes, week) are seven stacked equal-weight blocks. The only signal that the curated cards are DM tools is a 10px "DM · SHOPS" eyebrow, which is redundant because the whole page is DM-only.
- **Why it matters:** PRODUCT.md principle 3. Finding the encounter list means scrolling past the treasury every time.
- **Fix:** Within the existing layout, group into two labelled regions, "The Table" (vitals, board, treasury) and "Preparation" (encounters, loot, shops, notes, week), with a sticky in-page jump row of 3–5 Cinzel tabs at the top of Preparation. Order Preparation by session-time use: encounters, loot, shops, then notes and week.
- **Suggested command:** /impeccable distill

## Persona red flags

- **DM mid-combat** (returns here between rounds on a phone): the board's AC / passives / conditions are horizontally scrolled out of view, and condition chips are 8px. The "Conditions 1" vital counts "raging" as a crimson alarm. "↻ Refresh party" is the only way to see a new join without leaving the tab.
- **Casey (distracted mobile):** the delete-campaign trash button wraps to its own row, isolated at 34×44px. Note ✕ is 18×16px next to ✎. Every `title=` explanation (Refresh, invite chip, clock chip, exhaustion chip) is invisible on touch.
- **Sam (accessibility):** curated `li.shop-row` is click-only (known backlog in a11y-notes, "List rows with nested interactive content"). Manage Party toggles are labelled "Toggle <name>" without saying what toggles. The `.toggle` is 24px tall. The trash icon button gets its name only from `title`. That name changes when the button is disabled ("A session is live — …"), which is fine, but an explicit `aria-label` is more robust.
- **Jordan (first-timer DM):** "Pass. Perc", "Pass. Ins" and "party tier" (the caption under Avg Level, which shows a level, not a tier) have no gloss. The Campaign Week panel says "Free-text weekdays — repetition counts weeks", which is opaque on first read.

## Minor observations

- The Manage Party modal hard-codes `style="border-color: var(--celestial)"` and a celestial title. That is fine, but `.modal` also carries `var(--glow-gold)` at rest (`styles.css:1170`), so a celestial-bordered modal glows gold, which breaks *The Glow Is State Rule*.
- `party-board.component.html:46-48`: the `@if` inside the `<span>` produces "42/52 +4" with no label. "+4 temp" would be clearer.
- Treasury lists first names only ("Lyra", "Throk"), while the board uses full names.
- In candlelit the board's horizontal scrollbar is the unthemed white OS scrollbar. Only `.main`/`.sidebar` scrollbars are styled.
- Many inline `style=` attributes (`campaign-dashboard.component.html:90, 97-124`; `party-board:4`) duplicate the Newsreader-italic-dim caption that `.vital-caption`-style classes already express.
- "Loading curated shops…" placeholders stay forever if the viewport trigger never fires. There is no `@loading`/`@error` block.

## Questions to consider

1. If the board already shows each hero's HP, AC, passives and conditions, does the 4-up vitals strip above it earn its space, or is it a desktop-era hero banner that could shrink to one line of chips?
2. Should the curated editors live on this page at all, or in a "Preparation" view reached from the campaign row, leaving the dashboard as the DM's at-a-glance "table" view?
3. What would it take for "Start Session" to *carry* the prep: pre-select tonight's encounter and loot list so the DM confirms rather than hunts once play begins?
