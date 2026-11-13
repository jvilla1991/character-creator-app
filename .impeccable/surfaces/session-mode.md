# Audit — Session mode

Target: `src/app/charactermanager/components/session-mode/` (shell, initiative-panel,
encounter-loader, loot-panel, shop-panel, roll-log-panel, spell-carousel, rest-vote-modal) and the
`.board-*` rules in `src/styles.css`. Measured as DM on "The Veiled Compass" with a running
encounter, at 375×812 in all three themes. Method: [README](README.md). Demo mode returns
`demoUnsupported()` for opening shop / loot pools, so their open/claim states are source-only.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1 | Whose-turn names 1.16–1.27:1 in vellum; active segment 1.6:1 in every theme; turn changes never announced |
| 2 | Performance | 3 | Infinite vignette pulse with no reduced-motion path; 2s polling is by design |
| 3 | Theming | 1 | 51 white-alpha literals; `--muted` / `--bg-elev` undefined; turn colours are literals |
| 4 | Responsive Design | 1 | Initiative board `min-width: 720px` — AC, conditions and Adjust off-screen at 375px |
| 5 | Implementation Integrity | 3 | Coherent and specific; glows here are state, as the system intends |
| **Total** | | **9/20** | **Poor (major overhaul)** |

## Implementation Integrity Verdict

**Pass on intent, fail on execution in two themes.** This is the most product-specific screen in
the app — a turn board with a living green/gold cue, a DM-scoped enemy visibility switch, an
award-XP-to-all action. Glow is used correctly here as *state* (the current turn), which is exactly
what The Glow Is State Rule allows. But the turn colours are literals (`#7fe0ae`, `#f0d391`,
`rgba(76,175,125,…)`) rather than `--emerald`/`--gold`, so the screen's single most important
signal disappears in vellum.

## Executive Summary

- **9/20 — Poor.** P0: 1 · P1: 5 · P2: 3 · P3: 1
- Top issues:
  1. **[P0] Vellum: the current-turn and on-deck names are invisible** (1.16–1.27:1).
  2. **[P1] Initiative board does not fit a phone** (`min-width: 720px`).
  3. **[P1] Active segment buttons at ~1.6:1 in all three themes** (shop and loot).
  4. **[P1] Shop/loot/encounter forms: `--muted` → 60 % white**, 1.16:1 in vellum.
  5. **[P1] Turn changes are not announced** to assistive tech.
- Next: token sweep (slice 1) clears 1, 3, 4; responsive pass (slice 3) owns 2.

## Detailed Findings by Severity

**[P0] Whose turn it is cannot be read in vellum**
- **Location:** `session-mode/initiative-panel/initiative-panel.component.scss:6-32` — current-turn
  `color: #7fe0ae`, on-deck `color: #f0d391`, plus literal green/gold `rgba` glows.
- **Category:** Theming / Accessibility
- **Impact:** measured in-browser: current-turn hero name and AC **1.16:1**, on-deck **1.27:1**
  (the session reviewer measured 1.13–1.24 independently). On parchment the pale mint and pale gold
  vanish. "Whose turn is it?" is the question the whole session surface exists to answer
  (PRODUCT.md principle 1). Rated P0 because, for a player using vellum, the session's core task
  fails.
- **WCAG:** 1.4.3
- **Recommendation:** drive both states from `--emerald` / `--gold` (text) and
  `color-mix(in oklch, var(--emerald) 20%, transparent)` (wash), so each theme's AA-verified value
  is used. Keep the glow — it is state.
- **Suggested command:** `/impeccable colorize`

**[P1] Initiative board is a 720px table on a 375px phone**
- **Location:** `src/styles.css:1616-1624` — `.board-row { grid-template-columns: minmax(160px,1.7fr) 150px 56px 64px 64px minmax(120px,1.3fr) 16px; min-width: 720px; }`
- **Category:** Responsive
- **Impact:** the board scrolls sideways inside its panel (so the page-level overflow check reads
  0). At 375px AC, Conditions and the DM's Adjust column are off-screen; hero names truncate to
  ~98px. The add-enemy form also does not wrap.
