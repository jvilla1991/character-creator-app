# Impeccable Adoption Plan — UI Improvement Pass

Plan for using [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`impeccable@4.8.0`,
Apache-2.0, published 2026-10-26 by `paulbakaus`, repo URL matches GitHub) to improve the
Table Mimic frontend.

> **Status: Phases 0–2 are done** (Phase 2 results and the ranked Phase 3 backlog: **§10**). Installed 2026-11-07, global scope, no hooks. Several
> predictions below were tested and some were wrong — see **§8 Phase 0 results** for what
> actually happened. Read §8 before acting on §2 or §4.

---

## 1. What impeccable actually is

It is **not** a CSS framework, a component library, or something you `npm install` into
`dependencies`. It is three separate things shipped together:

| Part | What it is | Runs where |
|---|---|---|
| **Agent skill** | 24 slash commands (`/impeccable audit`, `/impeccable harden`, …). Each loads a playbook that steers *Claude* while Claude edits our code. | Inside Claude Code, via files in `.claude/` |
| **Detector** | 62 deterministic rules — no LLM, no API key. Flags AI-slop tells plus real quality problems (cramped padding, low contrast, skipped headings). | `npx impeccable detect` |
| **Live mode** | A dev-server overlay for picking an element and hot-swapping variants. | Browser + local dev server |

Think of it as a **design vocabulary for the agent**, plus a lint tool for pixels. The skill
doesn't write CSS by itself; it changes *how Claude* writes CSS when you say "make this better."

---

## 2. What works with Angular 21 — and what doesn't

This is the part that decides the plan's shape. **Angular is not named anywhere in the
project's README.** Honest capability matrix:

| Capability | Works here? | Why |
|---|---|---|
| `detect <url>` against `localhost:4200` | Yes — **the primary path** | Scans *rendered* HTML. Framework-agnostic. The contrast / tiny-text / spacing rules **only** run on URL scans. |
| `detect <url>` against `table-mimic.villa-dev.com` | Yes | Same, against the deployed build. |
| All 24 skill commands (`audit`, `critique`, `harden`, `extract`, …) | Yes | They are prompts + playbooks. They read whatever source we have, including `.html` / `.scss`. |
| `document` / `init` / `extract` → `DESIGN.md`, `PRODUCT.md` | Yes | Plain markdown output. |
| `detect src/` (source scan) | **Mostly useless to us** | Pattern rules are documented as **JSX/TSX only**. Our 64 `.component.html` files and 51 `.scss` files will likely return little or nothing. Must be verified with `--list-rules` before relying on it. |
| CI gate (`detect --github`, `--json`) | Partial | Works, but only meaningfully against a *served URL*, which means CI has to build and serve the app first. |
| **Live mode** (`live`, `generate`) | **Assume unavailable** | Supported dev servers are listed as Vite, Next, SvelteKit, Astro, Nuxt, plain HTML. Angular CLI's `ng serve` is not listed. Worth one 15-minute spike; do not build the plan on it. |

**Conclusion:** we get the skill (the valuable half) and URL-based detection in full. We lose
live variant-swapping and source-level linting. That is fine — the skill is the part that
improves the UI.

---

## 3. What this app actually needs (measured, not guessed)

Measured on `develop`:

| Finding | Number | Why it matters |
|---|---|---|
| Design tokens in `src/styles.css` | **23, all colour** | `--bg`, `--gold`, `--celestial`, `--shadow`… |
| Spacing / radius / type-scale tokens | **0** | There is no scale. Nothing to be consistent *against*. |
| Raw `px` values across the UI | **1,949** | Every gap, pad, and font-size is a one-off decision. |
| Hard-coded hex colours bypassing the themes | **174** | vs 982 `var(--…)` uses — roughly **15 % theme drift**. |
| Themes that must stay correct | **3** (`midnight`, `vellum`, `candlelit`) | Every one of those 174 hexes is a spot where the light `vellum` theme can render unreadable. |
| Component stylesheets | **51 files, 5,185 lines** | Only one shared partial (`_wizard-shared.scss`). Heavy duplication. |
| Deferred a11y items already written down | **8** | `docs/a11y-notes.md` → "Found but deferred (needs real rework — do not lose)". |

**The single biggest structural gap is the missing scale: there are no spacing or type tokens at
all.** That is exactly what `/impeccable extract` and `/impeccable document` are built to
produce, and it is the work that makes every later pass cheap instead of ad-hoc.

### What this app does *not* need

Table Mimic already has a strong, deliberate visual identity — three hand-built themes, a
Cinzel / Newsreader / JetBrains Mono type stack, a gold-and-celestial palette ported from an
"arcane redesign" handoff. It is **not** AI slop. Impeccable's loudest selling point (catching
Inter + purple-blue gradients + cards-in-cards) mostly does not apply. Half of its 24 commands
exist to give a characterless UI a character; we already have one, and the real risk is letting
those commands sand it off.

---

## 4. The plan

### Phase 0 — Install, with guardrails (branch: `chore/impeccable-setup`)

