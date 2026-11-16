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

## Formerly deferred — resolved 2026-11-15 (`fix/a11y-deferred-backlog`)

All eight items this pass deferred were still present when Phase 2 of the impeccable
adoption plan measured (2026-11-13). Slice 2 closed them:

- **List rows with nested interactive content** — the curated shop / encounter / loot
  name and summary are now a `button.shop-open` that opens the entry. The row click stays
  as a larger pointer target; no row role, so "Copy JSON" is not nested.
- **Spellbook expandable rows** — the spell name is a `button.spell-toggle` with
  `aria-expanded`; the row click stays for pointers.
- **Initiative panel hero cell** — where the DM can open the PC's sheet, `div.board-hero`
  is `role="button"`, `tabindex="0"`, named "Open the sheet for <name>", Enter/Space
  activate. Elsewhere it stays a plain cell.
- **Toast keyboard dismissal** — a labelled "Dismiss notification" button. The message is
  spoken by an always-rendered hidden `role="status"` line, not by the toast, so the
  button is not read with every message.
- **Wizard step dots** — a hidden status line reads "Step N of M: <step>"; the dots are
  `aria-hidden`.
- **Modals without Escape support** — superseded by a shared shell, below.
- **Sidenav drawer scrim** — the drawer is a modal dialog while open, below.
- **Backdrop divs** — unchanged and still fine: every dialog has a labelled close path.

### The shared dialog shell (replaces per-dialog `cdkTrapFocus` / `appEscapeClose`)

`components/modal/`:

- `DialogDirective` (`appDialog`): `role` + `aria-modal`, Escape for the **topmost**
  open dialog only (`DialogStack`), focus moved in on open (`[cdkFocusInitial]` →
  `[autofocus]` → first tabbable that is not the shell close button → the dialog
  itself), Tab trapped (CDK `FocusTrap`), focus returned to the opener on close.
  `[dialogDismissible]="false"` keeps a dialog open and still stops Escape reaching the
  one below. `[dialogActive]` makes an always-present element a dialog only while open.
- `ModalComponent` (`<app-modal title tone dialogRole>`): the `.modal` box, an `<h2>`
  title that names the dialog, a labelled close button, `celestial` / `crimson` tones.

Using the shell: create/join campaign, delete character (`alertdialog`), delete
campaign (`alertdialog`), manage party, DM edit, session picker, long rest, level-up, the
players' rest vote (no close button, Escape ignored). Using the directive on their own
chrome: dice roller, settings slide-over, create-character wizard (Escape = backdrop tap,
draft kept), and the phone drawer (`dialogActive` = open; `<main>` inert behind it;
closed drawer `visibility: hidden`). `EscapeCloseDirective` is gone.

**Known gap:** focus returns to the opener only if it can still take focus. A dialog
opened from the drawer footer (Create Character, Join Campaign, New Campaign) closes the
drawer first, so on close focus falls to `<body>`.

### Live regions added

- Initiative board: hidden status "<name>'s turn. <name> is on deck." from the rows the
  viewer can see (a hidden enemy's turn says nothing); `aria-current` on the active row.
- Session banner: an always-present status says "A session is live in <campaign>".
- Rest vote: the countdown is out of every live region; a hidden line speaks at the
  opening, at ten seconds and at zero.