- **Standard:** DESIGN.md **The Phone Is The Table Rule** ("dense is acceptable, cramped and
  clipped are not").
- **Recommendation:** below 560px, collapse each row to a two-line card: name + HP bar on line 1,
  init / AC / conditions on line 2, Adjust behind a per-row disclosure.
- **Suggested command:** `/impeccable adapt`

**[P1] Selected segment is unreadable in every theme**
- **Location:** `session-mode/shop-panel/shop-panel.component.scss:49`, `loot-panel.component.scss:54` —
  `.seg-btn.active { color: var(--text); background: var(--celestial, rgba(120,170,255,0.18)); }`
- **Category:** Accessibility / Theming
- **Impact:** the fallback was meant as an 18 % tint, but `--celestial` *is* defined (solid
  starlight), so the active segment is light text on a solid light fill: **1.62 midnight, 1.84
  vellum, 1.60 candlelit**. The detector independently reports `low-contrast 1.6:1 — #ece3cc on
  #8fb4ff`.
- **Recommendation:** `background: color-mix(in oklch, var(--celestial) 18%, transparent)`;
  selected text `var(--celestial-2)`; add `aria-pressed`.
- **Suggested command:** `/impeccable colorize`

**[P1] Session forms vanish in vellum (`--muted`)**
- **Location:** `shop-panel`, `loot-panel`, `encounter-loader` `.scss` — `var(--muted, rgba(255,255,255,0.6))`
  (×12 across the three), `var(--bg-elev, rgba(255,255,255,0.04))` ×12 (9 in initiative-panel).
- **Category:** Theming
- **Impact:** field labels ("Shop source", "What does it sell?", "Loot source"), inactive segments
  and empty-state copy measure **1.16:1** in vellum.
- **Recommendation:** `--muted` → `--text-dim`; `--bg-elev` → `--surface-2`.
- **Suggested command:** `/impeccable colorize`

**[P1] Turn changes are silent to assistive tech**
- **Location:** `initiative-panel.component.html` — no `aria-current` on the active row, no live
  region for "X's turn".
- **Category:** Accessibility — WCAG 4.1.3 Status Messages
- **Recommendation:** `aria-current="true"` on the active row; a visually-hidden
  `role="status"` line "Throk Ironjaw's turn — Lyra on deck" that updates on advance.
- **Suggested command:** `/impeccable harden`

**[P1] Sub-11px combat labels; sub-24px inspiration pips**
- **Location:** `span.board-cond` / `.slot-chip` **8px** ×6, `span.num` 9px ×3, board column headers
  9px; `button.insp-pip` 19×19 ×10, enemy-visibility / turn-sound `select` 23px tall. 21 of 33
  controls under 44px.
- **Category:** Accessibility / Responsive
- **Standard:** **The 11px Floor Rule**; WCAG 2.5.8
- **Suggested command:** `/impeccable typeset`, `/impeccable adapt`

**[P2] Infinite vignette pulse with no reduced-motion path**
- **Location:** `session-mode/session-mode.component.scss:23` — `vignette-pulse-green 2.4s infinite`
- **Category:** Performance / Accessibility (motion)
- **Impact:** DESIGN.md says `prefers-reduced-motion` is honoured; only
  `conditions-panel` and `dice-roller-modal` actually handle it. The turn cue currently *lives in*
  the animation, so a blanket `animation: none` would delete the signal.
- **Recommendation:** under reduced motion, show the turn state as a static tint + border.
- **Suggested command:** `/impeccable animate`

**[P2] Session forms off-system** — 12px corners, white-alpha borders, small buttons falling back to
the UA font. → `/impeccable polish`

**[P2] Unnamed `select` in the encounter loader** (`select.select` has no label). → `/impeccable harden`

**[P3] Rest-vote countdown announces every second** (`rest-vote-modal.component.html:38`,
`aria-live` on a ticking number). Announce at start and at 10s / 0s instead. → `/impeccable harden`

## Patterns & Systemic Issues

- Session mode carries **51 of the app's 192 white-alpha literals** — the most of any surface.
- Prep forms (shop, loot, encounter loader) live inside the live screen — a structural issue the
  critique covers (PRODUCT.md principle 3).

## Positive Findings

- **Midnight and candlelit: 0 definite failures** on the initiative board.
- Inspiration pips have specific, useful labels ("Set Lyra Moonwhisper inspiration to 3 of 5").
- The DM-only enemy-visibility control is explicit and well-named — the visibility rule is designed in.
- Rest vote uses `role="status"` correctly for its banner.

## Recommended Actions

1. **[P0] `/impeccable colorize`** — turn colours, `.seg-btn.active`, `--muted`, `--bg-elev`.
2. **[P1] `/impeccable adapt`** — phone layout for the initiative board and add-enemy form.
3. **[P1] `/impeccable harden`** — `aria-current`, turn live region, select label, countdown cadence.
4. **[P1] `/impeccable typeset`** — 8–9px chips and headers.
5. **[P2] `/impeccable animate`** — reduced-motion turn cue.
6. **`/impeccable polish`**
