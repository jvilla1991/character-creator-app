# Accessibility Pass — Notes (`chore/a11y-pass`)

Scope: high-value, low-risk fixes over the hand-rolled UI. No component-tree
restructuring, no Material dialog conversion, no color/contrast work.

## What was fixed

### 1. Modal dialog semantics + focus management

`A11yModule` (`@angular/cdk/a11y`) is now imported in
`src/app/charactermanager/charactermanager.module.ts`. Every hand-rolled modal
root got `role="dialog"` (or `alertdialog` for destructive confirms),
`aria-modal="true"`, an `aria-labelledby`/`aria-label`, plus `cdkTrapFocus`
`cdkTrapFocusAutoCapture` (traps Tab inside the modal, focuses the first
tabbable control on open, and restores focus on close):

| Modal | File | Role |
|---|---|---|
| Dice roller | `components/dice-roller-modal/dice-roller-modal.component.html` | `dialog` |
| Delete character | `components/main-content/delete-confirmation-modal/delete-confirmation-modal.component.html` | `alertdialog` |
| Level up | `components/level-up-modal/level-up-modal.component.html` | `dialog` |
| Create character wizard | `components/create-character-modal/create-character-modal.component.html` | `dialog` (`aria-label`, no single title element) |
| Create campaign | `components/create-campaign-modal/create-campaign-modal.component.html` | `dialog` |
| Join campaign | `components/join-campaign-modal/join-campaign-modal.component.html` | `dialog` (`aria-label`; title switches between invite/consent states) |
| DM edit number | `components/character-sheet/dm-edit-modal/dm-edit-modal.component.html` | `dialog` |
| Long rest confirm (inline) | `components/session-mode/session-mode.component.html` | `dialog` |
| Session PC picker (inline) | `components/session-live-banner/session-live-banner.component.html` | `dialog` |
| Manage party (inline) | `components/campaign-dashboard/campaign-dashboard.component.html` | `dialog` |
| Delete campaign (inline) | `components/campaign-dashboard/campaign-dashboard.component.html` | `alertdialog` |
| Settings slide-over | `components/settings-panel/settings-panel.component.html` | `dialog` |

Escape-close (`appEscapeClose`, document-level listener) is unaffected by the
focus trap and still works on the dice roller and level-up modals.

### 2. Icon-only / ambiguous control labels

- Dice roller `×` close → `aria-label="Close dice roller"`.
- `✕` remove buttons (`btn-x`) in curated shops / loot / encounters editors,
  and the session loot panel → `aria-label="Remove <item/creature name>"`.
- Initiative panel DM controls: damage `−`, heal `+`, remove `✕` →
  per-participant `aria-label`s ("Apply damage to <name>" etc.).
- Character sheet trash-icon delete button → `aria-label="Delete character"`.
- Sidenav hero search input → `aria-label`.
- Quantity inputs in loot editors → `aria-label="Quantity of <item>"`.

Already labelled before this pass (verified, unchanged): settings-panel close,
campaign-notes delete, spell-carousel remove/chevron, exhaustion/inspiration
pips (conditions panel + initiative panel), supplies/survival +/− buttons,
editable-number, sheet tabs (`role="tablist"`/`tab`/`aria-selected`),
login password reveal, mobile hamburger.

### 3. Keyboard operability for clickable non-buttons

Added `role="button"`, `tabindex="0"`, and Enter/Space activation (Space
`preventDefault`s scrolling) to rows with no nested interactive content:

- Sidenav roster items (+ `aria-current` on the active hero) and the
  account/settings row — `components/sidenav/sidenav.component.html`
- Campaign sidebar campaign items (+ `aria-current`) —
  `components/campaign-sidebar/campaign-sidebar.component.html`
- Party board member rows (`aria-label="Open the sheet for <name>"`) —
  `components/campaign-dashboard/party-board/party-board.component.html`
- Roll log collapse header (+ `aria-expanded`, caret marked `aria-hidden`) —
  `components/session-mode/roll-log-panel/roll-log-panel.component.html`

### 4. Landmarks & structure

- Login / Register / Reset-password page wrappers changed from
  `<div class="login-page">` to `<main class="login-page">`.
- App shell already had `<aside>`/`<main>` (sidenav.component.html) — verified,
  unchanged. Heading levels (h1 on character sheet + campaign dashboard +
  session mode, h2/h3 sections) were already sane — unchanged.

### 5. Live regions

- Toast: `role="status"` + `aria-live="polite"` moved to the always-rendered
  `<app-toast>` host (`components/toast/toast.component.ts`) so the live region
  exists before a message is inserted — a region created together with its
  content is often not announced.
- Auth error boxes (`.login-error` in login, register, reset-password) →
  `role="alert"`.

## Found but deferred (needs real rework — do not lose)

- **List rows with nested interactive content**: curated shops / loot /
  encounters `li.shop-row` open-on-click rows contain a nested "Copy JSON"
  button (`curated-shops.component.html:32`, `curated-loot.component.html:16`,
  `curated-encounters.component.html:16`). Making the row `role="button"`
  would illegally nest interactive controls; the fix is an explicit "Open"
  button or making the name a button.
- **Spellbook expandable rows** (`character-sheet/panels/spellbook-panel/spellbook-panel.component.html:93`):
  `div.spell-row` toggles expansion on click but contains prepared/cast
  buttons. Needs the spell name turned into a disclosure button
  (`aria-expanded`) rather than a row-level role.
- **Initiative panel hero cell** (`session-mode/initiative-panel/initiative-panel.component.html:50`):
  `div.board-hero` is clickable only when `canOpenSheet(p)` (DM cross-link);
  needs conditional `tabindex`/role and sits inside a dense grid row — skipped.
- **Toast keyboard dismissal** (`components/toast/toast.component.html`): the
  toast dismisses on click anywhere; as a `status` region it cannot also be a
  button. A separate labelled dismiss button inside it would fix this.
- **Create-character wizard step dots**
  (`create-character-modal.component.html`, `.wizard-steps`): purely visual
  progress; screen readers get no "step N of M" announcement. Consider a
  visually-hidden live status line bound to `step`/`totalSteps`.
- **Modals without Escape support**: only dice-roller and level-up use
  `appEscapeClose`. Delete-character, create/join campaign, manage party,
  delete campaign, session picker, and long rest close only via
  buttons/backdrop. Wiring `appEscapeClose` to each is mechanical but touches
  many host components — left for a follow-up.
- **Sidenav drawer scrim** (`sidenav.component.html`, `.drawer-scrim`):
  click-only dismiss for the mobile drawer; the drawer itself has no focus
  trap. Mobile drawer focus management would be its own small task.
- **Backdrop divs** (`.modal-backdrop` click-to-close): intentionally not
  focusable; fine as-is since every dialog has a labelled close/cancel path.
