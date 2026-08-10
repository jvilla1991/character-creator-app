// Slice 2 — Character creation wizard (docs/cypress-crash-course.md §2).
//
// CORPORATE PATTERN — stub at the network boundary, run the real app:
// every line of production frontend code executes here (route guard, auth
// interceptor, PCService serialization, the wizard itself); the only fake
// things are the HTTP responses, controlled with cy.intercept. Contrast
// with the app's demo mode, which swaps out the service layer in-app and
// therefore skips the HTTP code paths entirely — fine for manual demos,
// not what a test suite should exercise.
//
// Prerequisite: `ng serve` on :4200. No Java backends, no internet — the
// stubs below stand in for both Spring Boot services and dnd5eapi.co.
//
// Selector notes (all verified against src/):
// - Wizard is a modal, not a route: opened via the sidenav "Forge Hero" button.
// - Species/class/background tiles are `button.class-pick` accordion heads.
// - Skill chips on the proficiencies step are also `button.class-pick`.
// - Standard-array assignment uses one `select.ability-select` per ability row;
//   the +2/+1 background bonuses are two selects inside `.bonus-selectors`.

const NAME_INPUT = 'input[placeholder="e.g. Seraphina Goldveil"]';
const USER = 'e2eTester';

/**
 * Stateful mini-backend for the character API: POST /pc/add writes into `db`,
 * GET /pc/all reads from it. This matters because after "Inscribe" the app
 * refetches the roster (CharacterModalService.onCreated → refreshPCs) — a
 * static [] stub would make the new hero vanish. Route handlers with shared
 * state are the standard way to fake read-your-writes behaviour.
 */
function stubBackend(): void {
  const db: Record<string, unknown>[] = [];

  // Character manager service (:8080)
  cy.intercept('GET', '**/api/v1/pc/all', (req) => req.reply(db)).as('getPcs');
  cy.intercept('POST', '**/api/v1/pc/add', (req) => {
    // Echo the serialized payload back with a server-assigned id — the same
    // flat row shape the real backend returns, so deserializePC round-trips.
    const created = { ...req.body, id: 101 };
    db.push(created);
    req.reply(created);
  }).as('addPc');

  // The shell also loads the user's campaigns — none for this spec, but stub
  // it anyway: every request the page makes should have a controlled answer
  // (an unstubbed call would just error to the console and hide real issues).
  cy.intercept('GET', '**/api/v1/campaign/mine', { body: [] }).as('getCampaigns');

  // Auth service (:8085) — profile enrichment fired on shell load
  cy.intercept('GET', '**/api/v1/auth/authorize', {
    body: { userName: USER, email: 'e2e@test.local', roles: [] },
  }).as('authorize');

  // External dnd5eapi.co — species/class data for wizard steps 2–3
  cy.intercept('GET', '**/api/2024/species', { fixture: 'dnd5e/species-list.json' }).as('speciesList');
  cy.intercept('GET', '**/api/2024/species/*', { fixture: 'dnd5e/species-dwarf.json' }).as('speciesDetail');
  cy.intercept('GET', '**/api/2024/classes', { fixture: 'dnd5e/class-list.json' }).as('classList');
  cy.intercept('GET', '**/api/2024/classes/fighter', { fixture: 'dnd5e/class-fighter.json' }).as('fighterDetail');
  cy.intercept('GET', '**/api/2024/classes/wizard', { fixture: 'dnd5e/class-wizard.json' }).as('wizardDetail');
}

/** Re-queried fresh on every call — immune to step-transition re-renders. */
const next = () => cy.contains('button', 'Next →').click();

