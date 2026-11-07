# Impeccable Adoption Plan — UI Improvement Pass

Plan for using [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`impeccable@4.8.0`,
Apache-2.0, published 2026-10-26 by `paulbakaus`, repo URL matches GitHub) to improve the
Table Mimic frontend.

> **Status: Phase 0 is done.** Installed 2026-11-07, global scope, no hooks. Several
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
