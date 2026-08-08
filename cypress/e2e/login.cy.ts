describe('login page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('keeps submit disabled until both fields are filled', () => {
    cy.contains('button', 'Enter the Vault')
      .should('be.disabled');

    cy.get('#username').type('juniorDev');

    cy.contains('button', 'Enter the Vault')
      .should('be.disabled');

    cy.get('#password').type('secret');

    cy.contains('button', 'Enter the Vault')
      .should('be.enabled');
  });
});
