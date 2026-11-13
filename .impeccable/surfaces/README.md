# Phase 2 surface audits — how these were measured

`/impeccable audit` (technical, P0→P3) reports, one per surface. Run 2026-11-13 on `develop`
(`58c992f`). Reports only — no application code was changed. The ranked cross-surface backlog
is in `docs/impeccable-adoption-plan.md` §10.

## Method

- **Stack:** `ng serve` from this repo, opened in the Claude desktop app's built-in browser.
  The app's own **demo mode** (in-memory seed data, no backend, no credentials) reached every
  authenticated surface. Demo roster: Lyra Moonwhisper, Throk Ironjaw, Pip Underfoot; campaigns
  "The Veiled Compass" and "Tomb of the Sleeping Crown". The DM/player split was exercised by
  toggling the role.
- **Width:** every surface measured at **375×812** (The Phone Is The Table Rule). Desktop was
  looked at, not measured.
- **Themes:** every measurement run in **midnight, vellum and candlelit** by setting
  `[data-theme]` on `<html>`, with `*{transition:none!important}` injected first and a forced
  reflow after each switch (contrast-audit §5 trap 2).
- **Contrast:** colours resolved to sRGB through a canvas (§5 trap 1, so `oklch()` and
  `color-mix()` are real numbers). Backgrounds are composited up the ancestor chain, gradients
  resolved stop by stop (§5 trap 3). Results are split:
  - **definite** — fails against the solid ground alone. Only these are reported as findings.
  - **wash-only** — fails only if the faint body/main radial washes peak directly under the
    text at full strength, which they never do. Not counted. (An early version of the script
    counted these and produced exactly the kind of confident wrong number §5 warns about; it was
    caught and fixed before any report was written.)
  Every headline contrast failure below was re-checked by reading the element's computed
  colour and background directly.
- **Detector:** `impeccable detect` cannot log in, so its browser bundle (`detect.js`, engine
  v0.1.18) was injected into the signed-in page via `impeccable live-server` and run with
  `impeccableScanAsync()`. In-page runs do **not** apply `.impeccable/config.json`, so
  `radial-spotlight-glow` was filtered by hand. `/login` and `/register` (which redirect a
  signed-in visitor) were scanned with the CLI's clean browser at `--viewport 375x812`.
- **Touch targets:** WCAG 2.5.8 floor is 24×24 CSS px; 44×44 is the comfort target.
- **Static counts:** grep over `src/` (component `.scss`, `styles.css`, templates).

## Limits

- The session-live banner never renders in demo mode (no multi-client discovery) — source review.
- Survival / supplies panels and slot inventory only appear when a campaign enables those
  variants; neither demo campaign does — source review.
- Touch gestures (dice grab-and-throw) were not exercised under synthesized touch.
- No screen reader was run; semantics were read from the DOM.

## Files

| Surface | Audit score |
|---|---|
| [character-sheet](character-sheet.md) | 10/20 |
| [session-mode](session-mode.md) | 9/20 |
| [create-character-wizard](create-character-wizard.md) | 8/20 |
| [campaign-dashboard](campaign-dashboard.md) | 10/20 |
| [sidenav-roster](sidenav-roster.md) | 13/20 |
| [auth](auth.md) | 13/20 |
| [modals](modals.md) | 11/20 |
| [settings-panel](settings-panel.md) | 13/20 |
| [session-live-banner](session-live-banner.md) | 13/20 |
| [toasts-empty-states](toasts-empty-states.md) | 14/20 |