```powershell
npx impeccable install
```

Decisions baked into this phase:

1. **Scope: global, not project.** Project scope writes the skill into the repo's `.claude/`
   and commits a vendored agent toolchain into application source. Global keeps the repo clean.
   The durable *output* (`DESIGN.md`, `PRODUCT.md`, `.impeccable/surfaces/*.md`,
   `.impeccable/critique/*.md`, `config.json`) **does** get committed — that is the asset.
2. **Telemetry off**: `npx impeccable telemetry off` (and `DO_NOT_TRACK=1`). Note the README
   states this does *not* stop the request that fetches visual directions from the
   `impeccable.style` catalog — so the tool phones home regardless. Accept it or don't install
   it; it cannot be configured away.
3. **Design hook: off for the first pass.** The hook scans every UI file the agent edits before
   it reports done. Two reasons to hold it back: it puts a downloaded binary in the loop on
   every edit, and **Claude Code command hooks run even when you deny the model's commands** —
   the escape hatch is `--settings '{"disableAllHooks": true}'`. Turn it on in Phase 4 once the
   tool has earned trust.
4. **Live mode Apply: disabled.** Set `IMPECCABLE_LIVE_COPY_AGENT=off`. Per the README, if no
   live session has polled in the last minute, Apply shells out to `claude` with
   `--permission-mode bypassPermissions` — approvals, permission checks and sandboxing all off.
   That is not acceptable unsupervised on this machine. (`=chat` keeps it in-conversation if we
   ever want it.)
5. Append the README's `# impeccable-ignore-start` block to `.gitignore` so screenshots,
   caches and runtime state stay out of git.
6. `npx impeccable doctor` — and **re-run it after any worktree move**, since Claude Code
   worktrees under `.claude/worktrees/` will stale out its context paths.
7. `npx impeccable pin audit` → gives us a bare `/audit`.

**Windows risk to watch:** the URL scan drives an installed Chrome or Edge. This machine's
Chromium sandbox is broken for Electron (see `CLAUDE.md` — Cypress needed
`ELECTRON_EXTRA_LAUNCH_ARGS` set to `--no-sandbox`). If a URL scan dies instantly with
`0x80000003` / exit `-2147483645`, that is the cause, not a bad install.

### Phase 1 — Teach it our system before it changes anything (`chore/impeccable-design-system`)

```powershell
npx impeccable detect --list-rules
```

Then, inside Claude Code:

- `/impeccable init` — writes `PRODUCT.md`: what Table Mimic is, DM vs player roles
- `/impeccable document` — writes `DESIGN.md`: codifies the Arcane system we already have
- `/impeccable extract` — pulls repeated patterns into the design system

Order matters. Running any *steer* command before `document` invites it to invent a new look.
`document` first makes the three themes, the type stack and the gold/celestial palette the
stated baseline, so later passes work *toward* it.

Concrete deliverable of this phase, beyond the markdown: **the missing scales.** A
`--space-*`, `--radius-*` and type-scale set added to `src/styles.css` alongside the existing
23 colour tokens. Without this, nothing downstream can be made consistent.

### Phase 2 — Measure, change nothing (`chore/impeccable-audit-reports`)

Serve the app:

```powershell
npm start
```

Scan the rendered page:

```powershell
npx impeccable detect http://localhost:4200 --json
```

Then `/impeccable audit` (technical, P0→P3) and `/impeccable critique` (scored UX review,
ranked by fix priority) over the **ten surfaces**, worst-first:

1. Character sheet + its 11 panels
2. Session mode (initiative, loot, shop, roll log, spell carousel, rest vote)
3. Create-character wizard (9 steps)
4. Campaign dashboard (curated encounters / loot / shops / notes)
5. Sidenav + roster
6. Login / register / reset-password
7. Modals (dice roller, level-up, item composer, spell picker, DM edit)
8. Settings panel
9. Session live banner
10. Toasts / empty states

This phase produces **reports only**, committed as `.impeccable/surfaces/*.md` and
`.impeccable/critique/*.md`. No code changes. That gives a reviewable backlog before any
pixel moves — and a baseline to measure the later passes against.

### Phase 3 — Fix, in reviewable slices

One concern per branch, Gitflow off `develop`, sequenced:

| # | Branch | Impeccable command | Scope |
|---|---|---|---|
| 1 | `chore/impeccable-token-sweep` | `colorize`, `layout` | Replace the 174 hard-coded hexes with tokens; move hot-path `px` onto the new scale. **Verify all three themes after.** |
| 2 | `fix/a11y-deferred-backlog` | `harden` | The 8 items in `docs/a11y-notes.md` — nested-interactive list rows, spellbook disclosure buttons, `appEscapeClose` on the remaining 7 modals, wizard "step N of M", toast dismiss, mobile drawer focus trap. |
| 3 | `fix/responsive-pass` | `adapt` | `body { overflow: hidden }` plus the 320px grid shell; dense panels at phone width. |
| 4 | `chore/ui-copy-clarify` | `clarify` | Labels, empty states, error copy. D&D jargon that assumes the reader already knows 5e. |
| 5 | `feature/first-run-onboarding` | `onboard` | What a brand-new DM and a brand-new player see: empty roster, no campaign, no session. |
| 6 | `chore/ui-density-polish` | `quieter`, `distill`, `polish` | Visual noise in the initiative and inventory panels; the 9-step wizard's review step. |

