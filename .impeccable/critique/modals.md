Method: dual-agent, partial (A: isolated design-review sub-agent · B: detector + measured browser evidence gathered in the parent, recorded in `.impeccable/surfaces/modals.md`).

> **Status:** this file is Assessment A (design review) as written by its isolated reviewer. The woven A+B synthesis and the cross-surface ranking were not completed in this session (usage limit). Read it alongside the audit in `.impeccable/surfaces/modals.md`, which already folds in the verified A findings. Parent verification: the DM-notes finding is **latent** (nothing writes `PC.notes` today), so P1 not P0; the reduced-motion claim is partly wrong (2 component files handle it); the wizard modifier bug and login double-submit are confirmed in source.

# Assessment A — Modals (family)

Looked at, live at 375×812 in the browser pane, each opened and then closed without committing:
- **Create campaign** (DM), in midnight and vellum.
- **Join campaign** (player).
- **Delete character** (opened on Lyra, then Reconsider).
- **Dice roller**: d20+d6 thrown, closed with Escape.
- **Level-up**: DM on Lyra (Bard 7→8, ASI level with spell picker), closed with Escape.
- **DM edit number**: current HP, closed with Escape.
- **Item composer**: inventory "+ Grant item" in demo mode, then Cancel.
- **Spell picker**: seen embedded in level-up.

Escape was tested on create-campaign, dice, level-up and DM edit. Focus landing was measured on every one. Source read for all eight plus the global `.modal` / `.btn` rules in `src/styles.css`. Role was flipped player↔DM through `tm_role` and restored to `dm`. Theme restored to midnight.

## Design specificity verdict

**The small modals are authored. The family is not one family.** The global `.modal` chrome (`styles.css:1155-1199`) is specific and good: a gold hairline frame with an inset 6px "plate" line, Cinzel uppercase titles, and an italic Newsreader sub-line in the in-world voice. Delete character is the best expression of the product anywhere in this set. "Strike From The Record … nor their bones recovered. This cannot be undone." / **Reconsider** / **Erase Forever**, a crimson frame, and focus landing on Reconsider. Nobody else's app says that.

But the family speaks **three dialects**:
1. **Global `.modal`** (create/join campaign, delete, DM edit, dice): Cinzel 11px tracked labels, 2px corners, `.btn` / `.btn.primary`.
2. **Level-up**: buttons fall back to **Arial** (`.milestone-tab`, `.asi-step` never set a font). Cards have **6–8px radii** (`level-up-modal.component.scss:30,75,123,165,199,236,298`). Text is rem-based Newsreader at 9.9–13px. The committing "Level Up" is a plain outlined button restyled inline with celestial (`level-up-modal.component.html:211-212`), not `.btn.primary`. And 24 `rgba(255,255,255,…)` fallbacks.
3. **Item composer** (inline rather than modal, but the same "author something and confirm" job): 12px Newsreader buttons at 24px tall, **primary first and Cancel second** (`item-composer.component.html:44-47`), the reverse of every `.modal-actions` row. A lone "Custom" tab in demo mode.