describe('character creation wizard', () => {
  beforeEach(() => {
    // ORDER MATTERS: intercepts before the visit that triggers the requests.
    stubBackend();
    cy.visitAuthed('/charactermanager', USER);
    cy.wait('@getPcs'); // shell loaded and fetched the (empty) roster
    cy.contains('button', 'Forge Hero').click();
    cy.get('.modal.wizard').should('be.visible');
  });

  it('walks a fighter through all 8 steps and posts the serialized contract', () => {
    // Non-caster default: 8 step dots
    cy.get('.wizard-steps .step-dot').should('have.length', 8);

    // ── Step 1: identity — Next gated on a non-blank name ──────────────
    cy.contains('button', 'Next →').should('be.disabled');
    cy.get(NAME_INPUT).type('Borin Ironfoot');
    cy.contains('button', 'Next →').should('be.enabled');
    next();

    // ── Step 2: species (tiles load async from the stub; contains retries) ──
    cy.contains('button.class-pick', 'Dwarf').click();
    next();

    // ── Step 3: class (Fighter needs no level-1 subclass) ───────────────
    cy.contains('button.class-pick', 'Fighter').click();
    next();

    // ── Step 4: background (static local data — renders immediately) ────
    cy.contains('button.class-pick', 'Soldier').click();
    next();

    // ── Step 5: proficiencies — Fighter chooses EXACTLY 2 class skills ──
    // Soldier already grants Athletics + Intimidation as background skills;
    // those chips are locked (disabled) and do NOT count toward the class
    // quota, so pick two others from Fighter's list.
    cy.contains('.prof-counter', '0/2 chosen');
    cy.contains('button.class-pick', 'Athletics').should('be.disabled'); // background-locked
    cy.contains('button', 'Next →').should('be.disabled');
    cy.contains('button.class-pick', 'Perception').click();
    cy.contains('button', 'Next →').should('be.disabled'); // 1 of 2 — still gated
    cy.contains('button.class-pick', 'Survival').click();
    cy.contains('.prof-counter', '2/2 chosen');
    next();

    // ── Step 6: ability scores — standard array + background +2/+1 ──────
    // Assign each standard-array value via its row's select. Every pick
    // re-renders the remaining selects' options, so re-query per row.
    ([
      ['STR', '15'],
      ['DEX', '14'],
      ['CON', '13'],
      ['INT', '12'],
      ['WIS', '10'],
      ['CHA', '8'],
    ] as const).forEach(([ability, score]) => {
      cy.contains('.ability-row', ability).find('select.ability-select').select(score);
    });

    // Array complete, but the +2/+1 bonuses are still unset — Next stays gated.
    cy.contains('button', 'Next →').should('be.disabled');

    // Soldier offers STR/DEX/CON; the two bonuses must land on different abilities.
    cy.contains('.bonus-selectors .field', '+2 bonus').find('select').select('STR');
    cy.contains('.bonus-selectors .field', '+1 bonus').find('select').select('CON');
    cy.contains('button', 'Next →').should('be.enabled');
    next();

    // ── Step 7: equipment — choice A or B required ───────────────────────
    cy.contains('button', 'Next →').should('be.disabled');
    cy.contains('button.equip-card', 'Option A').click();
    next();

    // ── Step 8: review → Inscribe ────────────────────────────────────────
    cy.contains('.review-value', 'Borin Ironfoot');
    cy.contains('button', 'Inscribe').click();

    // THE PAYLOAD ASSERTION — the core of the network-boundary pattern.
    // We verify the app's outbound contract: PCService.serializePC flattened
    // the wizard's nested draft into the backend's column shape, and the auth
    // interceptor (real production code) attached our JWT.
    cy.wait('@addPc').then(({ request }) => {
      expect(request.headers.authorization, 'JWT attached by the real interceptor')
        .to.match(/^Bearer /);
      expect(request.body).to.deep.include({
        name: 'Borin Ironfoot',
        species: 'Dwarf',   // serializePC maps frontend `race` → backend `species`
        clazz: 'Fighter',
        background: 'Soldier',
        level: 1,
        profBonus: 2,
        abilityStr: 17,     // 15 from the array + Soldier's +2
        abilityCon: 14,     // 13 from the array + Soldier's +1
        hpMax: 12,          // d10 hit die + CON mod (+2)
      });
      // Complex fields ride as JSON strings (TEXT columns server-side)
      expect(request.body.skills).to.contain('Perception').and.to.contain('Survival');
    });

    // Modal closes; the roster refetch (our stateful stub) shows the new hero.
    cy.get('.modal.wizard').should('not.exist');
    cy.wait('@getPcs');
    cy.contains('.roster-name', 'Borin Ironfoot').should('be.visible');
  });

  it('restores a draft after reload', () => {
    cy.get(NAME_INPUT).type('Draft Test');
    next(); // step change → wizard snapshots to localStorage

    // The draft key is per-user: tm_pc_draft:<username from localStorage>.
    cy.window().then((win) => {
      const draft = JSON.parse(win.localStorage.getItem(`tm_pc_draft:${USER}`) ?? '{}');
      expect(draft.name).to.eq('Draft Test');
      expect(draft.step).to.eq(2);
    });

    cy.reload();
    cy.contains('button', 'Forge Hero').click();
    cy.get('.modal.wizard').should('be.visible');

    // The draft restores the step too — we saved on step 2 (species), so the
    // wizard reopens there. Go Back to step 1 to see the restored name.
    cy.get('.wizard-steps .step-dot.active').should('contain.text', '2');
    cy.contains('button', 'Back').click();
    cy.get(NAME_INPUT).should('have.value', 'Draft Test');
  });

  it('shows 9 step dots for a spellcasting class vs 8 for a fighter', () => {
    cy.get(NAME_INPUT).type('Elowen the Arcane');
    next();
    cy.contains('button.class-pick', 'Dwarf').click();
    next();

    // Baseline before any class is chosen: 8 dots.
    cy.get('.wizard-steps .step-dot').should('have.length', 8);

    // Wizard is a spellcasting class — the spells step appears (9 dots).
    cy.contains('button.class-pick', 'Wizard').click();
    cy.get('.wizard-steps .step-dot').should('have.length', 9);

    // And deselecting/switching back to a martial class drops it again.
    cy.contains('button.class-pick', 'Fighter').click();
    cy.get('.wizard-steps .step-dot').should('have.length', 8);
  });
});