Each slice: branch from `develop` → change → **verify the three themes and phone width** →
commit → owner reviews and pushes.

### Phase 4 — Keep it (`chore/impeccable-ci-gate`)

- Add `npx impeccable detect --github` as a **non-blocking** annotation job at
  **pull-request** time (not deploy time), against a built-and-served app. This pairs with the
  existing need for a PR-time `npm ci` on `ubuntu-latest` — see the lockfile section of
  `CLAUDE.md`.
- Allow-list our brand fonts so the detector stops flagging them:

```powershell
npx impeccable ignores add-value overused-font Cinzel --reason "Brand display font"
```

- Turn the design hook on once trusted.
- Optional: the Chrome extension overlays the same findings on any live page — useful against
  `table-mimic.villa-dev.com` without a local server.

---

## 5. All 24 commands — the fullest-capacity map

| Command | Verdict | Note |
|---|---|---|
| `init` | **Use — Phase 1** | `PRODUCT.md` |
| `document` | **Use — Phase 1** | `DESIGN.md`; codifies Arcane. Do this first. |
| `extract` | **Use — Phase 1** | Highest-value command for this codebase. |
| `audit` | **Use — Phase 2** | P0→P3 technical report, per surface. |
| `critique` | **Use — Phase 2** | Scored UX review, per surface. |
| `harden` | **Use — slice 2** | Maps 1:1 onto the existing deferred a11y backlog. |
| `adapt` | **Use — slice 3** | Responsive. |
| `clarify` | **Use — slice 4** | Copy. |
| `onboard` | **Use — slice 5** | First-run. A genuine gap today. |
| `layout` | **Use — slice 1** | Build on the new spacing scale. |
| `typeset` | **Use, carefully** | To build the missing type scale — not to change the font stack. |
| `colorize` | **Use, narrowly** | Only to fold the 174 hexes into tokens and check `vellum`/`candlelit` parity. **Must not repaint the palette.** |
| `quieter` | **Use selectively** | Initiative and inventory panels are genuinely dense. |
| `distill` | **Use selectively** | The 9-step wizard. |
| `polish` | **Use** | The per-slice finishing move. |
| `optimize` | **Low value** | We already did OnPush, `@defer`, and dropped `@angular/animations` (−433 kB). One run to confirm, no more. |
| `shape` | **Low value** | For planning *new* surfaces; we have few. |
| `animate` | **Constrained** | CSS-only. **Must not reintroduce `@angular/animations`** — that removal was deliberate and worth 433 kB. |
| `delight` | **Selective** | Natural home is the dice roller / grab-and-throw dice. |
| `bolder` | **Mostly skip** | Identity is already strong. Possible exception: the login page. |
| `overdrive` | **Skip** | Would fight the established look. |
| `live` | **Blocked** | Angular dev server unsupported. One spike, then drop. |
| `generate` | **Blocked / optional** | Image-comp path; depends on live mode and image generation. |
| `craft` | **N/A** | Deprecated alias. |
| `doctor` | **Use** | After install, and after every worktree move. |
| `pin` | **Use** | `/audit` shortcut. |

**The spine is short:** `document` → `extract` → `audit`/`critique` →
`harden`/`adapt`/`polish`. Those six do most of the work. The nine "steer" verbs exist to give
a bland UI a personality, and ours already has one — using them freely is the main way this
goes wrong.

---

## 6. Open decisions for the owner

1. **Install scope** — global (recommended: repo stays clean) or project (only if the skill
   version should be pinned and committed for the fleet).
2. **Design hook** — off for now (recommended) or on from the start.
3. **How far visual change may go** — *codify and fix* the Arcane system (recommended), or let
   impeccable propose a restyle. These lead to very different diffs.
4. **Whether the telemetry / catalog callout is acceptable at all**, given it cannot be fully
   disabled.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Steer commands homogenise the Arcane identity | Run `document` first; keep `bolder`/`overdrive` off the table. |
| `detect src/` returns nothing for Angular templates | Verify with `--list-rules` in Phase 1; lean on URL scans. |
| Live mode doesn't attach to `ng serve` | Time-boxed spike; the plan assumes it fails. |
| Downloaded engine binary plus unavoidable catalog callout | Telemetry off, hook off initially, Apply off. Decision 4 above. |
| Chromium sandbox failure on this machine | Known cause and flag documented in `CLAUDE.md`. |
| Token sweep breaks the light `vellum` theme | Every slice verifies all three themes before commit. |
| Ten branches is a lot of ceremony | Phases 0–2 are cheap and produce a measured backlog. Re-scope Phase 3 *after* reading the audit, not now. |

