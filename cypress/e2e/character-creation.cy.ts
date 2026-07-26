// Slice 2 — Character creation wizard (docs/cypress-crash-course.md §2).
//
// Runs entirely in DEMO MODE: `ng serve` on :4200 is the only prerequisite —
// no Spring Boot backends. The external https://www.dnd5eapi.co calls that
// feed the species/class tiles (steps 2–3) are stubbed with local fixtures so
// the specs are deterministic and work offline. Backgrounds, spells, and
// equipment come from local static data / assets, so they need no stubbing.
//
// Selector notes (all verified against src/):
// - Wizard is a modal, not a route: opened via the sidenav "Forge Hero" button.
// - Species/class/background tiles are `button.class-pick` accordion heads.
// - Skill chips on the proficiencies step are also `button.class-pick`.
// - Standard-array assignment uses one `select.ability-select` per ability row;
//   the +2/+1 background bonuses are two selects inside `.bonus-selectors`.

const NAME_INPUT = 'input[placeholder="e.g. Seraphina Goldveil"]';

/** Stub the external dnd5eapi.co calls the wizard makes for steps 2–3. */
function stubDndApi(): void {
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
    stubDndApi();
    cy.enterDemo();
    cy.visit('/charactermanager');
    cy.contains('button', 'Forge Hero').click();
    cy.get('.modal.wizard').should('be.visible');
  });

  it('walks a fighter through all 8 steps and inscribes the hero', () => {
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

    // Modal closes and the new hero appears in the sidenav roster.
    cy.get('.modal.wizard').should('not.exist');
    cy.contains('.roster-name', 'Borin Ironfoot').should('be.visible');
  });

  it('restores a draft after reload', () => {
    cy.get(NAME_INPUT).type('Draft Test');
    next(); // step change → wizard snapshots to localStorage

    // Demo mode never sets localStorage.username (see AuthService.enterDemoMode),
    // so getUsername() is null and the draft key falls back to "anon".
    cy.window().then((win) => {
      const draft = JSON.parse(win.localStorage.getItem('tm_pc_draft:anon') ?? '{}');
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
