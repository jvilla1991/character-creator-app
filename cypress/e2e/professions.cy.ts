describe('Gathering professions', () => {
  it('grants, retains across tabs, displays rules, and revokes on desktop and mobile', () => {
    cy.enterDemo();
    cy.viewport(1280, 900);
    cy.visit('/charactermanager', { onBeforeLoad: win => win.localStorage.setItem('tm_role', 'dm') });
    cy.contains('The Veiled Compass').click();
    cy.get('.board-row.member').first().click();
    cy.contains('button.sheet-tab', 'Professions').click();
    cy.contains('button', '+ Grant Profession').click();
    cy.get('#profession-choice').select('fishing');
    cy.get('app-professions-panel button[type=submit]').click();
    cy.get('.profession-name').should('contain.text', 'Fishing');
    cy.contains('button.sheet-tab', 'Followers').click();
    cy.contains('button.sheet-tab', 'Professions').click();
    cy.get('.profession-row summary').click();
    cy.contains('Use the normal foraging rules').should('be.visible');
    cy.contains('summary', 'Gathering in Azeroth').click();
    cy.get('app-professions-panel').screenshot('professions-desktop');
    cy.viewport(390, 844);
    cy.get('app-professions-panel').scrollIntoView({ offset: { top: -80, left: 0 } });
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(390));
    cy.screenshot('professions-mobile', { capture: 'viewport' });
    cy.get('button[aria-label="Revoke Fishing"]').click();
    cy.contains('button', 'Keep').click();
    cy.get('.profession-name').should('contain.text', 'Fishing');
    cy.get('button[aria-label="Revoke Fishing"]').click();
    cy.contains('button', 'Confirm revoke').click();
    cy.contains('No professions yet').scrollIntoView({ offset: { top: -100, left: 0 } }).should('be.visible');
  });
  it('shows the player tab without DM grant controls', () => {
    cy.enterDemo();
    cy.visit('/charactermanager', { onBeforeLoad: win => win.localStorage.setItem('tm_role', 'player') });
    cy.get('.roster-item').first().click();
    cy.contains('button.sheet-tab', 'Professions').click();
    cy.get('app-professions-panel').should('be.visible');
    cy.contains('No professions yet').should('exist');
    cy.get('app-professions-panel').contains('button', '+ Grant Profession').should('not.exist');
  });
});