---

## 8. Phase 0 results — installed and verified (2026-11-07)

### What was installed

```powershell
npx impeccable install --yes --providers=claude --scope=global --no-hooks
```

- Skill → `C:\Users\jvill\.claude\skills\impeccable\` (`SKILL.md`, `reference/`, `scripts/`)
- Engine binary → `...\scripts\bin\windows-x64\impeccable.exe`, **engine v0.1.18**
- **Four subagents** → `C:\Users\jvill\.claude\agents\`: `impeccable-asset-producer`,
  `impeccable-documenter`, `impeccable-finish-reviewer`, `impeccable-manual-edit-applier`.
  These are global, so they appear in every project's agent list, not just this repo.
- **Nothing was written into the repo.** `.impeccable/` does not exist until `/impeccable init`.

### Guardrails applied

| Guardrail | How | Verified |
|---|---|---|
| No design hook | `--no-hooks` (a real flag — the manual-copy workaround was unnecessary) | `~/.claude/settings.json` contains no hook entries; the only `*hook*` file is docs (`reference/hooks.md`) |
| Telemetry off | `npx impeccable telemetry off` | `"telemetry": false` in `C:\Users\jvill\.impeccable\config.json` |
| Live Apply | Not configured — moot while live mode is unused | — |

Note the telemetry message is narrower than the README implied: *"Rolls still work; the roll
API is told not to record them, and no choice is sent."* The callout still happens.

### Corrections to this plan

1. **The Windows / Chromium-sandbox risk did not materialise.** The URL scan launched a browser
   and completed on the first try. No `--no-sandbox` workaround needed. Phase 2 is unblocked.
2. **`detect src/` is not completely blind to Angular** — it *does* read `.scss`. But it found
   **exactly 1 finding across 51 stylesheets / 5,185 lines** (a `border-left: 2px solid
   var(--celestial)` flagged as `side-tab` in `level-up-modal.component.scss:297`). Noise-level,
   as predicted. Lean on URL scans.
3. **`doctor` and `pin` are not CLI commands.** The CLI exposes only `detect`, `ignores`,
   `help`, `install`, `link`, `update`, `check`, `telemetry`. `/impeccable doctor` and
   `/impeccable pin` are chat commands. Phase 0 items 6–7 move to Phase 1.
4. **New blocker for Phase 2: the detector can only reach the login page.** Every other surface
   is behind auth, and `detect <url>` does not log in. Scanning the other nine surfaces needs
   either a Cypress-seeded authenticated session, or the Chrome extension driven by hand in a
   logged-in browser. **This changes Phase 2's shape and must be solved before it starts.**
5. The skill ships more playbooks than the README's 24 commands: `ios.md`, `android.md`,
   `adapt.native.md`, `audit.native.md`, `component-review.md`, `visualize.md`, `region-map.md`,
   `routing.md`, `mode-read/operate/persuade.md`, plus a `degraded/` fallback set.

### The 62 rules, split

**31 slop + 31 quality.** The split lands almost exactly where §3 predicted, and it is the most
important thing learned in Phase 0:

- **Slop rules largely target the Arcane identity on purpose.** `italic-serif-display` names
  **Newsreader-italic** by name. `kicker-above-heading` is "banned outright, repeated or not" —
  that is our `.eyebrow` class. `dark-glow` describes `--glow` / `--glow-gold` exactly
  ("zero-offset chromatic halo"). `radial-halo` / `radial-spotlight-glow` describe the `body`
  background's two radial ellipses. `wide-tracking` is `.eyebrow`'s `0.22em`.
- **Quality rules are a near-perfect match for our real problems**, including four that target
  token drift directly: `design-system-font`, `design-system-color`, `design-system-radius`,
  `design-system-font-size` — i.e. the 174 hard-coded hexes and the missing scale.

**Therefore Phase 1 needs an `ignores` pass, not just a font allow-list.** Budget for it.

### First real scan — login page, `http://localhost:4200`

6 findings + 2 advisory. It divides cleanly into "leave it alone" and "genuine bug":

| Finding | Count | Verdict |
|---|---|---|
| `radial-spotlight-glow` — `#8fb4ff` a0.20 behind `login-page` | 1 | **Allow-list.** Deliberate Arcane styling. |
| `dark-glow` — zero-offset box/text-shadow `#d4b06a` | 3 | **Allow-list.** That is `--glow-gold`. |
| `undersized-ui-text` — 10px "Username" / "Password" below the 11px floor | 2 | **Real bug. Fix.** |
| `low-contrast` (advisory) — placeholder `#757575` on `#0d1224`, 4.0:1, needs 4.5:1 | 2 | **Real bug. Fix.** |

Two things worth sitting with:

- The `undersized-ui-text` rule anticipates our exact defence and rejects it: *"Being ON the
  DESIGN.md size ramp does not exempt a value here… Decorative letterspaced micro-labels are
  still functional and stay in scope."* Our `.eyebrow` is 10px Cinzel at `0.22em`. The rule is
  right — that is hard to read, and it is not a false positive to be ignored away.