Frame colour carries meaning inconsistently. Gold means generic (wizard, delete's glow). Celestial means DM-ish (campaign, join, DM edit, level-up). Crimson means destructive. But **every** frame also carries the standing gold glow from `.modal { box-shadow: …, var(--glow-gold) }` (`styles.css:1170`, re-declared in `create-campaign-modal.component.scss:26-30`). So the crimson delete dialog and the celestial dialogs all glow gold at rest. That breaks **The One Standing Glow** ("A second standing glow is a bug"), and since the modal's primary button glows too, there are two gold glows in one dialog.

## Heuristic scores

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Disabled "Save", "Answer the Call", "Inscribe" and "Roll" are visually identical to enabled (no `.btn:disabled` rule). Good: level-up shows "Consulting the chronicle…", and the dice result is a big gold total. |
| 2 | Match System / Real World | 3 | Excellent in-world verbs ("Cast the Bones", "Ascend a Level", "Not Yet", "Answer the Call"). Off notes: DM edit asks for an absolute HP rather than damage/heal, and its log field says "leave blank for the automatic one" while already pre-filled with it. |
| 3 | User Control and Freedom | 2 | Escape works on dice, level-up and DM edit (input-scoped) only. Create/join campaign and delete ignore it (already a known a11y-notes item). On phone the app header and hamburger sit **above** the backdrop for main-content and sheet modals (delete, dice, level-up, DM edit), so the drawer opens over a live modal. |
| 4 | Consistency and Standards | 1 | Three dialects (above). The close affordance varies: × top-left (dice) vs bottom Cancel / Reconsider / Not Yet (others). Action order varies: Cancel-left (modals) vs Add-left (composer). The commit is `.btn.primary` everywhere except level-up. |
| 5 | Error Prevention | 3 | Delete focuses Reconsider. The join consent gate explains that slot conversion is irreversible. DM edit Save is gated on a change. Gap: create campaign's three "can't be changed later" checkboxes commit with one tap and no summary, and level-up "Roll" commits an unseen HP roll. |
| 6 | Recognition Rather Than Recall | 3 | Level-up shows every before→after (HP +7 → max 59, L4 slots 1→2, prof +3 unchanged). DM edit pre-fills the current value. |
| 7 | Flexibility and Efficiency | 2 | DM edit: Enter saves, Escape cancels. Dice: tap or drag, Enter/Space rolls. But the dice roller has no modifier input, so it cannot roll "d20 + 7", the most common roll at the table. |
| 8 | Aesthetic and Minimalist Design | 2 | Delete and join are spare and elegant. Create campaign at 375 is a long wall of italic help under three ALL-CAPS checkboxes and a clipped 5-up hue row. The level-up card grid looks like a different app. |
| 9 | Error Recovery | 2 | Join and level-up show the error in crimson italic beneath the form (colour plus position, but no icon or `role="alert"`). The composer gives no validation messages, only a disabled Add. |
| 10 | Help and Documentation | 3 | Each variant checkbox carries a plain-language consequence. The level-up notes explain the AVERAGE/ROLL maths. Dice copy explains the gesture. |
| **Total** | | **23/40** | **Acceptable** |

## Cognitive load

**4 of 8 failed (high, but driven by two modals).**
- **Chunking: fail.** Level-up on an ASI level at 375px is HP method + Ability-vs-Feat + 6 steppers + a 40+ row spell list + new features, in one scrolling dialog. That is about 1,260px of content in a 713px box.
- **One thing at a time: fail.** In level-up, you allocate ASI points while the spell list competes beneath, inside the same scroll.
- **Working memory: fail.** DM edit "Edit current HP" makes the DM do 42 − 9 in their head mid-combat, then type the result.
- **Progressive disclosure: fail.** Create campaign shows all three Darker Dungeons variants, the week editor and four date fields up front. Most tables want only "name + Inscribe".
- Passes: single focus (modal), grouping, minimal choices on delete/join/DM edit, and the visual hierarchy of the small modals.

Decision points with more than 4 visible options: dice palette (7 die types, a known domain set, acceptable); create-campaign Banner Hue (5); level-up ASI (6 abilities × −/+) and spell picker (40+); composer Custom category (5).

## Emotional journey

- **Peak:** the dice throw. The cluster flies, lands, and a 38px gold "8 / TOTAL" sits over a per-die breakdown. Tactile and fun. Second peak: delete's "Erase Forever" copy, which makes a destructive moment feel ceremonial instead of scary.
- **Valley 1:** level-up on phone. A long scroll, an Arial toggle, a nested 220px spell list inside a scrolling modal, and the decorative inner frame's bottom line cutting across the ASI rows mid-scroll. "Ascending a level" should feel like the best moment of a campaign. Here it feels like a settings form.
- **Valley 2:** DM edit on HP. A number field and a pre-filled "DM changed current HP 42 → 42" log line, while the table waits.
- **High-stakes reassurance:** strong on delete and join-consent. Weak on level-up "Roll", which shows only the average and says "rolled on confirm". The player commits without seeing the dice they care most about. Weak on create campaign, where three permanent variant switches look like ordinary checkboxes.

## What's working

1. **Delete character is the model for the family.** `role="alertdialog"`, crimson frame, focus on the safe "Reconsider", the character named in full ("Lyra Moonwhisper, Half-Elf Bard of level 7"), and "This cannot be undone" stated plainly within the in-world voice (`delete-confirmation-modal.component.html:1-19`).
2. **Level-up shows consequences as before→after.** HP gain with the formula, proficiency unchanged, "L4 1→2" slot pips highlighted, and "Raising Constitution will increase your hit points further." Everything a player needs to trust the change is on screen, which is excellent Recognition.
3. **The dice roller has real keyboard and touch parity.** The cluster is a `role="button"` that rolls on tap, Enter or Space, plus a fallback Roll button. It is `max-height: calc(100dvh - 24px)` with a sticky close so the exit is always reachable (`dice-roller-modal.component.scss:24,30-36`). It fits 375px cleanly.

## Priority issues

**[P1] Disabled primary actions look enabled across every modal**
- **What:** `.btn` / `.btn.primary` (`styles.css:413-456`) have no `:disabled` rule. Measured live: DM edit "Save" (disabled), "Answer the Call" (no code), "Inscribe" (no campaign name) and the dice "Roll" (empty field) all render with opacity 1, `cursor: pointer`, full gradient and standing glow.
- **Why it matters:** The gate is the only validation feedback these modals give, and nobody can see it. A DM taps Save, nothing happens, and they tap again.
- **Fix:** One global rule: `.btn:disabled { opacity:.45; cursor:not-allowed; box-shadow:none; } .btn:disabled:hover { color: inherit; border-color: var(--border); }`. The composer already does this (opacity .45). Promote it to the system.
- **Suggested command:** /impeccable polish

**[P1] Level-up is a separate design dialect and drops focus behind the modal**
- **What:** (a) Arial buttons, 6–8px radii, a 9.9px `.slot-lvl` (0.62rem, `level-up-modal.component.scss:86`), and the commit button is an inline-styled outline rather than `.btn.primary` (`level-up-modal.component.html:211-212`). (b) On open, `cdkTrapFocusAutoCapture` runs while only "Consulting the chronicle…" is rendered (no tabbable element), so focus stayed on the sidenav ("TABLE MIMIC…") behind the dialog. (c) The global `.modal::before` inset frame scrolls with the content, and its bottom line crosses the ASI rows mid-scroll. That is the exact bug `create-campaign-modal.component.scss:14-30` already fixed locally. (d) A 220px nested `.spell-list` scroll sits inside the 88vh scrolling modal.
- **Why it matters:** This is the biggest "your character grew" moment in the product, and it looks borrowed from another app. Keyboard and screen-reader users start outside the dialog. It breaks **The 11px Floor Rule**, the **near-sharp corner rule** (Shapes), and **The Panel Owns Its Scroll Rule** (scroll-in-scroll).
- **Fix:** Give `.milestone-tab` / `.asi-step` `font-family: inherit` plus the Cinzel label treatment. Set radii to 2–3px. Use `.btn.primary` for "Level Up" (celestial frame if wanted, gold commit). Render a focusable Close in the loading state, or call `focusInitialElement()` once the preview resolves. Lift the create-campaign inset-box-shadow frame into the global `.modal` (or the level-up host). Let the spell list grow and scroll with the modal instead of capping it at 220px.
- **Suggested command:** /impeccable typeset (then /impeccable layout for the scroll and frame)

**[P1] On phone, the app header sits above main-content and sheet modals**
- **What:** For modals rendered inside `main-content` and `character-sheet` (delete, dice, level-up, DM edit), the mobile top bar stays sharp and tappable above the blurred backdrop. `elementFromPoint` on the hamburger returned the hamburger SVG while the delete dialog was open. App-level modals (create/join campaign, wizard) do cover it. The level-up modal's top edge also sits under the header (`top: 48.7px` against a 77px bar).
- **Why it matters:** A player can open the drawer and switch hero while a destructive dialog is open over the previous hero. It is also visibly inconsistent: two stacking behaviours for one component.
- **Fix:** Render the main-content and sheet modals at the app level (portal to a host like the create/join modals, or use CDK Overlay), or give `.modal-backdrop` a z-index above the mobile header's. Then the backdrop's `align-items: center` plus `max-height` keeps every modal clear of the bar.
- **Suggested command:** /impeccable layout

**[P2] DM edit forces mental maths and contradicts its own hint**
- **What:** `dm-edit-modal.component.html:4-29`: "Edit current HP" takes an absolute value in a `type="number"` with no `inputmode`. The log textarea is labelled "leave blank for the automatic one" but is pre-filled with that automatic text ("DM changed current HP 42 → 42", from `dm-edit-modal.component.ts:47,79`).
- **Why it matters:** "DM mid-combat" hears "I take 9" and must compute 42 − 9 while talking. The pre-fill also writes a "42 → 42" no-op line if the DM edits the description first.
- **Fix:** For HP-like fields add a `−N / +N` delta mode (two quick buttons, Damage and Heal, plus the number), shown first. Keep "Set to" as the secondary. Make the auto-text the textarea's *placeholder*, not its value. Add `inputmode="numeric"`.
- **Suggested command:** /impeccable clarify

**[P2] Create campaign at 375: clipped hue row, illegible date fields, permanent switches that look casual**
- **What:** The Banner Hue `repeat(5,1fr)` grid (`create-campaign-modal.component.html:19`) clips "Emerald" past the modal edge (measured right edge 375 against the modal's 360). The 4-up start-date grid (`:72`) truncates its placeholder-labels to "Day · e / Montl / Year · / Week". The labels are not associated with inputs (no `for` / `id`; Campaign Name and Setting have no accessible name). The three irreversible variant toggles are plain checkboxes.
- **Why it matters:** The Phone Is The Table Rule says "cramped and clipped are not" acceptable. A DM setting up on their phone cannot read what each date box is for.
- **Fix:** Hue as `repeat(auto-fit, minmax(64px,1fr))` or swatch chips. Dates as a 2×2 grid at under 480px with real visible labels. Associate every label with its input. Group the three variants under a "Table rules — permanent" fieldset with a single crimson-hairline note, and repeat the chosen variants in the Inscribe confirmation.
- **Suggested command:** /impeccable adapt

## Persona red flags

- **Casey (distracted mobile):** The dice × close is 30×30 and overlaps the "C" of "Cast the Bones" at 375. The composer buttons are 22–24px tall in Newsreader 12px. The level-up ASI −/+ are 26×26 with no labels. Level-up "Not Yet / Level Up" sit at the bottom of a 1,260px scroll. The join invite code has no `autocapitalize="characters"`, so the phone keyboard starts lower-case even though the field displays upper.
- **Sam (accessibility):** Level-up opens with focus outside the dialog (above). Create campaign: Campaign Name and Setting have no programmatic label. Composer: "Item name", "Damage" and "Armor Class" are placeholder-only (no `aria-label`). Spell-picker search has no label. The dice result has no live region, so a screen-reader user throws and hears nothing. Errors (join, level-up) are crimson text without `role="alert"`. Sub-11px text: dice "Total" 9px (`dice-roller-modal.component.scss:281`), `.btn.sm` 9px ("Clear", composer-adjacent), level-up `.slot-lvl` 9.9px. All break **The 11px Floor Rule**.
- **Jordan (first-timer):** Dice copy says "Drag dice into the field, then grab the cluster and flick it". Tapping a die also works, but that is only in a `title` tooltip that phones never show. Level-up "HP Method: Average | Roll", with Roll noting "rolled on confirm — avg shown". Jordan will not understand they are committing to an unseen roll.
- **Player between turns:** The dice roller cannot add a modifier. To roll an attack, the player rolls d20, reads "7", then adds +7 in their head. The one number they need is not the one shown. Escape-close works; on phone there is no Escape anyway, and the 30px top-left × is the only fast exit.
- **DM mid-combat:** "Edit current HP" requires subtraction and then two taps (Save is the right-hand button in the thumb zone, which is good). With the header above the backdrop, a stray thumb on the hamburger while editing HP opens the drawer over the dialog. The DM role cannot level a PC from the session without leaving to the sheet. Not this surface's fault, but felt here.

## Minor observations

- The dice colours are literal hexes (`--d4-color: #c8504f` … `--d100-color: #4fb6b0`, `dice-roller-modal.component.scss:7-13`), plus `#10131f` die text and `#171a26` / `#000` fallbacks. Fine as "physical dice", but they bypass **The Three Themes Rule**. d6 (gold) and d20 (gilt) are nearly the same colour, so the two most-used dice are hard to tell apart on the shelf.
- Inline styles carry the theming in four templates (`style="border-color: var(--celestial)"`, `style="color: var(--celestial-2)"`, `style="flex: none"`). Those belong as `.modal--celestial` / `.modal--danger` modifiers so the frame and glow can be themed in one place.
- `.btn.primary { flex: 1 }` is overridden by `style="flex: none"` on create/join, but not on DM edit, so the primary width varies dialog to dialog.
- Level-up's spell picker uses checkboxes. The wizard's spell step uses expand-then-"Add to spells". Same task, two interactions.
- The join modal error and the level-up error both reuse `.modal-sub` (italic) with an inline crimson colour. An error in italic flavour type reads as lore, not as a problem.
- The DM edit textarea is styled only inside `dm-edit-modal.component.scss` because `.field` does not cover `textarea` globally. Other forms will repeat this.
- Already in `docs/a11y-notes.md` (not re-raised): Escape missing on delete / create / join, backdrop divs not focusable, toast dismissal.

## Questions to consider

- What would a single `<app-modal>` shell look like (frame tone, title, sub, body, sticky action row, close, Escape, focus) so level-up, DM edit and the composer cannot drift into their own dialects again?
- Should the dice roller know whose hands it is in? It already receives `[pc]`. Could "d20 + Perception" be one tap, so the player-between-turns gets the final number instead of a raw die?
- If levelling up is the emotional high point of a campaign, why is it the plainest-looking modal in the app, and what would a confident, ceremonial version look like within the Astral Chart?
