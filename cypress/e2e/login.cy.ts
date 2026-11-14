describe('login page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('keeps submit disabled until both fields are filled', () => {
    cy.contains('button', 'Sign In')
      .should('be.disabled');

    cy.get('#username').type('juniorDev');

    cy.contains('button', 'Sign In')
      .should('be.disabled');

    cy.get('#password').type('secret');

    cy.contains('button', 'Sign In')
      .should('be.enabled');
  });
});