- The failing placeholder colour `#757575` is a **browser default**, not a theme token at all.
  It is the 174-hex drift problem showing up on the very first page scanned, and it means the
  light `vellum` theme almost certainly has worse instances waiting.

So the first scan found two genuine defects on the simplest page in the app. That is a good
sign for Phase 2 — once the auth problem in correction #4 is solved.

### Next step

Phase 1, in Claude Code chat (not the terminal):

- `/impeccable doctor` — confirm the install is healthy
- `/impeccable init` — writes `PRODUCT.md`
- `/impeccable document` — writes `DESIGN.md`, codifying Arcane **before** anything is restyled
- `/impeccable extract` — then add the missing `--space-*` / `--radius-*` / type-scale tokens
- an `ignores` pass for the identity rules listed above

### Both login-page defects fixed (branch `fix/login-label-and-placeholder-contrast`)

Re-scanned after the fix: **6 findings + 2 advisory → 4 findings + 0 advisory.** The remaining
four are the `radial-spotlight-glow` and `dark-glow` identity findings earmarked for the
Phase 1 `ignores` pass. Verified in-browser across all three themes: labels 11px,
`::placeholder` opacity 1, contrast 6.31:1 / 5.25:1 / 5.44:1.

Two things this turned up that are **bigger than the fix itself**:

1. **`--text-dim` fails WCAG AA on two of the three themes** — 2.98:1 on vellum's `--bg-2` and
   3.51:1 on candlelit's, against a 4.5:1 requirement. It passes only on midnight (6.31:1).
   That is why the placeholder got its own token instead of reusing it. `--text-dim` is used
   widely, including by `.field label` itself, so **every `--text-dim` usage on vellum and
   candlelit is suspect.** The detector cannot see this: it only ever scanned the default
   midnight theme. Needs its own audit — a token-level contrast sweep across all three themes,
   not a per-page scan.
2. **30 more sub-11px values remain.** `font-size: 10px` appears 32 times (16 in `styles.css`,
   16 across component stylesheets); only the two on the login page were reachable by the
   scanner. These were deliberately **not** swept in this fix: doing 30 ad-hoc edits without a
   type scale, and with no way to re-scan the affected surfaces until the Phase 2 auth problem
   is solved, is exactly the churn this plan exists to avoid. They belong in the Phase 1
   type-scale work.

Both points argue the same thing: **per-page URL scanning is not sufficient for a themed app.**
Phase 2 needs a theme-matrix pass, not just a route-by-route pass.

---

## 9. Phase 1 results — design context captured (2026-11-10)

### How it ran

The `/impeccable` slash commands were **never available**: the skill installed into
`~/.claude/skills/` but the session that installed it could not load it, and a reload did not
happen before this work. The playbooks are plain markdown, so Phase 1 was run by reading
`reference/init.md`, `reference/document.md` and `reference/extract.md` and following them
directly. The skill's own `impeccable context` launcher *did* run and supplied its directives.

That distinction matters for judging the tool: **nothing below came from the skill driving the
session.** It came from the skill's written method, applied by hand.

### What was produced

| File | Contents |
|---|---|
| `PRODUCT.md` | Product truth from a three-question interview: in-person single group; positioning across live session state, variant rules and deliberate lightness; three binding constraints (2024 PHB, phone-usable, DM/player visibility split). |
| `DESIGN.md` | The Arcane system to the DESIGN.md spec — YAML token frontmatter plus the eight canonical sections. North star **"The Astral Chart"**; depth is tonal, glow is state; components "refined and restrained". |
| `.impeccable/design.json` | Sidecar (schemaVersion 2): tonal ramps, shadow/motion/breakpoint tokens, 7 component snippets, narrative. |
| `.impeccable/config.json` | Detector ignores. |
| `src/styles.css` | The missing scales, as tokens. |

### The scales (the Phase 1 deliverable from §4)

`--space-*` (2–20px on a 2px grid, 8px the unit), `--radius-*` (2px house corner through
`999px` pills), `--text-*` (11–48px) and `--track-*`. Theme-independent, unlike the colour
tokens.

**Definitions only — no existing declaration was rewritten**, so this cannot have changed
anything visually. Migrating the ~1,900 raw px values is its own pass.

The type scale deliberately has **no step below 11px**. Naming a 9px or 10px size would launder
the legibility floor; those values remain in the codebase as recorded debt, not as a tier.

### Decisions worth knowing

- **Interview answers shaped the file, not the repo's guesses.** Content licensing was offered
  as a constraint and *not* selected, so `PRODUCT.md` records it as an open question rather than
  assuming an SRD restriction.
- **A documented rule immediately collided with the implementation.** "Glow is state" was the
  chosen depth philosophy, but `.btn.primary` carries the gold glow at rest. Rather than quietly
  exempt it, DESIGN.md names **The One Standing Glow** as the single sanctioned exception.
