# Theme Contrast Audit — all three themes

Audit only. **No code was changed by this document.** Run 2026-11-07, prompted by the discovery
in `docs/impeccable-adoption-plan.md` §8 that `--text-dim` fails WCAG AA on the lighter themes.

Scope: every colour token in `src/styles.css`, against every surface token, in `midnight`,
`vellum` and `candlelit`.

---

## Headline

`--text-dim` is the app's **most-used text token — 128 usages, more than `--text` itself (80)** —
and it fails WCAG AA on **every background in two of the three themes**. It is not alone: four
other tokens fail somewhere.

The problem is invisible to per-page scanning because the detector only ever renders the default
`midnight` theme, which is the one theme where `--text-dim` passes.

---

## 1. Token matrix (definitive)

Computed directly from the declared token values in `src/styles.css`. This is pure arithmetic on
the stylesheet — no rendering, no compositing, so there is nothing here to second-guess. Values
are contrast ratios; `!` marks below the 4.5:1 AA threshold for normal body text.

### midnight

| fg \ bg | --bg | --bg-2 | --surface | --surface-2 | --surface-3 |
|---|---|---|---|---|---|
| `--text` | 15.33 | 14.55 | 13.50 | 12.12 | 10.54 |
| `--text-2` | 9.25 | 8.78 | 8.15 | 7.32 | 6.36 |
| `--text-dim` | 6.65 | 6.31 | 5.86 | 5.26 | 4.57 |
| `--gold` | 9.54 | 9.05 | 8.40 | 7.54 | 6.56 |
| `--celestial` | 9.46 | 8.98 | 8.34 | 7.48 | 6.51 |
| **`--crimson`** | **!4.40** | **!4.18** | **!3.88** | **!3.48** | **!3.03** |
| `--emerald` | 7.02 | 6.66 | 6.18 | 5.55 | 4.83 |
| `--violet` | 6.45 | 6.12 | 5.68 | 5.10 | **!4.44** |

### vellum

| fg \ bg | --bg | --bg-2 | --surface | --surface-2 | --surface-3 |
|---|---|---|---|---|---|
| `--text` | 12.27 | 10.98 | 13.22 | 11.20 | 9.51 |
| `--text-2` | 6.63 | 5.93 | 7.14 | 6.05 | 5.14 |
| **`--text-dim`** | **!3.33** | **!2.98** | **!3.59** | **!3.04** | **!2.58** |
| **`--gold`** | **!4.39** | **!3.93** | 4.73 | **!4.01** | **!3.41** |
| `--gold-2` | 6.12 | 5.48 | 6.60 | 5.59 | 4.75 |
| `--celestial` | 6.66 | 5.96 | 7.17 | 6.07 | 5.16 |
| `--crimson` | 6.66 | 5.96 | 7.18 | 6.08 | 5.17 |
| **`--emerald`** | 4.93 | **!4.41** | 5.31 | 4.50 | **!3.82** |
| `--violet` | 6.76 | 6.05 | 7.28 | 6.17 | 5.24 |

### candlelit

| fg \ bg | --bg | --bg-2 | --surface | --surface-2 | --surface-3 |
|---|---|---|---|---|---|
| `--text` | 13.76 | 12.98 | 11.98 | 10.54 | 8.84 |
| `--text-2` | 8.25 | 7.78 | 7.19 | 6.32 | 5.30 |
| **`--text-dim`** | **!3.72** | **!3.51** | **!3.24** | **!2.85** | **!2.39** |
| `--gold` | 10.10 | 9.53 | 8.80 | 7.74 | 6.49 |
| `--celestial` | 8.57 | 8.09 | 7.47 | 6.57 | 5.51 |
| **`--crimson`** | 5.28 | 4.98 | 4.60 | **!4.04** | **!3.39** |
| `--emerald` | 6.89 | 6.50 | 6.00 | 5.28 | **!4.42** |
| `--violet` | 7.25 | 6.84 | 6.31 | 5.55 | 4.66 |

### Totals

**26 of 135 token/background/theme combinations fail AA.**

| Token | Usages | Failing combos | Concentrated in |
|---|---|---|---|
| `--text-dim` | **128** | **10 / 15** | all of vellum, all of candlelit |
| `--crimson` | 43 | **7 / 15** | all of midnight, 2 in candlelit |
| `--gold` | **126** | 4 / 15 | vellum |
| `--emerald` | 7 | 4 / 15 | vellum, candlelit |
| `--violet` | 7 | 1 / 15 | midnight (`--surface-3` only) |

Two of these matter far more than the others, because of usage volume:

- **`--text-dim` (128 usages)** fails in 10 of 15 combinations. Nothing that uses it is reliably
  legible outside midnight.
- **`--crimson` (43 usages)** fails on *every* midnight background — and midnight is the default
  theme. Crimson almost certainly carries damage, errors and destructive actions, so this is the
  most consequential failure per-instance even though the token is used less.

---

## 2. Live DOM check

Checked the character-manager roster in all three themes in a real browser.

- **midnight: 0 failures** on measurable text.
- **vellum: `--text-dim` text measured at 3.33:1** (`.brand-sub`, `.roster-meta`, `.empty-sub`).
- **candlelit: `--text-dim` text measured at 3.72:1** (same elements).

Those measured values match the matrix predictions, which is the corroboration this audit needed.

### What the live check could *not* establish

