// Custom commands for the Table Mimic E2E suite.
// See docs/cypress-crash-course.md — Slice 1 "Graduate: cy.session".

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Programmatic login against the real auth service (:8085), cached with
       * cy.session. The app's auth interceptor only reads localStorage.token,
       * so seeding it IS a legitimate login. Requires the Spring Boot auth
       * service to be running.
       */
      loginSession(user: string, pass: string): Chainable<void>;

      /**
       * Backendless login: opt into the app's first-class demo mode, cached
       * with cy.session. Drives the real "Enter in Demo Mode" button on
       * /login, which calls AuthService.enterDemoMode() — that sets
       * localStorage.demoMode = 'true' plus a non-JWT token (note: it does
       * NOT set localStorage.username, so getUsername() is null in demo).
       * Requires only `ng serve` — no Java backends.
       */
      enterDemo(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginSession', (user: string, pass: string) => {
  cy.session(
    [user],
    () => {
      cy.request('POST', 'http://localhost:8085/api/v1/auth/authenticate', {
        userName: user,
        password: pass,
      }).then(({ body }) => {
        expect(body.success).to.be.true;
        window.localStorage.setItem('token', body.token);
        window.localStorage.setItem('username', user);
      });
    },
    {
      validate: () => {
        cy.window().its('localStorage.token').should('exist');
      },
    }
  );
});

Cypress.Commands.add('enterDemo', () => {
  cy.session(
    'demo',
    () => {
      // Drive the real login-screen button rather than hand-seeding storage:
      // if enterDemoMode() ever changes what it writes, this stays correct.
      cy.visit('/login');
      cy.contains('button', 'Enter in Demo Mode').click();
      cy.url().should('include', '/charactermanager');
      cy.window().its('localStorage.demoMode').should('eq', 'true');
    },
    {
      validate: () => {
        cy.window().its('localStorage.demoMode').should('eq', 'true');
      },
    }
  );
});

export {};