- **`dark-glow` was deliberately NOT suppressed.** It has no value-level ignore, so silencing it
  would also stop it catching celestial rest glows — the failures actually worth knowing about.
  Its 3 findings are expected output; check which element they sit on before treating them as
  new. Only `radial-spotlight-glow` is ignored, since that wash *is* the documented world.
- **A stated tension was recorded, not smoothed over.** The chosen component philosophy is
  "refined and restrained"; the current build runs dense (9–10px labels, 4–6px gaps). DESIGN.md
  marks restraint as the direction for new and reworked surfaces, not a description of what
  exists.

### State after Phase 1

Detector on the login page: **3 findings, all the One Standing Glow.** Contrast gate: green,
135/135. No visual change.

### Still open

- Migrating raw px values onto the new scales, and the ~55 sub-11px font sizes.
- `/impeccable` slash commands still need a reload; everything so far was done by hand.
- Phase 2's auth blocker (§8 correction #4) is unchanged: `detect` launches a clean browser, so
  only the login page is reachable.

---

## 10. Phase 2 results — measured backlog (2026-11-13)

### How it ran

- **`/impeccable` loaded as a real skill** this time (v4.8.0). `doctor` reported one `mention`:
  `.impeccable/design.json` predates DESIGN.md's last edit (`/impeccable document` refreshes it). A
  v4.9.0 update is available and was not applied.
- **The §8 auth blocker is solved — without credentials.** The app's own demo mode (in-memory seed
  data, no backend) reaches every signed-in surface. The detector's browser bundle was injected into
  that signed-in page through `impeccable live-server` and run with `impeccableScanAsync()`; `/login`
  and `/register` used the CLI's clean browser. No local backend, no :8080 conflict, no real accounts.
- **Every surface at 375×812 in all three themes**, with the contrast-audit §5 traps handled
  (canvas-resolved sRGB, transitions off, gradients composited). Failures are split into *definite*
  (fail on the solid ground) and *wash-only* (would fail only if the faint radial washes peaked under
  the text). Only definite failures are reported, and each headline one was re-read from computed
  styles. The first version of the script over-counted wash failures; it was caught before any report
  was written.
- **Critique ran dual-agent:** four isolated design-review sub-agents (Assessment A) never saw the
  detector output; detector and measurement evidence (Assessment B) was gathered in the parent before
  their output was read. Every A finding promoted into the backlog below was checked in source or
  in-browser first; three were corrected (see "Corrections").
