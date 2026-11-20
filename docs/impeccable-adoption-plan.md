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

> Done on 2026-11-20, with three changes to the plan below: the scan drives the signed-in screens
> through demo mode instead of pointing at one URL, the annotations are written by our script
> because the detector's `--github` output cannot name a screen or an element, and the design
> hook stays off. See §11, "Phase 4 results".

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

### Owner decisions (2026-11-13)

All four took the recommended option. These are settled; later slices should not re-ask.

| # | Question | Decision | Lands in |
|---|---|---|---|
| 1 | Login glow | **Remove** the at-rest glow on `.login-card` and `.login-brand-name`. No ceremonial exception — only `.btn.primary` keeps its sanctioned glow. | slice 6 |
| 2 | Session layout | **Out of Phase 3.** Splitting prep from play changes how a DM runs a session, so it gets its own feature and design pass. Slice 6 stays polish-sized. | separate feature |
| 3 | DM notes | **Superseded the same day — `PC.notes` is the player's field, not DM notes.** First answered "fix now, in both repos", but that rested on this audit's reading of the sheet's "DM Notes" label. The backend files `notes` under Narrative beside `bio`, and `CampaignMemberView` already hides it from the DM as "a player's private narrative"; only the frontend label and model comment (one commit, 2026-05-30) said DM-only. **Decision: relabel to "Notes", frontend only, no backend change.** Stripping it from the owner would have hidden players' own notes from them. | fix (rank 8) |
| 4 | Wizard accent | **Gold + celestial.** Gold for the active step and selection, celestial for completed steps. Thistle Violet stays reserved for categorical chips and tags, as DESIGN.md defines it. | slice 1 |

### Owner decision (2026-11-18): no italics anywhere

Owner request, verbatim: "As a User, I want to remove Italics from all text within the
application". This overrides DESIGN.md's old "Italic is used for flavour text" and is settled;
later slices should not bring italics back. Branch `chore/remove-italics`.

**What changed.** All 100 `font-style: italic` declarations are gone (74 in stylesheets, 26 inline
in templates, 49 files), along with the 15 `font-style: normal` overrides that only existed to
cancel them. One global rule in `src/styles.css` resets the elements a browser slants by default
(`em, i, cite, dfn, address, var`), so the `<em>`s that carry emphasis stay in the markup. The
Google Fonts link no longer asks for Newsreader's italic faces.

**Where italic was doing a job.** Almost every italic line already differed from its neighbour by
colour or size, so it only lost the slant. Italic was the *only* difference in these places, and
each got a replacement from the existing tokens:

| Place | Before | Now |
|---|---|---|
| Item notes under an item's meta line (inventory, session loot, curated loot) | both `text-dim`, same size; note italic | note `text-2`, meta `text-dim` |
| Selected encounter's notes (session loader) | `text-dim` italic | `text-2` |
| Run-in labels "At higher levels:" / "Materials:" (spellbook) and "At Higher Levels." / "Cantrip Upgrade." (session spell cards) | italic inside `text-2` prose | `text`, weight 600 |
| "Recommended" inside the wizard's spell hint | italic | `text` on a `text-dim` line |
| "(Bonus Action)"-style kind tags in druid form cards | italic | `text-dim` inside a `text-2` line |

**Layout.** Upright Newsreader is wider than its italic. 57 formerly italic elements were
re-measured at 375px (dashboard, sheet, session): one grew. The dashboard subtitle went from one
line to two (22px → 44px) and stranded a single word, so `.sheet-subtitle` now uses
`text-wrap: balance`. The sheet subtitle was already two lines; `.sheet-tabs` is still 52px
(`--sheet-tabbar-h` unchanged) and the initiative cards did not move.

**Results.**

| Measure | Before | After |
|---|---|---|
| Italic declarations under `src/` | 100 | 0 |
| Text elements computing italic, 1280px: dashboard / sheet / spells tab / session / settings open | 16 / 32 / 24 / 18 / 37 | 0 everywhere |
| Same scan across every screen demo mode reaches (auth pages, all 9 demo heroes × 8 tabs, wizard on both the PHB-caster and Warcraft paths, level-up, dice, settings, dashboard dialogs, session with an encounter), at 375px and 1280px, in all three themes | — | 0 of about 230 scan points; no horizontal page scroll, nothing clipped |
| Newsreader italic font file on first visit | 64.5 kB | not requested |
| Google Fonts stylesheet | 17.6 kB, 41 faces | 14.9 kB, 35 faces |

**CI guard.** `scripts/check-tokens.js` now also fails on an italic declaration anywhere under
`src/`: `font-style: italic|oblique`, the `font:` shorthand, `fontStyle` set from code, or the
`ital` axis in the Google Fonts URL. Proven by planting one in a stylesheet and one in a template
(exit 1 each), then removing them (exit 0). It also caught this change's own first draft of a CSS
comment, which is why the comment in `styles.css` avoids spelling the declaration out.

**Gates.** `check:tokens` OK (1417 `var()` uses, no italics), `check:contrast` 135/135, `ng test`
1321/1321, Cypress 6/6 specs (13 tests), production build **448.73 kB** initial (budget 497 kB).

**Not covered, and things noticed on the way** (none fixed here):

- Loot rows with a note, and spellbook spells with an "At higher levels" line, were not reachable
  with demo data; those two replacements were checked from the stylesheet, and the run-in label
  was seen live on a session spell card.
- `.auth-or` (the "or" divider on the login page) asks for 'EB Garamond', which is never loaded,
  so it renders in the browser's default serif.
- Spellbook header at 375px in the DM view: the "Grant spells" button runs past the panel edge.
  Same with the italics injected back, so it predates this change.
- The sheet subtitle shows empty brackets, "Wizard ()", for a character with no subclass.
- `.spell-tag` in the hero-class panel is 10px, under the 11px floor.
- The professions panel's `.empty` paragraph also picks up the global `.empty` block (the "No
  Hero Selected" layout), which makes it a tall centred block.

### Phase 3 progress

| Rank | Branch | State |
|---|---|---|
| 6 | `fix/ability-modifier-display` | Done — regression from #228 (2026-07-25): the wizard piped raw scores into a pipe that only adds a sign, so 17 read "+17". |
| 7 | `fix/login-double-submit` | Done — one Enter sent two login requests; with the password empty it sent one anyway. Measured 2 → 1 and 1 → 0. |
| 8 | `fix/pc-notes-label` | Done — relabelled "DM Notes" to "Notes"; the field was the player's all along. No backend change. |
| 1–5 | `chore/impeccable-token-sweep` (slice 1) | Done — colour only, no px or font-size changes. Both P0s fixed, the seven undefined tokens mapped onto existing ones (no new tokens), every white-alpha literal gone, `.seg-btn.active` retuned, wizard violet → gold + celestial, and `npm run check:tokens` added to CI. See "Slice 1 results" below. |
| 12–15, 18, 25 + a11y notes | `fix/a11y-deferred-backlog` (slice 2) | Done — disabled `.btn` state, a shared modal shell (Escape on all 13 dialogs, topmost only), the phone drawer as a modal dialog, turn / session / rest-vote live regions, named controls, app-wide reduced motion with a static turn cue, and the remaining a11y-notes items. See "Slice 2 results" below. |
| 9–11, 13–14, 20, 23 + launcher bug | `fix/responsive-pass` (slice 3) | Done — initiative board as cards on narrow boards, auth pages scroll, phone sheet header and source-order fix, drawer closes on campaign pick with a contextual top bar, full-width toasts, every listed target at 24px or more, and the dice launcher / toast / settings stacking. See "Slice 3 results" below. |
| 19 | `chore/type-floor` | Done — all 61 sub-11px declarations lifted to `var(--text-2xs)` with the tracking ladder, 0 sub-11px nodes on every reachable screen at 320 / 375 / 414 / 1280, seven tight spots re-laid out instead of shrunk, two faded wizard labels brought up to AA. See "Type-floor results" below. |
| 16–17 | `fix/harden-feedback` | Done — the 56 save / grant / curated-editor / session failures that only reached `console.error` now toast what did not happen (server 4xx message when there is one), failed list loads say so with a retry, and fields put back to the saved value; End Session and Leave stay put when refused. Curated deletes, note deletes, End Session — plus End Encounter and removing a player, which used `window.confirm` — go through one shared crimson confirm. See "Harden results" below. |
| 22, 24 | `chore/ui-density-polish` (slice 6) | Done — every glow at rest removed except the primary button's (dialogs, login, brand marks, portraits, titles, role switch, dots and pips, selected options, the dice launcher), 65 off-scale corners moved onto `--radius-*` by role, and the level-up dialog brought into the app's dialect (Cinzel labels and tabs, `.btn.primary` commit, a frame that stays put). Rank 21 stays out by owner decision. See "Slice 6 results" below. |
| 26–27 | `chore/ui-copy-clarify` (slice 4, absorbing slice 5) | Done — one password minimum (8) stated on every form, reset links attributed to an admin instead of the DM, spell slots counted in words ("3 of 4 left"), the DM edit field explained as a new total with a live "That is 7 damage.", rules that lived in hover tooltips given a tap-reachable "?" or plain text, the last generic error messages rewritten, and empty states that tell a failed load, an empty list and a failed search apart. See "Slice 4 results" below. |

