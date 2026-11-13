describe('UI cleanup', () => {
  beforeEach(() => {
    cy.enterDemo();
    cy.viewport(1280, 900);
    cy.visit('/charactermanager');
  });

  it('shows five help tips and opens a dismissible mobile dialog without changing rules', () => {
    cy.visit('/charactermanager', { onBeforeLoad: win => win.localStorage.setItem('tm_role', 'dm') });
    cy.contains('button', 'New Campaign').click();
    cy.get('app-context-help').should('have.length', 5);
    cy.get('app-context-help .help-trigger').first().trigger('mouseenter');
    cy.get('.mat-mdc-tooltip').should('be.visible').and('contain.text', 'Players who join convert their inventory');
    cy.get('app-context-help .help-trigger').first().trigger('mouseleave');
    cy.viewport(390, 844);
    cy.get('app-context-help .help-trigger').each(($button) => {
      cy.wrap($button).click();
      cy.get('dialog[open]').should('be.visible').within(() => {
        cy.get('p').invoke('text').should('not.be.empty');
        cy.contains('button', 'Close').click();
      });
      cy.get('dialog[open]').should('not.exist');
      cy.wrap($button).should('be.focused');
    });
    cy.get('app-create-campaign-modal input[type=checkbox]').should('not.be.checked');
    cy.get('#campaign-name').should('have.attr', 'aria-required', 'true');
    cy.contains('button', 'Inscribe').should('be.disabled');
    cy.get('app-create-campaign-modal').should('not.contain.text', '(optional)');
    cy.get('app-create-campaign-modal input[placeholder*="e.g."]').should('not.exist');
    cy.screenshot('campaign-help-mobile', { capture: 'viewport' });
  });

  it('provides independent sheet spell groups and separate placeholder tabs', () => {
    cy.get('.roster-item').first().click();
    cy.contains('button.sheet-tab', 'Renown').click();
    cy.get('[role=tabpanel][aria-label=Renown]').should('be.visible');
    cy.contains('button.sheet-tab', 'Followers').click();
    cy.get('[role=tabpanel][aria-label=Followers]').should('be.visible');
    cy.get('[role=tabpanel][aria-label=Renown]').should('not.exist');
    cy.contains('button.sheet-tab', 'Spells').click();
    cy.get('.spell-level-toggle').should('have.length.greaterThan', 1);
    cy.get('.spell-level-toggle').first().click().should('have.attr', 'aria-expanded', 'false');
    cy.get('.spell-level-toggle').eq(1).should('have.attr', 'aria-expanded', 'true');
    cy.get('.spell-level').first().find('.spell-row').should('not.be.visible');
    cy.get('.spell-level-toggle').first().click();
    cy.get('.spell-level').first().find('.spell-row').first().should('be.visible');
    cy.screenshot('sheet-spell-groups', { capture: 'viewport' });
  });
});
