describe('Production professions', () => {
  it('uses the API for DM grants, shows recipe tiers, and preserves grants across reloads', () => {
    const pc = {
      id: 901, name: 'Artisan Test', clazz: 'Wizard', level: 5, playerName: 'Test', campaignId: 91,
      toolProfs: JSON.stringify(['Herbalism Kit', "Woodcarver's Tools"]),
    };
    let grants: { profession: string }[] = [];
    cy.intercept('GET', '**/api/v1/auth/authorize', { body: { userName: 'e2eTester', roles: [] } });
    cy.intercept('GET', '**/api/v1/pc/all', { body: [pc] });
    cy.intercept('GET', '**/api/v1/pc/find/*', { body: pc });
    cy.intercept('GET', '**/api/v1/pc/901/as-dm', { body: pc });
    cy.intercept('GET', '**/api/v1/campaign/mine', { body: [{ id: 91, name: 'Artisan Workshop' }] });
    cy.intercept('GET', '**/api/v1/campaign/91/members', { body: [pc] });
    cy.intercept('GET', '**/api/v1/campaign/91/session', { statusCode: 204 });
    cy.intercept('GET', '**/api/v1/campaign/91/header', { body: { id: 91, name: 'Artisan Workshop' } });
    cy.intercept('GET', '**/api/v1/pc/901/professions', req => req.reply(grants)).as('listProfessions');
    cy.intercept('POST', '**/api/v1/pc/901/professions', req => {
      grants.push(req.body); req.reply({ statusCode: 201, body: req.body });
    }).as('grantProfession');
    cy.intercept('DELETE', '**/api/v1/pc/901/professions/*', req => {
      grants = grants.filter(g => !req.url.endsWith('/' + g.profession)); req.reply({ statusCode: 204 });
    }).as('revokeProfession');
    cy.viewport(1280, 900);
    cy.visitAuthed('/charactermanager');
    cy.window().then(win => win.localStorage.setItem('tm_role', 'dm'));
    cy.reload();
    cy.contains('Artisan Workshop').click();
    cy.get('.board-row.member').first().click();
    cy.contains('button.sheet-tab', 'Professions').click();
    cy.wait('@listProfessions');
    cy.contains('button', '+ Grant Profession').click();
    cy.get('#profession-choice optgroup[label=Production] option').should('have.length', 9);
    cy.get('#profession-choice').select('tailoring');
    cy.get('app-professions-panel button[type=submit]').should('be.disabled');
    cy.get('#profession-choice').select('alchemy');
    cy.get('app-professions-panel button[type=submit]').click();
    cy.wait('@grantProfession').its('request.body').should('deep.equal', { profession: 'alchemy' });
    cy.contains('.profession-row summary', 'Alchemy').click();
    cy.get('.recipe-tier[data-bonus=3]').should('contain.text', 'Skill requirement met').find('summary').click();
    cy.contains('li', 'Alchemy Jug').should('be.visible');
    cy.get('.recipe-tier[data-bonus=5]').should('contain.text', 'Requires +5 proficiency').find('summary').click();
    cy.contains('Artisan recipes require extraordinary acquisition').should('be.visible');
    cy.contains('button', '+ Grant Profession').click();
    cy.get('#profession-choice').select('enchanting');
    cy.get('app-professions-panel button[type=submit]').click();
    cy.wait('@grantProfession');
    cy.contains('.profession-row summary', 'Enchanting').click();
    cy.contains('Disenchant a permanent magic item').should('exist');
    cy.viewport(390, 844);
    cy.contains('.profession-row summary', 'Enchanting').scrollIntoView({ offset: { top: -100, left: 0 } });
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(390));
    cy.screenshot('production-professions-mobile', { capture: 'viewport' });
    cy.viewport(320, 700);
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(320));
    cy.viewport(1280, 900);
    cy.contains('.profession-row summary', 'Alchemy').scrollIntoView({ offset: { top: -80, left: 0 } });
    cy.screenshot('production-professions-desktop', { capture: 'viewport' });
    cy.window().then(win => win.localStorage.setItem('tm_role', 'player'));
    cy.reload();
    // Switch to the owner view to verify persisted grants without DM controls.
    cy.get('.roster-item').first().click();
    cy.contains('button.sheet-tab', 'Professions').click();
    cy.wait('@listProfessions');
    cy.get('.profession-name').should('have.length', 2);
    cy.get('app-professions-panel').contains('button', '+ Grant Profession').should('not.exist');
  });
});