**18 of ~21 text nodes on that screen sit over a gradient** — the `body` carries two
`radial-gradient` washes and `.btn.primary` is a `linear-gradient`. `getComputedStyle` reports
`backgroundColor` only, so per-element contrast for those is not computable from the DOM. A
rendering-based tool that samples real pixels is required for a true per-element verdict.

**A finding was raised and then retracted during this audit.** An early pass reported three
elements (`.btn`, `.btn.primary`) whose text colour appeared frozen at midnight's values across
all three themes, which would have meant hardcoded hexes. Direct inspection disproved it: the
rules use `var(--text-2)` and `var(--gold-2)`, and with vellum active the button resolves to
`#6e4a1a`, vellum's own `--gold-2`. The "frozen" reading was an artifact of reading computed
styles in the same pass that mutated `data-theme`. **There is no hardcoded-colour leak on this
screen.** Recorded here so the claim is not resurrected from a stale note.

### Coverage limit

Demo mode (the "Enter in Demo Mode" button) **does** get past auth and reaches
`/charactermanager` with a seeded roster — this solves the blocker recorded in the adoption plan
§8 correction #4, but **only for a human or a driven browser, not for `npx impeccable detect`**,
which launches a clean browser with no session. Dense surfaces (character sheet, session mode,
the wizard) were not reached: the demo roster renders in the sidebar but the main pane was in its
empty state.

---

## 3. Recommended token values

Hue-preserving: each is the original colour moved toward black or white until it clears 4.5:1 on
**all five** surfaces of its theme. Shifts are modest (11–34%), so the Arcane palette survives.

| Token | Theme | Current | Worst now | Suggested | Worst after | Shift |
|---|---|---|---|---|---|---|
| `--text-dim` | vellum | `#8a7850` | 2.58 | `#5f5337` | 4.54 | 31% toward black |
| `--text-dim` | candlelit | `#8a6a40` | 2.39 | `#b29d81` | 4.55 | 34% toward white |
| `--crimson` | midnight | `#c8504f` | 3.03 | `#d67c7b` | 4.51 | 25% toward white |
| `--gold` | vellum | `#8a5e22` | 3.41 | `#714d1c` | 4.54 | 18% toward black |
| `--emerald` | vellum | `#3a6a3a` | 3.82 | `#345e34` | 4.51 | 11% toward black |

`--violet` on midnight `--surface-3` (4.44) is a near-miss and can ride along with whichever pass
touches these.

### Caveats before applying any of this

1. **These values are deliberately conservative.** They are solved against the *worst* surface in
   each theme, so most usages get more headroom than they need. If a token is only ever used on
   `--bg`, a gentler shift would do.
2. **Large text only needs 3:1.** `--gold` is likely carrying Cinzel display headings, where
   vellum's current 3.41–4.73 may already be fine. Changing `--gold` globally would darken 126
   usages to fix a subset — **check what it is actually used on before touching it.** This is the
   one recommendation here that should not be applied blind.
3. **`--crimson` on midnight is the strongest case for acting.** It fails on all five surfaces of
   the default theme, and the semantics (errors, damage) make low contrast worst there.
4. Non-text uses (borders, icons, dividers) need only 3:1, and decorative use has no requirement.
   The usage counts in this document do not separate text from non-text.

---

## 4. Status

| Item | State |
|---|---|
| `--crimson` midnight + candlelit | **Fixed** on `fix/crimson-token-contrast` (#d67c7b / #e1896d). Verified in-browser: worst surface 4.51 / 4.53. Token-level failures 26 -> 19. |
| `--text-dim` vellum + candlelit | **Fixed** on `fix/text-ramp-contrast`. Required re-spacing `--text-2` too — see note below. |
| `--gold` vellum | Open — needs usage classification first (see caveat 2) |
| `--emerald` vellum + candlelit | Open — 4/15, only 7 usages |
| `--violet` midnight `--surface-3` | Open — near-miss at 4.44 |

> **The `--text-dim` fix could not be made in isolation.** Darkening vellum's
> `--text-dim` far enough to clear AA on all five surfaces put it at 1.14 separation
> from `--text-2` — two tiers rendering as one, which would have made `--text-dim`
> meaningless across its 124 `color:` usages. Both ramps were therefore re-spaced:
>
> - vellum: `#2a2114` -> `#463b27` -> `#605338` (separations 1.44 / 1.46)
> - candlelit: `#f0dcb4` -> `#cfbb99` -> `#b29d81` (separations 1.39 / 1.40)
>
> This widened the change to `--text-2` (22 usages, 20 of them `color:`). Separations
> are tighter than the originals (1.85/1.99 vellum, 1.67/2.22 candlelit) but well clear
> of the ~1.2 point where tiers stop reading as distinct. Midnight was already passing
> and is untouched.
>
> **Combined with `fix/crimson-token-contrast`: 26 -> 9 failing combinations.** The two
> branches merge without conflict. Remaining: `--gold` 4, `--emerald` 4, `--violet` 1.

---

## 5. Suggested next step

Not a global find-and-replace. In order:

1. ~~Fix `--crimson` on midnight~~ — done, see Status above.
2. ~~Fix `--text-dim` on vellum and candlelit~~ — done, see Status above.
3. Classify `--gold`'s 126 usages into text vs display vs decorative *before* deciding.
4. Re-measure with the matrix script, then re-run the detector on midnight as a regression check.

This belongs with the Phase 1 token work in `docs/impeccable-adoption-plan.md`, not as a
standalone sweep — the same pass should introduce the missing spacing and type scales.