- Reports: `.impeccable/surfaces/*.md` (audit; method in its README) and `.impeccable/critique/*.md`
  (synthesis + the reviewer's full assessment). The `critique-storage` helper was not used — it names
  files by a hashed slug, so there is no `/impeccable critique` trend yet; the files use the names
  this plan specified.

### Scores

| # | Surface | Audit /20 | Critique | P0 | Headline |
|---|---|---|---|---|---|
| 1 | Character sheet | 10 | 21/40 | — | Vellum tab bar 1.34:1; header buries vitals at 375px |
| 2 | Session mode | **9** | 20/40 | **1** | Whose-turn names 1.16:1 in vellum; 720px board |
| 3 | Create-character wizard | **8** | **19/40** | **1** | Off-palette violet; vellum ability labels 1.11:1; "+17" modifiers |
| 4 | Campaign dashboard | 10 | 21/40 | — | Curated cards vanish in vellum; one-tap deletes |
| 5 | Sidenav + roster | 13 | 25/40 | — | Drawer: no close / Escape / focus; stale top bar |
| 6 | Login / register / reset | 13 | 26/40 | — | Page can't scroll; Enter submits twice |
| 7 | Modals | 11 | 23/40 | — | Three dialects; disabled buttons look enabled; Escape on 2–3 of ~10 |
| 8 | Settings panel | 13 | 23/40 | — | Unnamed toggles; account fields save nothing |
| 9 | Session live banner | 13 | 27/40 | — | Session start not announced |
| 10 | Toasts / empty states | 14 | 21/36 | — | Toast 188px wide on a phone |

The worst-first order in §4 was right: the three surfaces used *at the table* (session, wizard,
sheet) are the three lowest.

### The finding that reframes Phase 3

**The contrast gate is green (0/135) and vellum is still broken on five surfaces.** The gate checks
*token pairs*; the failures come from code that never reaches a token:

| Leak | Count | Effect in vellum |
|---|---|---|
| **Undefined tokens** with midnight fallbacks — `--muted` ×34, `--bg-elev` ×16, `--accent` ×13 (falls back to CSS `gold`), `--line` ×4, `--panel`, `--panel-bg`, `--surface-1` | ~70 refs | 60 %-white text at 1.13–1.16:1; near-black sheet tab bar |
| **White-alpha literals** `rgba(255,255,255,…)` | **192** (session 51, wizard 49, dashboard 44, level-up 24) | white text on parchment |
| **Literal state colours** — turn `#7fe0ae` / `#f0d391`, wizard violet `#8a5cf6` / `#a78bfa` | ~15 | the turn cue and wizard progress disappear |
| **A defined token used as a fill it was never tuned for** — `.seg-btn.active { background: var(--celestial, <18 % tint>) }` | 2 | 1.6–1.8:1 in **all three** themes |

§3's "174 hard-coded hexes" was the wrong metric — most of them are harmless `var(--gold, #d9b25f)`
fallbacks behind defined tokens. The damage is the undefined tokens and the white-alpha literals.

### Ranked Phase 3 backlog

Ranked by severity, then by how many surfaces one fix reaches. "Slice" maps to the §4 table (revised
below); **fix** = a small standalone bug branch, not a slice.

| Rank | P | Finding | Surfaces | Where | Goes to |
|---|---|---|---|---|---|
| 1 | P0 | Whose-turn / on-deck names 1.16–1.27:1 in vellum (literal `#7fe0ae`, `#f0d391`) | session | `initiative-panel.component.scss:6-32` | slice 1 |
| 2 | P0 | Wizard ability labels, totals, chrome invisible in vellum (white-alpha) | wizard | `steps/*.scss` | slice 1 |
| 3 | P1 | Seven undefined tokens with midnight fallbacks | sheet, session, dashboard, toasts, item composer | see table above | slice 1 |
| 4 | P1 | `.seg-btn.active` 1.6:1 in every theme | session (shop, loot) | `shop-panel.scss:49`, `loot-panel.scss:54` | slice 1 |
| 5 | P1 | Off-palette violet progress / selection, standing violet glow | wizard | `create-character-modal.scss:87`, steps | slice 1 |
| 6 | P1 | Modifier column shows the score ("INT 17 +17") | wizard | `ability-scores-step.html:44,87`, `review-step.html:157` | **fix** |
| 7 | P1 | Enter on username calls `login()` twice | auth | `login.component.html:23,32` | **fix** |
| 8 | P1 | "DM Notes" render to the character's owner — latent (nothing writes `PC.notes` yet), but a hard product rule | sheet | `background-story.component.html:76`; backend `PC.notes` | **fix, both repos** |
| 9 | P1 | Initiative board `min-width: 720px`; party board likewise | session, dashboard | `styles.css:1616-1624` | slice 3 |
| 10 | P1 | Auth pages cannot scroll (`body { overflow: hidden }`) | auth | `styles.css` | slice 3 |
| 11 | P1 | Sheet at 375px: header ~64 % of first screen, name clips; 720px grid overrides lose on source order | sheet | `styles.css` ~621 vs ~668 / ~783 | slice 3 |
| 12 | P1 | Disabled `.btn` / `.btn.primary` look enabled (no `:disabled` style) | wizard, modals, app-wide | `styles.css` | slice 2 |
| 13 | P1 | Escape on 2–3 of ~10 dialogs; level-up and settings focus/escape gaps; app header live above backdrops on phones | modals, settings, wizard, banner | — | slice 2 (+3) |
| 14 | P1 | Mobile drawer: no close, Escape, focus or `inert`; stays open after navigating; top bar shows stale context | sidenav | `sidenav.component.*` | slice 2 + 3 |
| 15 | P1 | Turn changes and session start never announced; countdown announces every second | session, banner | — | slice 2 |
| 16 | P1 | Silent failures — saves, grants, curated editors, session actions go to `console.error` only | sheet, dashboard, session | — | new harden branch |
| 17 | P1 | Unguarded destructive actions — curated deletes, notes, End Session | dashboard, session | — | new harden branch |
| 18 | P1 | Unnamed controls (settings toggles, wizard/encounter/picker selects); account fields look editable and save nothing | settings, wizard, session, banner | — | slice 2 |
| 19 | P1 | **56 sub-11px declarations** — 68 nodes on the sheet tab alone; 7–9px in wizard and combat chips | all except auth | — | **new: type-floor slice** |
| 20 | P1 | Toast squeezed to half the phone (188px) | toasts | `toast.component.scss` | slice 3 |
| 21 | P1 | Preparation lives inside play (session) / prep and status fused (dashboard) — PRODUCT.md principle 3 | session, dashboard | — | slice 6 (re-scoped) |
| 22 | P2 | Standing glows: `.modal` (`styles.css:1170`), login card + brand name, portrait, sheet/campaign title, settings slide-over, **celestial** role pill | many | — | slice 6 |
| 23 | P2 | Sub-24px targets — exhaustion pips 22, inspiration pips 19, note buttons 18×16, reveal toggle 16, level-up checkboxes 13 | many | — | slice 3 |
| 24 | P2 | Off-system corners (10–12px toast, curated cards, banner, session forms); level-up Arial buttons and 6–8px radii | toasts, dashboard, session, modals | — | slice 1 / 6 |
| 25 | P2 | Reduced motion: only 2 files honour it; the turn cue *lives in* an infinite animation | session | `session-mode.scss:23` | slice 2 |
| 26 | P2 | Copy: password minimum 6 vs 8; "ask your DM" for an admin-issued reset; slot pips filled = spent; rules in hover-only tooltips; generic error toasts; DM edit types absolute HP | auth, sheet, modals, toasts | — | slice 4 |
| 27 | P2 | Empty states that misdiagnose ("No heroes match that name." with no query) or point at the hidden phone drawer | sidenav, toasts | — | slice 4 |

### Verdict on the six planned slices

| # | Slice | Evidence says | Change |
|---|---|---|---|
| 1 | `chore/impeccable-token-sweep` | **Strongly supported — the highest-value slice.** Owns both P0s. | **Re-scope to colour only:** (a) the seven undefined tokens, (b) the 192 white-alpha literals, (c) literal state colours and the violet, (d) `.seg-btn.active`. **Drop the px migration** — no finding was caused by px, and mixing it in makes the three-theme verification unreviewable. Add a **CI guard** that fails on `var(--x)` for an undeclared `--x` and on new `rgba(255,255,255,` in component styles; the token-pair contrast gate demonstrably cannot see this class of bug. |
| 2 | `fix/a11y-deferred-backlog` | **Supported and larger than planned.** All 8 deferred items are still present. | **Expand:** disabled-button style, a shared modal shell (title, close, Escape, focus-in, trap) instead of wiring `appEscapeClose` dialog by dialog, turn/session live regions, unnamed controls, reduced-motion turn cue. Keep silent failures and unguarded deletes (ranks 16–17) out — they are `harden` work too, but belong on their own branch so this one stays a11y-only. |
| 3 | `fix/responsive-pass` | **Strongly supported**, now with concrete targets. | Board / party-board phone layout, auth scrolling, sheet header and grid source order, drawer close-on-navigate, toast width, header above modal backdrops, sub-24px targets. No change in shape. |
| 4 | `chore/ui-copy-clarify` | **Weakly supported.** The in-world voice is the app's strength; most copy is good. | **Shrink** to ranks 26–27 and **absorb slice 5**. |
| 5 | `feature/first-run-onboarding` | **Not supported as its own slice.** The empty states are some of the best work in the app; the gaps are two misdiagnosing messages and a dead-end banner state. | **Fold into slice 4.** Revisit only if a real new-player session shows confusion. |
| 6 | `chore/ui-density-polish` | **Supported, but the real problem is structure, not noise.** | **Re-scope** to `layout`/`distill`: separate prep from play on the session screen and group the dashboard; plus the standing-glow cleanup (`quieter`) and the level-up dialect (`polish`). |
| new | `chore/type-floor` | **Added.** The 11px floor is broken by 56 declarations, concentrated on the sheet, wizard and combat chips. | `/impeccable typeset` onto the existing `--text-*` scale. This is where the deferred **px migration** naturally starts (font sizes first), so it absorbs the part dropped from slice 1. |

**Recommended order:** the three small **fix** branches first (ranks 6–8 — cheap, real bugs, and
rank 8 is a product rule), then slice 1 → 2 → 3 → type floor → harden (ranks 16–17) → 6 → 4. Slices
1 and 3 both touch `styles.css`; keep them sequential, not parallel.

### Corrections this phase made to earlier records

- **§9** says the login page's three `dark-glow` findings are "all the One Standing Glow". Only
  `button.btn.primary` is; `div.login-card` and `div.login-brand-name` also glow at rest.
- **DESIGN.md** says "`prefers-reduced-motion` is honoured". Only `conditions-panel` and
  `dice-roller-modal` honour it; `styles.css` (26 transitions/animations) and session mode do not.
  Either the claim or the code should change in slice 2.
- **§3's 174-hex count** is not the theme-drift metric — see "The finding that reframes Phase 3".
- Three design-review claims were corrected before entering the backlog: the DM-notes leak is
  latent, not live (P1, not P0); "no reduced-motion anywhere" is "two files only"; Escape also works
  in DM edit.

### Detector notes for Phase 4

- **True positives worth keeping on:** `low-contrast` caught `.seg-btn.active` independently;
  `dark-glow` on the wizard's violet step dot and on the celestial role pill are real rule breaks.
- **Expected noise:** `kicker-above-heading` (the house `.eyebrow`), `nested-cards` on panel-in-panel
  and notes, `dark-glow` on the active initiative row (a sanctioned state glow) and on `.btn.primary`.
- **In-page runs ignore `.impeccable/config.json`.** A PR-time gate should run the CLI against a
  served build in demo mode (set `localStorage.demoMode = 'true'` before load) — that makes every
  surface scannable in CI with no backend.

### Questions for the owner

1. **Login glow:** remove the card and brand-name glows, or record the login page as a sanctioned
   ceremonial exception in DESIGN.md?
2. **Session layout:** is splitting preparation (shop / loot / encounter loader) out of the live
   session screen in scope for slice 6, or a separate feature?
3. **DM notes:** fix the latent visibility hazard now (frontend role check + backend strips `notes`
   from the owner's payload), even though nothing writes the field yet?
4. **Wizard accent:** fold the violet into gold (active) + celestial (done), or keep Thistle Violet
   (`--violet`) as the wizard's sanctioned accent?
