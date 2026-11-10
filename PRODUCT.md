# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One Dungeons & Dragons group playing **in person**, each person on their own device around a
physical table. Two roles:

- **The DM** runs the session: builds campaigns, curates encounters, loot and shops ahead of
  time, and drives live session state during play.
- **The players** each own one character and read or act on only what the DM has revealed.

Phones are the common player device at the table, so the app is used in short glances between
turns rather than read at length.

An `ADMIN` authority also exists for account operations (notably issuing password resets, since
no transactional email is configured).

## Product Purpose

Run a live D&D session for a table that is physically together: hold each character's sheet,
hold the campaign the DM has prepared, and push shared session state — initiative, loot, shops,
rests, rolls — to everyone at the moment it matters.

Success is that the table reaches for the app during play instead of paper and side-channel
chat, and that the DM can prepare once and run from it.

## Positioning

Three things together, which no single neighbouring product offers:

1. **A DM-driven live session layer.** Initiative order, a first-come-first-served loot claim
   pool, open shops, short-rest voting, and a shared roll log are pushed from the DM to players
   during play. The session, not the character sheet, is the centre of gravity.
2. **Variant and homebrew rules as first-class systems**, opted into per campaign — slot-based
   "active inventory", survival conditions (hunger, thirst, fatigue) and a persisted campaign
   game clock. The large platforms do not model these.
3. **Deliberately lighter** than D&D Beyond or Roll20: no subscription, no virtual tabletop, no
   content marketplace. It assumes the map and the dice are already on the table.

## Operating Context

- Play happens **in person**, in a session the DM starts and ends. Players join a campaign by
  invite.
- Preparation and play are separate modes. The DM curates encounters, loot lists and shops on
  the campaign dashboard beforehand; during a session they load those into play.
- Session state is shared by short polling, so "live" means within a couple of seconds, not
  instant.
- Characters are created through a multi-step wizard and then maintained on a sheet of panels
  (ability scores, skills, spellbook, inventory, equipment, conditions, features, coin purse,
  background).

## Capabilities and Constraints

Confirmed capabilities: campaigns and party management; character creation and level-up;
character sheets; spell management including prepared spells; inventory, equipment and supply
containers; curated encounters, loot lists and shops; live sessions with an initiative tracker,
loot claims, shop panel, roll log and dice roller; short-rest voting with DM override; per-
campaign variant rules; three user-selectable display themes; account registration and
admin-issued password reset.

Constraints the user confirmed as durable:

- **The 2024 Player's Handbook is the ruleset of record.** Content and terminology follow 2024,
  not 2014.
- **It must stay usable on a phone.** Dense panels have to remain workable at phone width,
  because that is what players hold at the table.
- **The DM/player visibility split is a hard rule.** Players see only their own character and
  what the DM has revealed. No change may leak DM-only state to a player view.

Not established as a constraint: content licensing. The user did not mark SRD limits as binding,
so treat shipped content rules as an open question rather than assuming a restriction.

## Brand Commitments

- The product is named **Table Mimic**, served at `table-mimic.villa-dev.com`.
- The interface speaks in-world rather than in generic product language — "Enter the Vault",
  "Forge a Hero", "No hero selected", "a chronicle of heroes & hauntings". This voice is
  established in the shipped copy and should be preserved.
- Three display themes ship and are user-selectable. All three are first-class: a change that
  works in only one of them is incomplete.

## Evidence on Hand

- A deployed, working application at `table-mimic.villa-dev.com`.
- The repository itself, including `docs/a11y-notes.md` (accessibility pass and its deferred
  backlog) and `docs/theme-contrast-audit.md` (full three-theme contrast audit).
- A contrast regression gate in CI (`npm run check:contrast`).

Absences future work must not fabricate: there are no customers, testimonials, case studies,
benchmarks, pricing, or usage numbers. The product has one group of real users — the owner's own
table.

## Product Principles

1. **The table is in the room.** Design for short glances on a phone between turns, not for
   sustained reading. Time-to-answer beats completeness on session surfaces.
2. **The DM decides what is visible.** Visibility is a product rule, not a preference; never
   surface DM-only state in a player view.
3. **Preparation and play are different jobs.** Curating a shop and running a session have
   different needs; do not force one layout to serve both.
4. **Variant rules are opt-in and campaign-scoped.** A table that has not enabled a variant
   should never see its vocabulary.
5. **All three themes are the product.** Any visual change ships only when it holds in all of
   them.

## Accessibility & Inclusion

- The palette meets **WCAG AA (4.5:1) for body text across all three themes**, verified by
  audit and enforced in CI. This is an established, non-negotiable floor.
- Functional text stays at or above an 11px floor.
- An accessibility pass covering dialog semantics, focus management, icon-only control labels,
  keyboard operability and live regions is recorded in `docs/a11y-notes.md`, together with a
  deferred backlog that future work should draw from rather than rediscover.
