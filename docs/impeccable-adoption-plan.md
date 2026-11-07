# Impeccable Adoption Plan — UI Improvement Pass

Plan for using [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (`impeccable@4.8.0`,
Apache-2.0, published 2026-10-26 by `paulbakaus`, repo URL matches GitHub) to improve the
Table Mimic frontend. Nothing has been installed yet — this document is the decision record
that precedes installation.

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