#### Slice 1 results (2026-11-14)

Measured on current `develop` (after #234) in demo mode at 375×812, every theme set on `<html>`
with transitions off, colours resolved through a canvas, gradients composited stop by stop.
Ranges are worst–best across a row's gradient wash.

| Finding | Theme | Before | After |
|---|---|---|---|
| **P0** current-turn name / init | vellum | 1.07–1.23 | **6.11–7.64** |
| **P0** on-deck name / init | vellum | 1.06–1.16 | **6.47–7.92** |
| current-turn / on-deck (unchanged look) | midnight · candlelit | 7.6–11.3 · 7.2–10.4 | 6.0–9.8 · 5.6–9.3 |
| **P0** wizard ability labels | vellum | 1.11 | **6.28** |
| **P0** wizard ability totals | vellum | 1.18 | **13.22** |
| wizard step dots (upcoming / done) | vellum | 1.06–2.33 | 5.39–5.62 |
| wizard active step dot (was white on violet) | all | 4.25 | 5.85 (vellum) – 10.1 |
| `.seg-btn.active` (shop, loot) | all | 1.6–1.8 (Phase 2) | 6.84–10.24 |
| sheet tab bar | vellum | 1.34 (Phase 2) | 6.21–10.68 |
| curated-list secondary text | vellum | 1.13 (Phase 2) | 4.37 at the wash peak, passes on the solid ground |

After the sweep, a whole-surface scan found **zero definite failures in all three themes** on the
session screen, all 8 wizard steps, the character sheet (all 7 tabs), the campaign dashboard,
level-up (with the spell picker), the dice roller and the item composer. One exception: the
dashboard's "Invite" `.eyebrow` is 4.4:1 in vellum. That is the known `--gold`-in-vellum token
margin (contrast audit §3, caveat 2), not a leak, so it was left alone. Selected and granted wizard
states that demo data cannot reach were checked by forcing the classes: all ≥ 6.1:1.

**Mappings used.** `--muted` → `--text-dim`; `--bg-elev` → `--text` wash at the old alpha;
`--accent` → `--gold`; `--line` → `--border-soft` / `--border`; `--panel`, `--surface-1` →
`--bg-2`; `--panel-bg` → `--surface` at 96 %. White-alpha text mapped by alpha onto the text ramp
(≥ .82 `--text`, ≥ .62 `--text-2`, else `--text-dim`), borders onto `--border-soft` / `--border`,
faint fills onto a `--text` wash. Of the 190 white literals in component styles on `develop`, 138
were fallbacks (behind undefined tokens, or harmlessly behind declared ones). The wizard owned 49 of
the 52 plain ones. The dice's specular highlight stays, marked
`token-check: allow-white`.

**Found by the sweep, not in the Phase 2 backlog** (each its own commit):
- Spellbook descriptions in global `styles.css` were 70 % white, invisible in vellum. Now `--text-2`.
- Purse amounts used literal metal inks (silver 1.2:1, platinum 1.26:1 in vellum). Vellum mixes
  them toward `--text`; worst 4.9:1.
- Spell-slot chips: `--gold` on a gold tint, 4.43:1 in vellum. Now `--gold-2`.
- Dice roller: arena mixed `--bg` with literal black (vellum hint 1.9:1), and d4 still used
  crimson's pre-fix `#c8504f` (label 4.16:1 everywhere). Vellum arena → `--bg-2`, d4 → `#d67c7b`.

**Detector**, static run on the 21 changed source files with DESIGN.md context: 461 → 255 findings,
`design-system-color` 295 → 89. Of the 89 left, 59 are fallbacks behind declared tokens
(harmless). About 30 are plain literals: gold-alpha tints and glows, black shadows, and a few status
hexes (`#fbbf24`, `#f87171`, `#7dd3fc`, `#fff` on coloured fills). None produced a definite contrast
failure in any theme. They are a candidate follow-up, not slice-1 scope.

**CI guard.** `scripts/check-tokens.js` (`npm run check:tokens`) runs beside `check:contrast`,
before `npm ci`. It fails on `var(--x)` for an `--x` declared nowhere in `src/`, and on
`rgba(255,255,255,` in any stylesheet under `src/` (component styles and `styles.css`) unless
the line carries `token-check: allow-white: <reason>`. Verified by planting both leaks: exit 1.

#### Slice 2 results (2026-11-15)

Branch `fix/a11y-deferred-backlog`, cut from `develop` at `a56c50a` (after #234, #236, #238,
#239 and #241). `/impeccable harden` drove it; `doctor` ran first (no auto fixes; it mentions
the stale `design.json` sidecar and routes a `document` refresh, 34 commits since DESIGN.md's
last edit). Every finding was re-checked on that `develop` before fixing: all were still present
except the wizard's ability `select`s, which already carried `aria-label`s.

| Rank | Finding | Fix | Measured / verified |
|---|---|---|---|
| 12 | Disabled `.btn` / `.btn.primary` look enabled | One disabled look for every variant: dashed `--text-dim` hairline and label, no fill, glow or hover. Shop/loot Buy lost their `opacity` override. | Boundary 4.52:1 (vellum) – 4.57:1 at worst against any ground; 15 specs over 4 variants × 3 themes |
| 13 | Escape on 2 of 13 dialogs; level-up focus on `<body>`; no shared chrome | `appDialog` + `<app-modal>` (`components/modal/`): Escape for the topmost dialog only, focus in, Tab trap, focus back, `<h2>` titles | 15 shell specs; in-browser: dice roller over level-up closes one Escape at a time, focus walks back; level-up focus inside the dialog |
| 13 | Phone header live above modal backdrops | `.main-inner` no longer sets `z-index` (its stacking context held every in-page dialog under the z 90 top bar) | `elementFromPoint` on the top bar returns the backdrop |
| 14 | Drawer: no close, Escape, focus or `inert` | Modal dialog while open: close button (initial focus), Escape, Tab trap, focus back to the hamburger, `<main inert>`, `aria-expanded`; closed drawer `visibility: hidden` | Real Tab / Shift+Tab stay inside; scrim, close and Escape all return focus |
| 15 | Turn changes and session start silent; countdown every second | Hidden `role="status"` lines on the initiative board (visible rows only) and an always-present one in the session banner; the rest-vote number is out of every live region and a line speaks at open / 10 s / 0 | Demo session: "Lyra Moonwhisper's turn. Throk Ironjaw is on deck." then the swap on Next Turn; banner and countdown by spec |
| 18 | Unnamed controls; account fields save nothing | Settings toggles are `role="switch"` named by their rows; display name and email are read-only text with a note (no save path invented); 22 visible labels bound with `for`/`id`; placeholder-only fields and the encounter / loot / shop selects named | In-browser read of names and `aria-checked` / `aria-pressed` |
| 25 | Reduced motion in 3 files; turn cue lives in an infinite animation | One global rule in `styles.css`; the my-turn vignette holds its green frame statically | Rule body forced in-page: animation ends after one 0.01 ms pass, frame stays at full strength |
| notes | Curated rows, spellbook rows, toast, wizard step, initiative hero cell | Name buttons, a disclosure button, a toast dismiss button, a hidden "Step N of M", a conditional `role="button"` | Specs (curated / spellbook panels are viewport-deferred and do not render in a hidden browser pane) |

Also added: a palette focus ring (`:focus-visible`, 2px `--gold`, 2px offset; worst 4.54:1, vellum)
for controls without their own focus state. DESIGN.md now documents the disabled state, the
focus ring, the dialog shell and the drawer, and its reduced-motion claim matches the code.

**Gates.** `check:tokens` OK (1117 `var()` uses), `check:contrast` 135/135, `ng test` 929/929,
production build 444.04 kB initial (budget 497 kB; ~441 kB before).

**Known gaps, not fixed here:**
- Focus returns to the opener only if it can still take focus: dialogs opened from the drawer
  footer close the drawer first, so focus falls to `<body>` when they close.
- The turn vignette (z 900) now paints over modal backdrops (z 100) instead of being trapped
  under the phone top bar. It is `pointer-events: none` and only an edge glow, so it was left.
- Not exercised in a browser: the session banner (hidden in demo mode), the players' rest-vote
  dialog, and the delete-character dialog from a standalone sheet. Each is covered by a spec or
  uses the shell unchanged.
- Slice 3 still owns closing the drawer after navigating (campaign rows) and the sub-24px
  targets; this branch also touches `styles.css`, so slice 3 should start from it.

#### Slice 3 results (2026-11-16)

Branch `fix/responsive-pass`, cut from `develop` at `4690227` and merged with `develop` at
`d270913` (#245, #247) before reporting. `/impeccable adapt` drove it; `doctor` ran first and
reported two `mention`s only (the stale `design.json` sidecar, which `/impeccable document`
refreshes, and an unset `buildPath`, which needs no answer without image generation). Measured
in demo mode with transitions off, at 320, 375 and 414px plus 1280px, in all three themes.
Every finding was re-checked on current `develop` first.

| Rank | Finding on `develop` | Fix | Measured after |
|---|---|---|---|
| 9 | Initiative board rows 720px wide in a 293px panel: AC, conditions and DM controls behind a sideways scroll. Party board already fixed by #236. | Card per combatant below 720px of **board** width (container query): Init tile + name, health beside an AC tile, conditions, DM controls at 36px. Columns moved from an inline style to classes. Supersedes #247's flex wrap, which would have overridden the cards. | Board scrollWidth = clientWidth at 320 / 375 / 414 (238 / 293 / 332); desktop keeps its 6 columns |
| 10 | Register card 666px tall at 320×568, page could not scroll (still true after #236) | `.login-page` gets a fixed `100dvh` height, so its own `overflow-y` scrolls | Bottom link reachable and tappable at 320×568 |
| 11 | Sheet header 348px at 375px; name clipped to "MOONWHIS"; equipment names 34px wide (720px block lost on source order) | 720px block moved after the base rules; phone header with a 64px portrait beside a 24px wrapping name; action icons dropped. Ability scores deliberately stay 3 across. | Header 185px (213px before #247 dropped Roll); vitals start at y 286 instead of 461; no name clip at any width |
| 14 | DM picking a campaign left the drawer open (page inert); top bar showed the last player-view hero | Campaign rows emit `picked` and the drawer closes (focus back to the menu button); the DM top bar shows the campaign, or "Table Mimic" | Drawer closed, `inert` gone, focus on `.mobile-menu-btn`, title "The Veiled Compass" |
| 13 | Header above modal backdrops (phone) | Already fixed by slice 2 | `elementFromPoint` on the top bar hits the dialog |
| 20 | Toast 160–188px wide on a phone | `width: max-content` under the existing max-width; on narrow screens it rises above the dice launcher | 345px wide at 375px, clear of the launcher and tab bar |
| 23 | Exhaustion pips 22, inspiration pips 19, Use 20, note buttons 18×16, reveal toggle 16, auth link 13 tall, checkboxes 13, selects 23 | 24px pips (rings around the same dot), 24px Use, 32px note buttons, 36px reveal toggle, 25px link, 18px checkboxes inside 32–40px label rows, 28px selects | 0 controls under 24px on the sheet, dashboard and auth pages at all three widths. Left: the checkboxes themselves (18px, their full label row is the target) and the hidden file input behind "Upload sound" |
| bug | Dice launcher covered the pinned tab bar's Followers tab | Fixed on `develop` too (#245 / #247: `--bottom-bar-height` from a body class). This branch keeps that mechanism, feeds it from `--sheet-tabbar-h` (the bar's measured 52px, not 48), and lifts the toast by it | Launcher 14px above the bar at every width; Followers hit-tests as itself |

**Found while checking, also fixed:** the settings slide-over (z 90/91) sat under the launcher
(z 95), which covered Sign Out on a phone; it now stacks at 96/97, still below dialogs (100). The
dashboard header inherited the sheet's portrait grid areas, which put a stray column before the
campaign title (a 210px hole at 1024px, a 14px indent on a phone). The page foot clears the
launcher (84px bottom padding below 720px).

**Gates.** `check:tokens` OK (1138 `var()` uses), `check:contrast` 135/135, `ng test` 933/933,
Cypress 9/9 specs (run before and after the `develop` merge), production build 444.77 kB initial
(budget 497 kB). The detector flagged three raw px font sizes on added lines; all now use
`--text-*` tokens.

**Not covered:** real devices (all evidence is Chromium device emulation; no Safari, no real
touch); the session banner and player-side session views, which demo mode does not reach in the
player role; landscape phones; the level-up spell picker (its checkbox rows are sized from the
CSS, about 40px+, not measured: demo data offers no level-up to open).

#### Type-floor results (2026-11-17)

Branch `chore/type-floor`, cut from `develop` at `8b56779` (after the reputation UI merge) and merged
with `develop` at `7560349` (DM-granted followers) before reporting. `/impeccable typeset` drove
it; `doctor` ran first (no auto fixes; it mentions the stale `design.json` sidecar and routes a
`document` refresh, 25 commits since DESIGN.md's last edit). Measured in demo mode with
transitions off, at 320, 375 and 414px plus 1280px; contrast in all three themes.

**Before / after.**

| Measure | Before | After |
|---|---|---|
| `font-size` under 11px in `src/` (grep, px + rem) | 58 px + 3 × `0.62rem` = **61** | **0** |
| Computed sub-11px text nodes, sheet tab at 375px | **70** | 0 |
| — other sheet tabs (Spells, Inventory, Renown, Followers, Notes, Log) | 9 / 3 / 2 / 1 / 1 / 1 | 0 |
| — wizard, worst steps (review / spells / proficiencies) | 47 / 35 / 8 | 0 |
| — settings panel · dashboard · session · dice roller | 7 · 18 · 10 · 1 | 0 |
| Detector `design-system-font-size`, the 18 changed files | 133 | 72 (none below 11px) |
| Detector `design-system-font-size`, all of `src/` | 181 | 121 (after the `develop` merge) |

The detector's static rules have no `undersized-ui-text` finding (that rule is DOM-only), so the
computed counts above come from a script that walks every visible text node and reads its
computed `font-size`. It found 0 below 11px on every surface demo mode reaches, at all four
widths.

**What changed.** Every sub-11px size became `var(--text-2xs)`; no smaller token was added.
Uppercase Cinzel labels that grew follow the Tracking Ladder: rules already at ≥ 0.2em (the
global `.eyebrow`, sidenav party names, ruleset / group / feat eyebrows, the dice result label)
use `--track-micro` (0.22em); every other label, chip and small button (conditions, skill
abilities, coin names, board chips and column heads, role switch, seg buttons, wizard tabs and
badges) uses `--track-label` (0.18em). Single-glyph badges, numerals, the JetBrains Mono rules
and three uppercase Newsreader labels keep their tracking. `.btn.sm` now inherits the 11px
`.btn` label; the renown panel's local `.eyebrow` dropped its 10px copy of the global rule.

**Layout the bigger type broke, and the fix** (density from padding and layout, not smaller
type; each checked against the old sizes injected over the new build, so only real regressions
were fixed):

| Spot | Problem at 11px | Fix |
|---|---|---|
| Ability boxes (73px at 320) | "save" overlapped DEX by 11 × 6px | 4px more top padding, 2px less name margin; boxes 2px taller net |
| Dashboard vitals (2 across on phones) | "Top Pass. Perc" wrapped, values out of line | 10px side padding instead of 16px below 720px |
| Theme swatches (≤ 360px) | "Candlelit" needs 81px, label box 70px — clipped | Rows below 360px: 72px preview strip + name |
| Party board, desktop | "Pass. Perc" / "Pass. Ins" heads wrapped, head row 34 → 53px | Columns 64 / 64 → 78 / 66px, party-board row floor 720 → 730px; head row 37px |
| Party board, phone tiles | "Pass. Ins" now wraps like "Pass. Perc" did | Tile is a column with the number pinned to the foot; all three level |
| Wizard ruleset bar | "Coming Soon" pill broke in two at 320 | `nowrap` pill; the bar wraps it to its own line |
| Wizard review stats / score tabs | "Prof Bonus" wraps at desktop too; tabs uneven | Values pinned to the foot (all at one y); tabs stretch to one height |

`--sheet-tabbar-h` stays 52px: the tab font (13px) was not touched and the bar measured 52px at
320 / 375 / 414 after the change, so the dice launcher and toast clearance are unchanged.

**Also fixed (own commit):** the wizard's "Origin Feat" eyebrow (opacity 0.75) and review
section titles (0.8) faded `--gold` to 3.37:1 and 4.04:1 in vellum; full-strength `--gold` now.

**Gates.** `check:tokens` OK (1247 `var()` uses), `check:contrast` 135/135, `ng test` 993/993,
Cypress 4/4 specs (10 tests, on the merged branch), production build 448.89 kB initial (budget
497 kB; ~445 kB before, the rest is `develop`'s followers feature). Computed contrast of every
changed label on every reachable surface: midnight ≥ 5.16:1, candlelit ≥ 5.29:1, vellum ≥ 4.3:1
— the two vellum cases below are pre-existing colour-token issues, not caused by size.

**Deliberately left:**
- Two vellum contrast misses on lifted labels, both colour tokens (slice-1 territory): the
  dashboard's "Invite" eyebrow on the invite chip, 4.4:1 (already recorded in slice 1), and the
  settings dice-style `.seg-mini button.active` ("digital"), `--gold` on a gold tint, 4.3:1.
- Wraps that predate this slice and were not made worse in kind: wizard score-method tabs at
  phone widths ("Roll Dice Soon" over four lines, as before; tabs 3px taller), "Prof Bonus" in
  the review strip at 320–414, the role switch's two-line "Dungeon Master".
- Three uppercase **Newsreader** micro-labels (`.detail-label`, `.review-label`,
  `.species-traits-header`) at 0.06–0.07em: the ladder rule is written for Cinzel, and moving
  them onto the Cinzel label role is a typeface change, not a size fix.
- Sizes of 11px and above that sit off DESIGN.md's documented ramp (12px, 14px, the `0.7x rem`
  sizes in the curated lists and level-up): not below the floor, so not in this slice. The px →
  `--text-*` migration covered only the declarations this slice touched.
- The renown panel styles itself with literal colours (`#181b19` ground, `Georgia` headings)
  outside the token system; only its eyebrow size was in scope.

**Not covered:** the level-up modal's `.slot-lvl` and the session spell-reference card's `dt` /
`.tag` (demo data opens neither; checked in source only: both are 11px now); the spellbook in the in-app browser (viewport-deferred while the pane was hidden; the
Cypress `sheet-spell-groups` screenshot shows the 11px `PREPARED` chips at 1280px); real devices.

#### Harden results (2026-11-17)

Branch `fix/harden-feedback`, cut from `develop` at `9f3b230` (Demon Hunter merge). `doctor`
ran first: no `auto` fixes; it mentions the stale `.impeccable/design.json` sidecar (refresh with
`/impeccable document`) and an unset `buildPath` (no choice to record without image generation).
`/impeccable harden` drove the work, scoped to ranks 16–17 only. Every finding was re-read on
`develop` before fixing: none had been fixed in the meantime, and three session failures (open a
PC's sheet, start / end encounter) already toasted, so they only moved onto the new helper.

**Rank 16 — silent failures.** `develop` had 62 `console.error` calls; 56 were failures the user
never saw, plus End Session and Leave, which logged nothing and **exited the screen even when the
server refused** — the DM saw the session end while players were still in it.

| Area | Sites | What the user now gets |
|---|---|---|
| Curated encounters / loot / shops | 24 | A toast for create, open, notes, add, remove, price, coins, import category, copy, delete. A failed **list load** shows "Could not load … Try again" with a retry button instead of "No … yet". A failed **coin pile** or **price override** puts the field back to the saved value (the notes draft is kept). |
| Dashboard | 10 | Session notes (load with retry, add, edit, delete), week editor, party binding, start session, delete campaign (dialog stays open to retry), create campaign, opening a hero whose full sheet failed (says edits may not save). |
| Sheet | 9 | Sheet saves, level-up grant, feature / spell / language / item grants, inspiration, follower save (already reverted, now says so) and dismiss, character notes, character delete. The sheet renders from the server-confirmed character, so no optimistic value is left behind. |
| Session | 13 + End / Leave | Initiative, HP, XP, XP to all, inspiration, add enemy, remove, visibility, turn sound, advance turn, session note, AC after a sale, the shared roll log. The initiative box and both selects go back to the saved value. End Session / Leave stay on screen on failure ("It is still running — try again"); a 404 / 409 (already gone) still exits. |

One helper, `NotificationService.error(fallback, err)`: shows the server's own message for a 4xx
that carries one (e.g. "Unknown catalog keys: …"), otherwise the fallback, which names what did
not happen and the recovery. 5xx bodies and offline (status 0) never reach the toast. It still
logs, and holds 6 s instead of 4. No new toast pattern; the existing one carries an always-present
`role="status"` region, so every error is announced.

**Left on `console.error` on purpose:** the three background loads in services — the campaign
list, the PC list and the 2 s session poll. They are not saves or actions, and a poll that
toasted on every blip would bury the table in noise. A failed initial PC or campaign load still
reads as an empty roster; that belongs with the empty-state work in slice 4 (rank 27).

**Rank 17 — unguarded destructive actions.** The app had two confirm patterns (the crimson
`<app-modal>` alertdialog for character and campaign delete, and the followers panel's inline
"Dismiss for good / Keep"). The modal one fits a one-tap delete, so it became **one shared
confirm**: `ConfirmService.confirm({...})` opens a crimson `alertdialog` rendered once at the app
shell (`ConfirmHostComponent`), on the slice-2 shell — Escape, focus-in, Tab trap, focus return.
Cancel is first, so focus lands on it and Enter on a fresh dialog never destroys anything; Escape,
the ✕ and the backdrop all cancel; one open at a time. Now guarded:

| Action | Where | Confirm copy (subject + message) |
|---|---|---|
| Delete encounter | dashboard | *name* "will be erased along with its N combatants. This cannot be undone." |
| Delete loot list / shop | dashboard | *name* "will be erased along with its items and coins / stock and prices." |
| Delete session note | dashboard | *“opening 60 characters…”* "will be erased from the session notes." |
| End Session | session | "The session closes for everyone…" — **Keep Playing** / End Session |
| End Encounter, remove a player | session | were `window.confirm`; now the same dialog (Keep Fighting; enemies still remove without asking) |

Removing a single creature, loot line or shop item stays one tap: each is cheap to re-add, and a
confirm there would cost more than it saves.

**Demo-mode verification** (in-app browser, `localStorage.demoMode='true'`, DM view). Demo mode
already rejects most curated writes, which exercised the real paths; the rest were forced by
swapping one service method for a failing observable through `ng.getComponent` in the dev build.

| Path | Result |
|---|---|
| Create encounter (demo rejects) | Toast + live region "Could not create the encounter. Try again."; typed name kept; Create re-enabled |
| Open encounter (demo rejects) | "Could not open that encounter. Try again." |
| Delete encounter → backdrop / Cancel | Dialog closes, encounter still open |
| Delete encounter → confirm, forced 500 with a Java message | Toast shows the fallback, not the server text; editor stays open |
| Loot list load, forced offline | "Could not load the loot lists. TRY AGAIN" in place of the empty state; retry restores it |
| Shop price override, forced 500 | Field back to its saved (empty) value + toast |
| Delete note → Escape | Closes, note kept, focus back on that note's ✕; confirm deletes it |
| End Session → Tab ×3 | Focus cycles Keep Playing → End Session → ✕ → Keep Playing (trapped) |
| End Session → Keep Playing | Focus returns to End Session; session still live |
| End Session → confirm, forced 503 | DM stays on the session screen; "Could not end the session. It is still running — try again." |
| Initiative box / visibility select, forced 500 | Back to 4 / "hidden"; toast names the combatant / action |
| Remove Lyra → Escape | Dialog "Lyra Moonwhisper leaves the session…", row kept |
| End Encounter → Keep Fighting, then confirm | Stays active, then back to the lobby |
| Confirm at 375px in vellum and candlelit | 345px wide, no horizontal scroll, Cancel focus ring visible |

**Gates.** `check:tokens` OK (1365 `var()` uses), `check:contrast` 135/135, `ng test` 1177/1177
(two full runs; a first run made in parallel with a production build had one unnamed failure that
did not recur), Cypress 5/5 specs (12 tests) against the branch, production build **449.07 kB**
initial (budget 497 kB). New specs: the error helper, the confirm host (render, focus, every cancel
route, one-at-a-time), cancel paths for every guarded delete, End Session / Leave failure and the
field revert paths.

**Not covered:** the Leave failure and the dashboard's party-binding / start-session failures were
checked by spec only (demo mode cannot refuse them); real backend 4xx bodies (the helper reads
`error.message`, as the loot and shop panels already did); real devices. The pre-existing NG8107
warning in `initiative-panel.component.html:97` is from `develop`.

#### Slice 6 results (2026-11-18)

Branch `chore/ui-density-polish`, cut from `develop` at `b856e6f` and merged with `develop` at
`3cfa722` before reporting. `/impeccable quieter` drove the glow pass and `/impeccable polish` the
level-up dialog. Scope follows the owner's decisions: polish-sized, with the session prep/play
split (rank 21) left out as its own feature. Measured in demo mode with transitions off.

| Rank | Finding on `develop` | Fix | Measured after |
|---|---|---|---|
| 22 | Glows at rest on dialogs, the settings slide-over, the login card / mark / name, brand marks, the empty-state sigil, large portraits, the sheet and campaign title, the role switch, skill dots, spent slots, supply and inspiration pips, the dice launcher | Removed. Dialogs, the slide-over and the launcher keep their ambient shadow. Owner decision 1 (login) is done here. | A computed-style scan of the sheet (5 tabs), dashboard, session, drawer, settings and login finds one glowing element class: `.btn.primary`, the sanctioned standing glow |
| 22 | Selected options glowed too: theme swatch, the wizard's class / equipment picks, the grant's class pick (one of them celestial), and the roster / campaign active-row markers | Removed; each already marks selection with a border and fill, or a 2px bar | Same scan |
| 24 | 65 corners outside the scale (6–20px) across session panels, curated editors, level-up, spell carousel, banner, toast | By role onto `--radius-*`: 36 controls → 2px, 24 cards and rows → 3px, 4 chips / counts → pill, the context-help dialog → 4px. The d6 die keeps its 8px face. | 0 elements with a non-pill radius of 5px or more on those screens; detector `design-system-radius` 0 |
| 24 / modals P1 | Level-up spoke its own dialect: Arial tabs and steppers, 13px body-serif labels, a commit button restyled inline (which also hid its disabled state), a side-stripe on gained features, an inner frame that scrolled across the ability rows | Cinzel Label style for tabs and section labels, numeric face for steppers, `.btn.primary` commit, tinted hairline, inset-shadow frame. Spell-picker names no longer centre over left-aligned details (a global `.spell-row` phone rule leaked in). | Tabs and labels compute to Cinzel 11px / 0.18em; every label and tab on one line at 375px; picker rows 56px tall |

**Deliberately left:**
- Rank 21 (prep inside play, dashboard grouping) — out of Phase 3 by owner decision 2.
- State glows stay: focus, hover, the live turn and on-deck rows, the turn vignette, the level-up
  prompt, ready-to-level XP, the "Inspired" badge.
- The session screen shows three `.btn.primary` at once, so the one standing glow appears three
  times there. That is a hierarchy question for the prep/play feature, not a glow bug.
- Copy and the remaining literal status colours belong to slice 4.

**Gates.** `check:tokens` OK (1454 `var()` uses), `check:contrast` 135/135, `ng test` 1321/1321,
Cypress 6/6 specs (13 tests; run before and after the `develop` merge), production build
448.46 kB initial (budget 497 kB). The detector reports no `design-system-radius` finding on the
changed files; its two findings on added lines are the dialogs' black ambient shadow.

**Not covered:** real devices (Chromium emulation only); the wizard's later steps and the session
banner were not opened in a browser for this slice (their changes are a removed `box-shadow` or a
radius token); the phone-width look was checked at 375px only, since no layout rule changed outside
the level-up dialog.

#### Slice 4 results (2026-11-18)

Branch `chore/ui-copy-clarify`, cut from `develop` at `64bf24a` and merged with `develop` three
times before reporting: at `571fcd7` (World of Warcraft Warlock and Warrior, the Give item modal,
locked class features), at `5bfff8f` (ELI5 spell summaries) and at `02d80ba` (the owner's own
filler-copy removal, the phone login fit and starting gear in the inventory). The first two were
clean; the third had one conflict, the character sheet's `imports` list, resolved as `develop`'s
list plus the help component. The owner's copy commit (`a4a5f77`: placeholders removed from the
sign-in fields, "Inscribe" → "Create") touched none of the strings below, and the sign-in card
still fits a 375×667 screen without scrolling with the longer reset line. `/impeccable clarify` drove it; `doctor` ran first and reported no `auto` fixes,
only the two usual `mention`s (the stale `.impeccable/design.json` sidecar, which
`/impeccable document` refreshes, and an unset `buildPath`, which needs no answer without image
generation). Every item was re-read on current `develop` before it was changed. Checked in demo
mode at 375px (touch emulation) and 1280px.

**What the recheck found.** The password rule in `authentication-service` (read, not changed) is 8
characters on reset and change-password and **nothing at all on register**; the register form
asked for 6. Reset links are behind `hasAuthority('ADMIN')`. Several items had moved since Phase 2:

| Phase 2 finding | State on `develop` | Action |
|---|---|---|
| "Inscribe Your Name", "Forge a Hero", "No hero selected" | Already plainer after #236: "Create Account", "Create Character", "No Character Selected" | Followed; no in-world label was changed back or added |
| "No heroes match that name." with no query | Reworded to "No characters match that name." but still shown for an empty roster | Fixed |
| "Choose a name from the chronicle" on a phone | The sentence was gone, leaving the empty state with no instruction at all | A sentence per screen size |
| Register fields unlabelled | Name, email and username bound; the two password labels were not | Bound |
| Encumbered penalty in a tooltip | Already printed under the inventory header | None |
| Enter submits login twice (rank 7) | Fixed | None |

**Before / after.**

| Where | Before | After |
|---|---|---|
| Register, password | placeholder "Min. 6 characters"; form accepted 6 | visible hint "At least 8 characters."; form asks for 8 |
| Register, second field | label "Confirm" | "Confirm password" |
| Reset and change password | placeholder "At least 8 characters" | the same rule as a hint under the field |
| Login footer | "Forgot your password? Ask your DM for a reset link." | "Forgot your password? Ask a Table Mimic admin for a reset link." |
| Reset link errors | "… ask your DM for a new one." | "… Ask a Table Mimic admin for a new one." |
| Login failure | "Invalid username or password" (also shown when offline) / "Login failed. Please try again." | "Could not sign you in. Check your username and password, then try again." |
| Register failure | "Registration failed. …" | "Could not create your account. …" |
| Admin reset form, any failure | "No user named “x” was found." | "Could not make a reset link for “x”. Check the username and try again." |
| Spell slots (player) | pips only, filled = spent, tooltip "Slot expended" | "3 of 4 left" beside the pips; pips hidden from assistive tech |
| Spell slots (DM) | "1 / 4" | "Spent 1 / 4" |
| Spellbook at the prepared cap | every Prepare disabled, reason in each button's tooltip | "All 5 prepared spells are in use. Unprepare one to prepare another; cantrips are always ready." |
| DM edit, value field | label "Current Hp"; no hint | "New current HP"; "Now 42 of 52. Enter the HP they end up with, not the amount: for 5 damage, enter 37." and a live "That is 7 damage." |
| DM edit, log field | "Log entry (leave blank for the automatic one)" over a field already holding it | "Log entry" + "Written for you. Change it to say why, or keep it as it is." |
| Conditions panel | exhaustion and inspiration rules in two hover tooltips | one "?" in the panel header with both rules (the DM also reads how to set the meter) |
| Level Up, disabled | reason in a tooltip a disabled button never shows | "?" beside it: "Not enough XP yet. Reach 34000 XP, or ask your DM to grant a level." |
| Spend Hit Die, none left | disabled "Spend Hit Die (1d8+CON)" | "No Hit Dice left" |
| Survival panel | stage rule in a tooltip on the exhaustion badge | "?" in the header |
| Supplies panel | "each container holds 5" in a tooltip | "Each container holds 5 servings. To carry more, buy another container." |
| Inventory, a stack | "Drop" (drops all of it) / "Give" | "Drop all" / "Give all" |
| Dashboard chips | "Invite" and "Clock" with hover tooltips | "Invite code" and "Clock", each with a "?" |
| Party board, nobody joined | "No heroes assigned to this campaign yet." | adds the invite code, where players enter it, and how arrivals show up |
| Session, player's Short Rest | what it does and why it is disabled in a tooltip | "?" beside it with the same text |
| Session, DM clock | three button tooltips | one "?" (names the survival cost of advancing time only in a survival campaign) and a hint under the date fields |
| Rest vote, DM | "… unanimous yes passes." | adds "Allow the rest and Deny both end the vote now, without waiting for the remaining votes." |
| Loot split, DM | "Force it through" / "Cancel loot" explained by tooltips | the same explanation as a line under the buttons |
| Hidden enemy health | "—" with a tooltip | "Hidden" |
| Dice roller | "Drag dice into the field, …" | "Tap or drag dice into the field, …" |
| Roster, no characters | "No characters match that name." | "You have no characters yet. Create your first one below." (a failed search: "No characters match that search.") |
| Roster or campaign list failed to load | looked empty | "Could not load your characters / campaigns." with Try again |
| DM campaign list, none | blank rail | "No campaigns yet. Start one with New Campaign below." |
| Campaign row, nobody in it | "0 heroes · no heroes" | "No heroes yet" (and "1 hero", not "1 heroes") |
| No Character Selected | title and a button only | desktop "Pick a character from the list on the left, or create a new one." · phone "Open the menu at the top left to pick a character, or create a new one." |
| No Campaign Chosen | "Select a campaign from the chronicle …" (nothing on screen is called the chronicle any more) | the list on the left on desktop, the menu on a phone |
| Session banner picker, no eligible character | "None of your heroes are seated at this campaign yet. Join the campaign first." | says where Join Campaign is and to come back |
| Joining a session | "Join Session" → "Join the Session" → "Take the Field" | the confirm button is "Join Session"; "takes the field" stays in the sentence above it |
| Join dialogs | field "Character", option "Choose a hero…" | "Choose a character…" |
| Fallback toasts for the clock, date, location, shop, loot, encounter loader, eat / drink, purchase, professions, renown, give item | "Could not advance the clock.", "Could not do that right now.", "Purchase failed.", "Please retry." | each names the action and ends with the recovery ("… Try again.") |

**The one change that is not copy.** Stating a single password minimum meant choosing one: the
register form's validator went from 6 to 8, the number the auth service already enforces on reset
and change-password. It is its own commit, so it can be dropped if the owner prefers 6 on register.
The two list services also gained a `loadFailed` signal, which the harden slice had deferred to
this one, so that "empty" and "failed to load" can read differently.

**How tooltips were handled.** A rule a player needs moved behind the existing `app-context-help`
button (5 uses → 12) or into plain text; tooltips that only repeat a visible label (Remove,
Quantity, Close, AC) were left alone. The help button is now a 28px circle with a 44px tap halo
on touch, so it fits beside pips, chips and buttons; at 44px it pushed the exhaustion pips onto a
second line, which is why that help sits in the panel header. Its dialog no longer inherits the
uppercase label styling of the row it sits in.

**Gates.** All re-run after each `develop` merge; these are the final numbers, on `02d80ba`.
`check:tokens` OK (1575 `var()` uses, no italics), `check:contrast` 135/135, `ng test` 1549/1549
(the first run after the first merge had one failure: a spec still asserting an old toast string,
updated), Cypress 7/7 specs (17 tests, including `develop`'s new `give-items` spec), production
build **450.30 kB** initial (budget 497 kB). New specs cover the DM
edit hints, the conditions and session help text, the register minimum and the roster's
load-failed state.

**Left on purpose.**
- In-world labels the owner has not changed: "Answer the Call", "Ascend a Level", "Strike From The
  Record", "Review Your Hero", "Enter in Demo Mode".
- Hero / character: the DM dashboard says "heroes" throughout and the player side says
  "characters". New copy follows the screen it is on. Whether to unify is the owner's call.
- "Connect" on the sheet does the same thing as the banner's "Join Session". Renaming it widens a
  button in the phone header row, so it is a layout question too.
- Two rules as shipped, where the 2024 Player's Handbook reads differently: Heroic Inspiration is
  described as "reroll any d20 Test" (2024: any die), and a tooltip says a Long Rest restores half
  the Hit Dice (2024: all). Neither was reworded or made more visible; the owner should confirm
  which the table plays.
- The session banner's wider findings (skip the picker with one character, "already seated") are
  behaviour, not copy.

**Follow-ups noticed, not fixed here.**
- `authentication-service` accepts any password length on register; the form is the only guard.
- The auth service folds a network failure into the same result as a wrong password, so sign-in
  cannot say which it was.
- `/reset-password` without a token still shows the whole form with a disabled button.
- The DM's Set date form overflows at 375px (the clock panel grows to 928px wide).
- The DM's survival and slot chips on the initiative board ("H3 T2 F1", "L1 3/4") are explained
  only by tooltips.
- The sheet name is renamed by double-click, which a touch screen cannot do.
- Error and success toasts still look identical (the critique's severity finding).

**Not covered.** Real devices (Chromium emulation only). Demo mode does not reach the player's
session screen, the survival or supplies panels, the rest-vote dialog, the loot split or a spell
list at its prepared cap; those strings were checked in the template and by spec. The session
banner's picker was forced open through its component. Only midnight was looked at as a whole
page; the three themes were checked by computed contrast for the new text with transitions off
(spell-slot count 8.5:1 or better, field hints 6.1:1 or better, empty-state sentences 5.8:1 or
better), since every new style uses existing tokens.

---

## 11. Phase 4 results — the design scan in CI (2026-11-20)

Branch `chore/impeccable-ci-gate`, cut from `develop` (`9af2ce7`). Phase 4 is the "keep it" phase:
nothing in the app changes. It adds a report that runs on every pull request, so the problems
Phases 1 to 3 removed are noticed if they come back.

### What was built

| Piece | File | What it does |
|---|---|---|
| The scan | `scripts/impeccable-scan.js` (`npm run scan:design`) | Serves the production build, opens a headless Chrome, clicks the real "Enter in Demo Mode" button, walks 20 screens and runs the impeccable detector on each one. |
| The element allow-list | `scripts/impeccable-allowlist.json` | House patterns the detector reports and that are deliberate, each tied to one element and one reason. |
| The font allow-list | `.impeccable/config.json` | Cinzel, Newsreader and JetBrains Mono added to the detector's own ignore list. |
| The CI job | `.github/workflows/ci.yml`, job `design-scan` | Runs the scan on pull requests only. Advisory: it cannot fail a pull request. |

The scan needs nothing installed beyond Node and Chrome. It talks to Chrome over the DevTools
protocol with Node's built-in WebSocket, so there is no new dependency and `package-lock.json`
is untouched. The only thing it downloads is the detector, pinned to an exact version:
`npx impeccable@4.8.0` (the version the skill on the owner's machine was installed from), which
in turn pins its engine binary to `0.1.18`. `4.10.0` was published on 2026-11-18 and was not
adopted; to upgrade, change `IMPECCABLE_VERSION` in the script, run the scan and compare counts.

**The 20 screens.** Signed out: login, register, reset-password. Player: the empty roster, all
eight sheet tabs (Sheet, Spells, Inventory, Renown, Followers, Professions, Notes, Log), the
settings panel, the dice roller, the wizard's first two steps. DM: the campaign list, the
campaign dashboard, a session before combat, and a session with an encounter running (the
screen with the whose-turn row). Each screen starts from a fresh page load, so one screen
failing to open cannot break the next.

### Three things that differ from the plan in §4

1. **`detect <url>` cannot do this job; `detect --cdp` can.** Flags were read from
   `npx impeccable@4.8.0 detect --help`, not from the plan. `detect <url>` opens its own clean
   browser, so it only ever sees the login page. `--cdp <port>` attaches to a browser that is
   already open and scans the page exactly as shown, which is what lets the script sign in
   through demo mode first. Exit codes: 0 clean, 2 findings, 1 could not scan.
2. **`--github` exists but its output is not usable here.** For a page scanned this way every
   annotation reads `file=http://127.0.0.1:<port>/charactermanager`: the same address for every
   signed-in screen, with no screen name and no element. GitHub also shows at most 10 warnings
   per step. So the script reads the findings as `--json` and writes the annotations itself:
   one per rule, naming the element and the screens, with the full table in the job summary and
   the raw findings uploaded as the `impeccable-scan` artifact.
3. **The detector's ignore list cannot allow-list an element.** `npx impeccable ignores
   add-value dark-glow "#d4b06a"` answers "dark-glow has no extractable ignore value". The only
   thing it offers for such a rule is a per-file ignore, and every signed-in screen is one URL,
   so that would switch the rule off everywhere, including for the glows worth catching. That
   is why the element allow-list lives in our script: after each scan it looks up the element a
   finding points at, in the live page, and drops the finding only if that element is (or sits
   inside) an allow-listed one.

### Finding counts, before and after

One build of `develop` (`9af2ce7`), 375x812, midnight theme, 20 of 20 screens scanned. "Raw" is
the detector with `.impeccable/config.json` and the element allow-list both off. "With config"
is what the detector reported before this branch (the config only ignored
`radial-spotlight-glow`, since Phase 1). A count is one finding on one screen, so an element
that is on eight sheet tabs counts eight times.

| Rule | Raw | With config (before) | Allow-listed | Reported (after) |
|---|---|---|---|---|
| `nested-cards` | 32 | 32 | 29 | 3 |
| `radial-spotlight-glow` | 21 | 0 | n/a | 0 |
| `dark-glow` | 21 | 21 | 21 | 0 |
| `kicker-above-heading` | 9 | 9 | 9 | 0 |
| `low-contrast` | 9 | 5 | 0 | 5 |
| `undersized-ui-text` | 6 | 6 | 0 | 6 |
| `tiny-text` | 3 | 3 | 0 | 3 |
| `straggler` (advisory) | 2 | 2 | 0 | 2 |
| `wide-tracking` | 1 | 1 | 0 | 1 |
| `low-contrast` (advisory) | 1 | 3 | 0 | 3 |
| `overused-font` | 0 | 0 | 0 | 0 |
| **Total** | **105** | **82** | **59** | **23** |

**82 before, 23 after.** The 23 are 13 distinct elements, all on rules that were meant to stay
on. The raw and with-config columns are two separate scans run side by side; `low-contrast`
differs between them (10 against 8 in total) because the detector measures button text by
pixel on a gradient and the reading moves from run to run (see "Not covered").

`overused-font` is zero in every column. Version 4.8.0 does not flag Cinzel, Newsreader or
JetBrains Mono on a rendered page even with all config off, so the three font entries change no
number today. They are there because the plan asked for them and because they cost nothing if a
later detector version starts flagging them.

### What is allow-listed, and why

In `scripts/impeccable-allowlist.json`, by element:

| Rule | Element | Why it is deliberate |
|---|---|---|
| `dark-glow` | `.btn.primary` | The One Standing Glow: the primary button keeps its gold glow at rest (DESIGN.md, Elevation). |
| `dark-glow` | `.board-row.current-turn`, `.board-row.on-deck` and what is inside them | Whose turn it is and who is next on the initiative board. A glow that shows state is what DESIGN.md allows. |
| `dark-glow` | `.turn-vignette` | The edge-of-screen cue shown only while it is this viewer's turn. Not named in §10; added because it is the same turn signal. |
| `kicker-above-heading`, `hero-eyebrow-chip` | `.eyebrow` | The house eyebrow label above a page title. The second rule is the same element as the detector names it at desktop width. |
| `nested-cards` | `.ability`, `.coin`, `.note`, `.board-row`, `.board-num` inside a `.panel` | Stat tiles, coins, notes and board rows are bordered cells inside a panel: the house panel-in-panel layout. |

In `.impeccable/config.json`, by rule or value: `radial-spotlight-glow` (the page background
washes, since Phase 1) and `overused-font` for the three brand faces.

No rule was switched off to do this. A glow on anything other than those elements, an eyebrow
that is not `.eyebrow`, or a new card nested in a panel is still reported. That was checked by
the scan itself: two cards added to `develop` since 2026-11-18 (`div.rc`, the class resource
counters, and `section.sst`, the spell-slot strip) are nested cards that are not on the list,
and both are in the report below. Whether they join the list or change is the owner's call.

### What the scan reports today (not fixed here)

| Rule | Element | Screens | Note |
|---|---|---|---|
| `undersized-ui-text` | `.spell-tag` "prepared", 10px (3 elements) | sheet | Below the 11px floor that `chore/type-floor` set. `_prepared-spell-list.scss:103`. |
| `nested-cards` | `div.rc` | sheet | New since 2026-11-18. |
| `nested-cards` | `section.sst` | sheet, Spells tab | New since 2026-11-18. |
| `low-contrast` | `.btn.play` "Connect" | five sheet tabs | Read as 3.0 to 4.4:1 across runs; needs 4.5:1. Not checked by hand. |
| `low-contrast` | `.btn.danger` "End Session" | session | Read as 3.1 to 3.9:1. Not checked by hand. |
| `low-contrast` (advisory) | `.btn` "Manage Party" | campaign dashboard | 4.2:1. |
| `tiny-text`, `wide-tracking` | `span.spell-dc`, 11px at 0.06em | sheet, Spells tab | |
| `tiny-text` | `.note-time`, 11px (2 elements) | campaign dashboard | |
| `straggler` (advisory) | `p.combat-log-note` | session | One word alone on the last line. |

The same scan on `develop` two days earlier (`7310342`, 2026-11-18) found 73. The 82 commits
since then added nine: the 10px tags, the two new nested cards and the straggler. That is the
case for keeping the scan: none of those would have failed `check:tokens`, `check:contrast` or
a unit test.

### The CI job

`design-scan` in `ci.yml` runs on `pull_request` only (not on pushes to `develop` or `main`,
and not at deploy time). It installs with `npm ci`, builds the production bundle, and runs
`node scripts/impeccable-scan.js --github --json impeccable-scan.json`. It runs beside the
existing jobs, so it adds no time to them; the scan itself took about 3.5 minutes locally.

It cannot fail a pull request, in three layers:

1. the script always exits 0 (checked: findings, a screen that cannot be reached, and a
   missing build all end in exit 0 with a warning);
2. the install, build, scan and upload steps are each `continue-on-error`;
3. the job is `continue-on-error`, so even a failed checkout cannot fail the workflow.

**Verified on GitHub (2026-11-20).** The job first ran on pull request #281 (run 44817639574,
commit `19f1971`). On the Linux runner Chrome started and the detector's Linux engine binary
ran: 20 of 20 screens scanned, 80 found, 59 allow-listed, 21 reported, in 2 minutes 26 seconds,
next to a 1 minute 46 second build-and-test job. The allow-listed count matches the Windows
measurement exactly. The two missing findings are advisory `low-contrast` readings, which vary
from run to run. GitHub recorded six annotations, one per rule (five warnings and one notice),
and the `impeccable-scan` artifact was uploaded. The job summary page was not looked at in a
browser. Do not make this job a required check.

To run it locally:

```powershell
npm run build -- --configuration production
```

```powershell
npm run scan:design
```

`npm run scan:design -- --no-allowlist` shows the house patterns too, `--theme vellum` and
`--viewport 1280x800` change the pass, `--only sheet,session` limits it to named screens.

### Recommendation 1: leave the design hook off

The hook (`/impeccable hooks on`) runs the detector on each source file an agent edits and
pushes the findings back into the session as a correction. The recommendation is to keep it
off, for these measured reasons:

- **It reads source files, and source files are where the detector is weakest in this app.**
  `npx impeccable@4.8.0 detect src/` today returns 359 findings in 130 files: 183
  `design-system-color`, 164 `design-system-font-size`, 8 `design-system-radius`, 3
  `design-system-font`, 1 `side-tab`. 79 of the colour findings are "text color rgb(0, 0, 0)"
  on an Angular template, which is the detector reading a template without its component
  stylesheet: false positives. 67 of the size findings are `font-size: 12px`, a size DESIGN.md
  now names for field labels. With the hook on, almost every UI edit would come back with a
  correction prompt about something that was already there and is mostly not wrong.
- **None of what the rendered scan finds shows up in a source scan.** The rules behind all 82
  rendered findings (`nested-cards`, `dark-glow`, `kicker-above-heading`,
  `undersized-ui-text`, `low-contrast`, `tiny-text`, `wide-tracking`, `straggler`) appear zero
  times in the 359. The hook would not have caught the 10px tags or the new nested cards.
- **It cannot use the element allow-list**, for the reason in "Three things that differ" above.
- **It is on for everyone at once.** `hook.enabled` lives in the shared
  `.impeccable/config.json`, and this repo routinely has several sessions working in parallel
  worktrees. §4 also notes that a command hook runs even when the session denies the model's
  own commands.

Refreshing the design sidecar (below) did not change this: the source scan gave 359 before
and 359 after.

If the owner wants it anyway, the order is: first get the source scan quiet (a file-scoped
ignore for templates, `npx impeccable ignores add-value design-system-color "*" --file
"src/**/*.html"`, and a decision on the 164 size findings), then `/impeccable hooks on`. That
clean-up is its own chore, not part of this branch.

### Recommendation 2: make Build & Deploy wait for CI

Today `deploy.yml` starts on every push to `main`, at the same moment as `ci.yml`, and does not
look at its result. The recommendation is to make the deploy start only after CI has passed on
that commit.

The evidence, from `gh run list --branch main` (60 CI runs on `main` since 2026-11-17):

| When (UTC) | Commit | CI | Build & Deploy |
|---|---|---|---|
| 2026-11-18 04:44 | `ecb8032` | cancelled | success |
| 2026-11-18 16:09 | `1a120f8` | cancelled | success |
| 2026-11-18 16:45 | `dc63f65` | **failure** | success |
| 2026-11-18 21:32 | `1da6b26` | **failure** | success |
| 2026-11-19 02:54 | `9625b98` | **failure** | success |
| 2026-11-19 13:17 | `b23013e` | cancelled | success |

Six commits in four days reached production without a green CI run: three with CI red, three
whose CI run was cancelled by the next push before it finished. `1da6b26` is the release named
in the hand-over notes (two unit specs broken by crossed feature branches). Merges into
`develop` and `main` are made directly, without pull requests, so nothing else stands between
a red commit and the live site.

The cost is small: over the last 20 runs on `main`, CI took 1.5 to 3.0 minutes and the deploy
about 1 minute, so a release would land roughly 2 to 3 minutes later than it does now.

The shape of the change, for `deploy.yml` (not applied; this is the owner's decision):

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    if: >
      github.event_name == 'workflow_dispatch' ||
      (github.event.workflow_run.conclusion == 'success' &&
       github.event.workflow_run.event == 'push')
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
```

What to know before choosing it:

- `workflow_dispatch` stays as the manual override, for the day a flaky test blocks an urgent
  release. The Cypress job has been broken before (it was repaired on 2026-11-14), so the override matters.
- When two pushes land close together, CI cancels the older run (`cancel-in-progress`). The
  older commit is then not deployed by itself; the newer one, which contains it, is. That is
  the right outcome, and it also ends the "cancelled but deployed" rows above.
- The `design-scan` job cannot hold a deploy back: it runs on pull requests only and never
  fails.
- The deploy role trusts the `production` environment, not the trigger, so the AWS side does
  not change.
- It cannot be tried without merging to `main`. The first release after the change is the test;
  watch that one.

### The stale design sidecar

`/impeccable doctor` was run first, on 2026-11-18, and reported three findings, none of them
ones it repairs by itself:

| Finding | Kind | What it said |
|---|---|---|
| `design-sidecar-stale` | mention | `DESIGN.md` was edited after `.impeccable/design.json` was generated (2026-11-10). Fix: `/impeccable document`. |
| `design-md-drift` | route | 35 commits had touched `src` since `DESIGN.md` was last edited. A count of commits, not a list of contradictions. |
| `config-build-path-unset` | mention | No `buildPath` recorded. It only matters for landing pages built from a generated image, which this app does not have. Nothing to do. |

The sidecar is the machine-readable companion to `DESIGN.md`: colour ramps, shadows, motion and
breakpoints, and small HTML/CSS samples of the components. The `document` playbook has a
sidecar-only path ("preserve `DESIGN.md` and write only `.impeccable/design.json`"), so it was
refreshed here, on its own commit. `DESIGN.md` is byte-identical. What changed in the sidecar:
all 20 colour tokens described, per-theme shadow and glow values, body text recorded as always
upright, the field-label exception, the one standing glow, motion entries from 3 to 7,
component samples from 7 to 11 (danger button, dialog, sheet tabs and the context-help button
added; none uses italic). It grew from 15 kB to 28 kB.

`doctor` after the refresh: `design-sidecar-stale` is gone. `design-md-drift` is gone too, but
only because `DESIGN.md` was edited on 2026-11-20 by another change, which reset the commit
count. `config-build-path-unset` remains and needs nothing.

Rebuilding the sidecar meant reading `DESIGN.md` against `src/styles.css`, and that turned up
places where the two disagree. These are listed, not fixed; the first one was re-checked by
grep and matches what the scan reported:

- **The type floor has slipped.** `DESIGN.md` says no font size below 11px remains in `src/`.
  Seven declarations are below it: `features-list.component.scss:141`,
  `hero-class-panel.component.scss:100` (9.5px) and `:171`, `_prepared-spell-list.scss:75` and
  `:108`, `class-step.component.scss:132`, `level-up-modal.component.scss:417` (0.68rem).
  `check:tokens` has no rule for this, which is how it came back.
- `.modal` and `.login-card` use a literal `0 30px 80px` shadow, not the `--shadow` token
  `DESIGN.md` documents (`src/styles.css:1338`, `:1665`).
- `--glow` (the celestial "live" glow) is defined but nothing in `src/` uses it, although
  `DESIGN.md` describes it as in use.
- `DESIGN.md` says radii are still raw px; component styles now use `var(--radius-*)`, while
  `.btn`, `.panel` and `.field input` in `styles.css` do not.
- Reported by the refresh and not re-checked here: drop shadows on `.vitals`, the dice button,
  the spell carousel and toasts; a crimson glow on an active condition chip and on a ready XP
  bar; `.btn` rendering at weight 400, `.panel-title` at 600 / 12px / 0.22em and `.modal-title`
  at 600 / 0.12em against the Label and Title roles; HP in Cinzel, not JetBrains Mono; extra
  breakpoints (1100, 720, 600, 520, 360) beyond the four documented; the 260px rail that the
  820px drawer breakpoint never lets appear.

None of these is a detector finding, so the CI scan will not track them. They are the input
for the next `/impeccable document` conversation, where the owner decides, line by line,
whether the document or the code is right.

### Gates

`npm run check:tokens` OK (1897 `var()` uses, no white-alpha literals, no italics),
`npm run check:contrast` all combinations pass, `ng test` 2879 of 2879, production build
succeeds. No file under `src/` changed on this branch.

### Not covered

- **The failure path on GitHub.** The scan has run there once and worked (see "Verified on
  GitHub" above). What a crashed scan looks like on GitHub was only proven locally.
- **One theme, one width.** CI scans midnight at 375x812. The `--theme` and `--viewport`
  options work (a vellum sample and a 1280x800 sample were run on three screens each), but the
  job does not use them; all three themes at two widths would be about 20 minutes. The desktop
  sample found rules the phone pass does not: `gray-on-color` on the active roster and
  campaign rows, `line-length` on sheet prose. Token contrast across themes is still
  `check:contrast`'s job.
- **Screens the walk does not open:** the level-up dialog, item composer, spell picker and DM
  edit dialogs, wizard steps 3 to 9, the player's view of a session, the rest vote, the loot
  split, the survival and supplies panels, the session-live banner and toasts. Demo mode
  cannot reach some of these at all (§10, Slice 4, "Not covered"); the rest need more click
  paths in `SURFACES`.
- **Pixel contrast readings move.** The same button read 3.0:1 on one tab and 4.4:1 on another
  in one run, which is the difference between a finding and an advisory. Treat a
  `low-contrast` finding on a gradient button as a prompt to measure, not as a measurement.
- **The scan's click paths are selectors into the app** (`.roster-item`, `.sheet-tab`,
  `.role-seg.dm` and so on). A rename makes that screen show as "not scanned" in the report;
  it does not fail anything, but someone has to notice and update `SURFACES`.
- **The findings in "What the scan reports today"** and the `DESIGN.md` disagreements under
  "The stale design sidecar" are listed, not fixed. The seven sub-11px declarations are the one
  worth a small branch soon, with a `check:tokens` rule so the floor cannot slip a third time.
