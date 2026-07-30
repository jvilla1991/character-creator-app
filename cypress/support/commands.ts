// Custom commands for the Table Mimic E2E suite.
// See docs/cypress-crash-course.md — Slice 1 "Graduate: cy.session".

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Corporate-standard auth bypass for NETWORK-STUBBED specs: seed a
       * well-formed (but fake-signed) JWT + username into localStorage before
       * the app boots, then visit the path. The app's real code runs against
       * it — authGuard base64url-decodes the token and checks its `exp`, and
       * the auth interceptor attaches it as a Bearer header to :8080 requests
       * (which the spec can assert on). No backend needed; signatures are a
       * server-side concern the client never verifies.
       */
      visitAuthed(path: string, user?: string): Chainable<Cypress.AUTWindow>;

      /**
       * Programmatic login against the real auth service (:8085), cached with
       * cy.session. The app's auth interceptor only reads localStorage.token,
       * so seeding it IS a legitimate login. Use this for the true
       * end-to-end layer — specs that run against real backends with seeded
       * test data. Requires the Spring Boot auth service to be running.
       */
      loginSession(user: string, pass: string): Chainable<void>;

      /**
       * App-specific convenience, NOT the suite's pattern: opt into Table
       * Mimic's demo mode (in-memory seed data, no HTTP at all). Handy for
       * manually poking the app without backends, but tests that use it are
       * exercising swapped-out service implementations rather than the real
       * HTTP code paths — prefer visitAuthed + cy.intercept in specs.
       */
      enterDemo(): Chainable<void>;
    }
  }
}

/**
 * Mint a structurally valid JWT (header.payload.signature) with a far-future
 * exp. The signature is garbage — clients never verify signatures, only
 * servers do, and in a stubbed spec there is no server. What matters is that
 * AuthService.getTokenExpiry() can base64url-decode the payload and find a
 * live `exp`, exactly as it would for a real token.
 */
function fakeJwt(user: string): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ sub: user, exp: Math.floor(Date.now() / 1000) + 60 * 60 });
  return `${header}.${payload}.e2e-fake-signature`;
}

Cypress.Commands.add('visitAuthed', (path: string, user = 'e2eTester') => {
  return cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('token', fakeJwt(user));
      win.localStorage.setItem('username', user);
    },
  });
});

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
