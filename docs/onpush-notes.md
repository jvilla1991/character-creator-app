# OnPush expansion — classification audit (chore/broader-onpush)

Expansion of `ChangeDetectionStrategy.OnPush` from 4 components to 47 (of 64).
The app stays on zone.js; this is *not* a zoneless migration.

**Classification rule applied per component (by reading the code, not just the tests):**
a component is safe for OnPush only if every render-relevant state change arrives via
(1) an input reference change, (2) a template event, (3) a signal it reads, or
(4) an async-pipe emission. Fields written from subscription/timer/HTTP callbacks were
either converted to signals (small, mechanical cases) or the component was skipped.

**Structural rule:** OnPush gates its whole subtree — a Default-CD descendant under a
non-dirty OnPush ancestor is never checked on a zone tick. So container components that
host *skipped* (unsafe) Default children were themselves skipped, even when their own
state was safe. Only leaves and fully-safe subtrees were converted.

## Already OnPush before this branch (4)

| Component | Note |
|---|---|
| editable-number | fully signal-based |
| ability-scores (sheet panel) | fully signal-based |
| skills-list | fully signal-based |
| spellbook-panel | fully signal-based |

## Converted — no code change needed (31)

| Component | Why it is safe |
|---|---|
| empty-state | static template + output only |
| equipment-panel | single `input.required<PC>()`; PC is never mutated in place anywhere (verified repo-wide) |
| delete-confirmation-modal | signal input + outputs only |
| party-board | `input<PC[]>` — dashboard vm$ builds a new members array per emission |
| party-treasury | `@Input` setter over the same per-emission array; setter output rendered |
| toast | async pipe only |
| role-switch | reads UiStateService signals; writes via template events |
| campaign-sidebar | rows$/count$ via async pipe; activeCampaignId signal; visibilitychange feeds a Subject consumed by the async pipe |
| join-campaign-modal | async pipe + inputs; code/pcId written only by template events/ngOnChanges |
| vitals-strip | `@Input pc` + pure-builder `pcChange` emits (immutable spreads); PCService round-trip supplies a fresh PC reference |
| coin-purse | same emit-immutable pattern |
| conditions-panel | same; all local state readonly constants |
| survival-panel | same |
| supplies-panel | same |
| features-list | inputs + grant-form drafts written only by template events |
| other-features | same |
| inventory-panel | inputs + immutable `pcChange` emits; child item-composer converted too (see below) |
| background-story | signal inputs + event-driven grant form |
| spell-picker | inputs + event-driven search; selection emitted, owned by caller |
| dm-edit-modal | `request` input is a fresh object per open; drafts written by ngOnChanges/template events |
| identity-step | primitive signal inputs + outputs |
| species-step | signal inputs; parent replaces lists/details from HTTP (never mutates in place) |
| class-step | same |
| background-step | same (`enabledSources` is spread-replaced; group getters return new arrays) |
| proficiencies-step | `selectedSkills` is filter/spread-replaced by the parent |
| spells-step | `selectedSpells` is filter/spread-replaced; filter state two-way via outputs |
| equipment-step | primitives + HTTP-replaced `currentClassEquipment` |
| review-step | read-only summary; function inputs are stable refs and all values are final while the step is displayed (@if destroys/recreates it on edit navigation) |
| create-campaign-modal | pure template-event form; child week-days-editor converted |
| week-days-editor | `@Input value` + event-driven custom-day state; emits new arrays |
| roll-log-panel | signal inputs (session poll deserializes a fresh `state.rolls` array per emission); `collapsed` converted to a signal so the spec's programmatic `toggle()` also marks the view |

## Converted — with a small field→signal change (12)

| Component | Fields converted to `signal()` (all were written from HTTP/timer callbacks) |
|---|---|
| character-sheet | `inspirationBusy` (cleared in subscribe callbacks); everything else is input/event/immutable-persist driven and every template child is now OnPush |
| pc-notes | `notes`, `saving` |
| pc-log | `entries` |
| item-composer | `catalogItems`, `loadingCatalog` |
| campaign-week | `editing`, `saving` |
| campaign-notes | `notes`, `saving` |
| login | `errorMessage` |
| register | `errorMessage`, `loading` |
| reset-password | `errorMessage`, `done`, `submitting` |
| session-live-banner | `live`, `pickerOpen`, `joining`, `error` (5s discovery-poll subscription writes) |
| encounter-loader | `encounters`, `selectedId`, `busy` (list/load HTTP callbacks) |
| spell-carousel | `allSpells`, `loadingSpells`, `focusedName` (HTTP + the 1.6s flash-clear timer) |

## Skipped (17) — reason per component

| Component | Reason |
|---|---|
| app.component (root) | hosts RouterOutlet whose routed shells are Default with subscription-driven fields; an OnPush root would gate their zone-tick checks |
| charactermanager-app | 8 subscriptions writing plain fields AND hosts skipped Default children (create-character-modal, settings-panel) |
| sidenav | hosts session-mode (skipped, Default); also a pcs$ subscription writes `allPcs` |
| main-content | 6 subscriptions writing plain fields; hosts skipped dice-roller-modal / level-up-modal |
| campaign-dashboard | own delete/busy flags are convertible, but it hosts skipped Default children (curated-shops/encounters/loot) whose HTTP-callback field writes would be gated |
| session-mode | 19 subscriptions writing plain fields across the 2s poll pipeline; > 20-line rework — follow-up candidate |
| initiative-panel | 9 subscriptions writing plain fields (order edits, d20 rolls, HP writes) — follow-up candidate |
| loot-panel | 11 subscriptions writing plain fields (claim pool refetches) |
| shop-panel | 6 subscriptions writing plain fields |
| dice-roller-modal | timer-driven roll animation writes plain fields |
| level-up-modal | 3 subscriptions writing preview/commit state fields |
| create-character-modal | 853-line wizard host; 8 subscriptions mutate wizard state fields |
| ability-scores-step | documented shared-by-reference contract: parent's `assignments` Record is mutated in place through the step's `[(ngModel)]` |
| settings-panel | ~10 fields written from HTTP + clipboard-promise callbacks; > 20-line rework — follow-up candidate |
| curated-shops | 9 subscriptions writing plain list/busy fields |
| curated-encounters | 7 subscriptions writing plain list/busy fields |
| curated-loot | 10 subscriptions + a timer writing plain fields |

## Test-only adjustments

- `conditions-panel.component.spec.ts`: two tests set decorator inputs directly after the
  first `detectChanges()`; changed to `fixture.componentRef.setInput(...)` so the OnPush
  view is marked (the pattern the other rendered specs already use).
- `item-composer` / `spell-carousel` / auth / notes / encounter-loader specs: field reads
  and writes updated to the signal API (`x()` / `x.set(...)`).

## Verification

- `npm test -- --watch=false --browsers=ChromeHeadless`: **841 / 841 SUCCESS**
- `npx ng build`: initial total **438.95 kB** (budget warn 500 kB); lazy-chunk graph
  unchanged (charactermanager-routes, spellbook-panel, curated-* chunks intact)
- Tests are necessary but not sufficient for OnPush safety; the table above is the
  code-reading audit that backs each conversion.
