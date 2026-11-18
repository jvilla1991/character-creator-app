describe('Give inventory items', () => {
  const supplies = { name: 'Rations', category: 'gear', qty: 3, catalogKey: 'rations' };
  const sword = { name: 'Silver sword', category: 'weapon', qty: 2, equipped: true, damage: '1d8' };
  beforeEach(() => {
    const pc = { id: 1, name: 'Gift giver', clazz: 'Fighter', level: 3, playerName: 'e2eTester',
      campaignId: 10, inventory: JSON.stringify([supplies, sword]) };
    cy.intercept('GET', '**/api/v1/pc/all', [pc]);
    cy.intercept('GET', '**/api/v1/pc/find/1', pc);
    cy.intercept('GET', '**/api/v1/campaign/mine', []);
    cy.intercept('GET', '**/api/v1/auth/authorize', { userName: 'e2eTester', roles: [] });
    cy.intercept('GET', '**/api/v1/pc/1/inventory/recipients', [
      { kind: 'player', id: 2, name: 'Aria', playerName: 'Alex' },
      { kind: 'follower', id: 3, name: 'Bram' },
    ]).as('recipients');
    cy.visitAuthed('/charactermanager');
    cy.get('.roster-item').first().click();
    cy.contains('button.sheet-tab', 'Inventory').click();
  });

  for (const kind of ['player', 'follower']) {
    it(`gives a whole stack to a ${kind} and preserves hidden supplies`, () => {
      cy.viewport(kind === 'player' ? 1280 : 390, 844);
      cy.intercept('POST', '**/api/v1/pc/1/inventory/give', req => {
        expect(req.body).to.deep.equal({ kind, recipientId: kind === 'player' ? 2 : 3,
          itemIndex: 1, inventory: [supplies, sword] });
        req.reply({ inventory: [supplies], ac: 12 });
      }).as('give');
      cy.get('button[aria-label="Give Silver sword"]').click();
      cy.wait('@recipients');
      cy.get('app-give-item-modal [role=dialog]').should('be.visible');
      cy.contains('Players in your campaign').should('be.visible');
      cy.contains('Your followers').should('be.visible');
      cy.get('app-give-item-modal app-modal').screenshot(`give-${kind}`);
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(kind === 'player' ? 1280 : 390));
      cy.get('app-give-item-modal').contains('button', kind === 'player' ? 'Aria' : 'Bram').click();
      cy.wait('@give');
      cy.get('app-give-item-modal').should('not.exist');
      cy.get('app-inventory-panel').should('not.contain.text', 'Silver sword');
      cy.contains('Item transferred.').should('be.visible');
    });
  }
  it('cancels without transferring and returns focus', () => {
    cy.get('button[aria-label="Give Silver sword"]').click();
    cy.get('app-give-item-modal').contains('button', 'Cancel').click();
    cy.get('button[aria-label="Give Silver sword"]').should('be.focused');
    cy.get('app-inventory-panel').should('contain.text', 'Silver sword');
  });
  it('keeps the item when the server rejects a stale inventory', () => {
    cy.intercept('POST', '**/api/v1/pc/1/inventory/give', { statusCode: 409 }).as('give');
    cy.get('button[aria-label="Give Silver sword"]').click();
    cy.get('app-give-item-modal').contains('button', 'Bram').click();
    cy.wait('@give');
    cy.get('app-give-item-modal [role=alert]').should('contain.text', 'Inventory changed');
    cy.get('app-give-item-modal').contains('button', 'Bram').should('be.disabled');
    cy.get('app-inventory-panel').should('contain.text', 'Silver sword');
  });
});
