import { defineConfig } from 'cypress';

export default defineConfig({
  // Prevent browser code from reading all Cypress environment values. This
  // suite does not use the deprecated Cypress.env() API.
  allowCypressEnv: false,
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    // Steps 2–3 of the character wizard normally hit the external
    // https://www.dnd5eapi.co API, which can be slow — give queries headroom.
    // (The Slice 2 spec stubs those calls, but specs that let them through
    // shouldn't flake on the default 4s.)
    defaultCommandTimeout: 10000,
  },
});
