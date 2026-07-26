# Cypress Crash Course — Table Mimic Edition

E2E testing crash course using this app's real features as the curriculum. Four slices, each
one layer harder than the last. Every selector, route, and endpoint below is verified against
the actual codebase — the specs are copy-paste runnable against `ng serve` on `:4200` with the
auth service on `:8085` and character-manager on `:8080`.

> **Reality check before you start:** this repo is on **Angular 21** now (standalone components,
> `provideRouter`), not 14. Nothing about Cypress changes, but don't fight the tooling expecting
> NgModules. Also: there are **zero `data-cy` attributes** in `src/` today — that's deliberate
> course material, not an oversight (see Slice 1).

---

## 0. Setup + the one mental model that matters

### Install

```bash
npm i -D cypress
```

```bash
npx cypress open
```

First launch scaffolds `cypress/` and `cypress.config.ts`. TypeScript works out of the box —
Cypress detects your `tsconfig.json` and compiles specs with its bundled esbuild. Minimal config:

```ts
// cypress.config.ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
});
```

One gotcha in an existing Angular repo: Cypress and Jasmine/Karma both declare global
`describe`/`it`/`expect` types, and they conflict. Give the `cypress/` dir its own tsconfig:

```jsonc
// cypress/tsconfig.json
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["es2020", "dom"],
    "types": ["cypress"]
  },
  "include": ["**/*.ts"]
}
```

and add `"cypress"` to the root `tsconfig.json` `exclude` if the editor still bleeds types across.

### The command queue — read this twice

This is what trips up experienced developers, so internalize it before writing a single spec:
**Cypress commands do not execute when the line runs.** `cy.get('#username')` doesn't return an
element — it *enqueues* a lookup onto a command queue that Cypress drains serially after your
spec function has already returned. Consequences:

1. **`cy.*` returns are not values.** This is broken code, and it fails silently:

   ```ts
   const input = cy.get('#username');   // NOT an element — a Chainable queue handle
   if (input.val() === '') { ... }      // .val() doesn't exist here; never do this
   ```

   To touch the real yielded subject, use `.then()`:

   ```ts
   cy.get('#username').then(($el) => {
     // $el is a real jQuery-wrapped element, *now*, at queue-execution time
   });
   ```

2. **No `await`.** Chainables are thenable-ish but not Promises. Mixing `async/await` with the
   queue produces out-of-order execution and flaky specs. Chain instead:
   `cy.get(...).type(...).should(...)`.

3. **Queries retry, actions don't.** `cy.get`, `cy.contains`, and `.should()` re-run
   automatically until they pass or time out (default 4s). `.click()` and `.type()` run once.
   This is *the* replacement for every `sleep`/`waitFor` habit you have: don't wait for things —
   **assert them**, and let the retry loop do the waiting.

   ```ts
   // wrong instinct:  cy.wait(2000); cy.get('.spell-row').click();
   // Cypress idiom:
   cy.get('.spell-row').should('have.length.greaterThan', 0);  // retries until true
   ```

4. **Each `it()` is an isolated queue** with a fresh browser context (by default). Don't share
   state between tests via closure variables set inside commands — it executes in an order you
   didn't write.

If a spec is flaky, 90% of the time the cause is one of these four points.

> **Go deeper:** the official "Introduction to Cypress" doc is the canonical explanation of
> retry-ability and the queue — worth 20 minutes even as a senior dev:
> <https://docs.cypress.io/app/core-concepts/introduction-to-cypress>

---

## 1. Slice 1 — Login (JWT auth)

**Introduces:** spec anatomy, `cy.visit` / `cy.get` / `cy.contains` / `.should`, selector
strategy, then `cy.session` for auth reuse.

### The material

| Thing | Fact |
|---|---|
| Route | `/login` (guest-guarded; `/` redirects here) |
| Username input | `#username`, `formControlName="userName"` |
| Password input | `#password`, `formControlName="password"` |
| Submit | `button.login-submit`, text **"Enter the Vault"**, `[disabled]` until form valid |
| Error banner | `div.login-error[role="alert"]` — "Invalid username or password" |
| API | `POST http://localhost:8085/api/v1/auth/authenticate` body `{ userName, password }` → `{ success, token }` |
| Token storage | `localStorage.token` + `localStorage.username` |
| On success | router navigates to `/charactermanager` |

### Selector strategy (and why `data-cy`)

This app has no test attributes, so start with what exists — in *descending* order of preference:

1. `cy.contains('button', 'Enter the Vault')` — user-visible text, survives refactors
2. `#username` — stable IDs
3. `input[formControlName="password"]` — framework attributes, decent
4. `.login-submit` — style classes, worst: they change when CSS changes

Then fix the root problem: add `data-cy="login-submit"` etc. to elements you test, and select
with `cy.get('[data-cy=login-submit]')`. Test attributes are contract, classes are styling —
never couple tests to styling. Make adding `data-cy` part of every exercise from here on.

### Exercise

`cypress/e2e/login.cy.ts`:

```ts
describe('login', () => {
  beforeEach(() => cy.visit('/login'));

  it('gates submit on form validity', () => {
    cy.contains('button', 'Enter the Vault').should('be.disabled');
    cy.get('#username').type('yourUser');
    cy.contains('button', 'Enter the Vault').should('be.disabled');
    cy.get('#password').type('yourPassword');
    cy.contains('button', 'Enter the Vault').should('be.enabled');
  });

  it('rejects bad credentials', () => {
    cy.get('#username').type('nobody');
    cy.get('#password').type('wrong{enter}');   // {enter} triggers ngSubmit
    cy.get('.login-error')
      .should('be.visible')
      .and('have.attr', 'role', 'alert')
      .and('contain.text', 'Invalid username or password');
    cy.url().should('include', '/login');       // still here
  });

  it('logs in and lands on the character manager', () => {
    cy.get('#username').type('yourUser');
    cy.get('#password').type('yourPassword');
    cy.contains('button', 'Enter the Vault').click();
    cy.url().should('include', '/charactermanager');
    cy.window().its('localStorage.token').should('exist');
  });
});
```

Note what's absent: no waits. `cy.url().should(...)` retries through the HTTP round-trip and
the router navigation on its own.

### Graduate: `cy.session`

UI login in every spec is correct exactly once — in `login.cy.ts`. Everywhere else it's wasted
seconds per test. `cy.session` runs a setup function once, snapshots browser storage
(localStorage, cookies, sessionStorage), and restores it per test:

```ts
// cypress/support/e2e.ts (or a helper module)
function loginSession(user: string, pass: string) {
  cy.session([user], () => {
    cy.request('POST', 'http://localhost:8085/api/v1/auth/authenticate', {
      userName: user, password: pass,
    }).then(({ body }) => {
      expect(body.success).to.be.true;
      window.localStorage.setItem('token', body.token);
      window.localStorage.setItem('username', user);
    });
  }, {
    validate: () => cy.window().its('localStorage.token').should('exist'),
  });
}
```

Two things happened there: the login became **programmatic** (`cy.request` hits the API
directly — no UI, ~50ms) and **cached** (the session restores across specs). This mirrors what
the app itself needs: the auth interceptor only reads `localStorage.token`, so seeding it is a
legitimate login. Call `loginSession(...)` in `beforeEach`, then `cy.visit('/charactermanager')`.

> **Backendless option:** this app has a first-class demo mode — set
> `localStorage.demoMode = 'true'` plus any non-JWT `token` value and the whole app runs on
> in-memory seed data, zero servers. Great for practicing slices 2–3 without booting Spring
> Boot. Caveat: shopping deliberately throws in demo mode, so Slice 4 needs the real or stubbed
> backend.

**Common beginner mistake at this stage:** `cy.wait(2000)` sprinkled everywhere to "make it
stable." Fixed waits are both too slow (they always burn the full duration) and too fast (the
day the backend takes 2.1s, the suite is red). Every `cy.wait(number)` should become either an
assertion that retries or a `cy.wait('@alias')` on an intercepted request (Slice 3).

> **Go deeper — environments:** hardcoding `localhost` scales badly. Real suites set `baseUrl`
> per environment via config files (`cypress.config.ts` reads `CYPRESS_BASE_URL`, or
> `--config-file cypress.staging.ts`) and put API hosts in `env: {}` accessed with
> `Cypress.env('authApi')`. <https://docs.cypress.io/app/references/configuration>

---

## 2. Slice 2 — Character creation wizard

**Introduces:** form interactions at scale, validation assertions, multi-step state, conditional
flows, re-render pitfalls.

### The material

The wizard is a **modal, not a route** — there's no URL to `cy.visit`. You open it through the
UI: the sidenav's **"Forge Hero"** button (`button.btn.primary` in `.sidebar-footer`). That's a
feature for learning: real user flows, no deep-link shortcuts.

| Thing | Fact |
|---|---|
| Modal root | `div.modal.wizard[role="dialog"][aria-label="Create a character"]` |
| Steps | 8 for non-casters, **9 for casters** (spells step appears conditionally) |
| Step indicator | `.wizard-steps .step-dot`, `.active` = current, `.done` = completed |
| Nav buttons | `button` "Next →" / "Back" / "Cancel"; final step: "Inscribe". Next/Inscribe `[disabled]` until the step's `canAdvance` rule passes |
| Step 1 | name input, `placeholder="e.g. Seraphina Goldveil"`; requires non-blank name |
| Steps 2–4 | click-to-select tiles (species, class, background) — loaded async |
| Step 5 | skill chips — must pick *exactly* the class's `choose` count; background-granted skills render as **locked/disabled** chips that don't count toward the quota |
| Step 6 | ability scores: standard array `[15,14,13,12,10,8]` assigned via one `select.ability-select` per row (options shrink as values are claimed), or point-buy; then +2/+1 background bonuses via two `.bonus-selectors` selects on two *different* abilities |
| Draft persistence | wizard state auto-saves to `localStorage['tm_pc_draft:<username>']` (`tm_pc_draft:anon` in demo mode — no username is stored); restored on reopen **including the step you were on**; cleared by Cancel or Inscribe |
| Save | `POST http://localhost:8080/api/v1/pc/add` with a flattened PC payload |

### Exercise

Create a Fighter (non-caster → 8 steps) end to end:

```ts
describe('character creation wizard', () => {
  beforeEach(() => {
    loginSession('yourUser', 'yourPassword');
    cy.visit('/charactermanager');
    cy.contains('button', 'Forge Hero').click();
    cy.get('.modal.wizard').should('be.visible');
  });

  it('walks a fighter through all 8 steps', () => {
    const next = () => cy.contains('button', 'Next →').click();

    // Step 1 — Next disabled until named
    cy.contains('button', 'Next →').should('be.disabled');
    cy.get('input[placeholder="e.g. Seraphina Goldveil"]').type('Borin Ironfoot');
    next();

    // Steps 2–4 — tiles load async; contains() retries until they render
    cy.contains('Dwarf').click();   next();
    cy.contains('Fighter').click(); next();
    cy.contains('Soldier').click(); next();

    // Step 5 — pick exactly the required skill count (Fighter: 2).
    // Gotcha: Soldier already grants Athletics + Intimidation as LOCKED
    // background chips that don't count toward the quota — pick two others.
    cy.contains('button', 'Athletics').should('be.disabled');
    cy.contains('button', 'Perception').click();
    cy.contains('button', 'Next →').should('be.disabled');   // 1 of 2 — still gated
    cy.contains('button', 'Survival').click();
    next();

    // Step 6 — standard array via per-row selects, then the +2/+1 bonuses
    // (each pick re-renders the other selects' options — re-query per row)
    // e.g.: cy.contains('.ability-row', 'STR').find('select.ability-select').select('15');
    // then the two .bonus-selectors selects; assert Next flips to enabled

    // Step 7 — equipment choice A or B
    // Step 8 — review, then:
    cy.contains('button', 'Inscribe').click();
    cy.get('.modal.wizard').should('not.exist');
    cy.contains('Borin Ironfoot').should('be.visible');       // in the sidenav roster
  });

  it('restores a draft after reload', () => {
    cy.get('input[placeholder="e.g. Seraphina Goldveil"]').type('Draft Test');
    cy.contains('button', 'Next →').click();                   // step change → snapshot
    cy.reload();
    cy.contains('button', 'Forge Hero').click();
    // The draft restores the STEP too — we saved on step 2, so it reopens there.
    cy.get('.wizard-steps .step-dot.active').should('contain.text', '2');
    cy.contains('button', 'Back').click();
    cy.get('input[placeholder="e.g. Seraphina Goldveil"]')
      .should('have.value', 'Draft Test');                     // tm_pc_draft:<user> restored
  });
});
```

> **This slice is already implemented as a reference** in
> [`cypress/e2e/character-creation.cy.ts`](../cypress/e2e/character-creation.cy.ts) (with the
> scaffold from section 0 and the dnd5eapi stubs from the "go deeper" below). Try writing your
> own version first, then diff against it. Run with `npm start` + `npm run e2e` — demo mode
> means no Java backends and no internet needed.

Then repeat with a Wizard and assert the step-dot count is **9** — the spells step appears.
Asserting on structure that changes with domain rules is exactly the kind of test that catches
real regressions.

**Common beginner mistake at this stage:** *detached DOM elements.* You grab a button, the step
transition re-renders the modal content, then you act on the stale reference —
`element is detached from the DOM`. The fix is structural: **re-query after anything that
re-renders**. Never hold an element across a `.click()` that changes the view; chains like
`cy.contains('button', 'Next →').click()` re-resolved fresh each step (as in the `next()` helper
above) are immune. Angular's `@if` blocks tear down and rebuild nodes aggressively — assume any
step change invalidates every element reference.

> **Go deeper — deterministic step data:** steps 2–4 fetch classes/species from the external
> `https://www.dnd5eapi.co/api/2024/...` API. Third-party dependencies in tests are flake
> generators; intercept them (Slice 3 skill) with fixtures so the tile lists are always the
> same. <https://docs.cypress.io/api/commands/intercept>

---

## 3. Slice 3 — Spell search (async content + `cy.intercept`)

**Introduces:** `cy.intercept` stub vs. spy, fixtures, request aliasing + `cy.wait('@alias')`,
loading/empty states.

### The material — with a twist

Here's a lesson in reading the app before testing it: this search **has no debounce and no
search endpoint**. The spell list loads *once* from static assets —

- `GET /assets/data/spells/srd-5.2-spells.json`
- `GET /assets/data/spells/phb-2024-supplement.json`

— and every keystroke filters the in-memory array client-side. So there's nothing to debounce
and no per-keystroke request to intercept. The interceptable seam is the **one-time JSON load**,
and that's where you get deterministic results. (The pattern you *will* meet at work — debounced
server-side typeahead — is in the sidebar below.)

Selectors, inside the wizard's spells step (create a caster — e.g., Wizard — to reach it):

| Thing | Selector |
|---|---|
| Search input | `input.spell-search` (`placeholder="Search…"`) |
| Level tabs | `button.spell-level-tab` — "All" / "Cantrip" / "1st", `.active` when selected |
| Result rows | `.spell-scroll .spell-row` → `button.spell-pick` (`.active` = selected) |
| Add/remove | expand a row, then `button` "Add to spells" / "Remove from spells" |
| Loading state | `div.loading` — "Loading spells…" |
| Empty state | `div.loading` — "No spells match your search." |
| Counter | `.spell-counter` — "N/M cantrips · N/M spells", `.complete` when maxed |

### Exercise

Fixture first — `cypress/fixtures/spells.json` with three spells shaped like the real file
(open `src/assets/data/spells/srd-5.2-spells.json` and copy three entries: one cantrip, two
level-1). Then:

```ts
describe('spell search', () => {
  beforeEach(() => {
    // ORDER MATTERS: intercept BEFORE the action that triggers the request
    cy.intercept('GET', '**/assets/data/spells/srd-5.2-spells.json',
      { fixture: 'spells.json' }).as('spells');
    cy.intercept('GET', '**/assets/data/spells/phb-2024-supplement.json',
      { body: [] });

    loginSession('yourUser', 'yourPassword');
    cy.visit('/charactermanager');
    // ...open wizard, walk a Wizard-class draft to the spells step...
    cy.wait('@spells');                       // the load actually happened
  });

  it('filters deterministically against the stub', () => {
    cy.get('.spell-row').should('have.length', 3);        // exactly our fixture

    cy.get('.spell-search').type('fire');
    cy.get('.spell-row').should('have.length', 1);        // whatever your fixture makes true
    cy.contains('.spell-pick-name', 'Fire Bolt');

    cy.get('.spell-search').clear().type('zzzz');
    cy.contains('No spells match your search.').should('be.visible');

    cy.get('.spell-search').clear();
    cy.contains('button.spell-level-tab', 'Cantrip').click();
    cy.get('.spell-row').should('have.length', 1);        // only the fixture cantrip
  });

  it('shows the loading state while the request is in flight', () => {
    cy.intercept('GET', '**/srd-5.2-spells.json',
      { fixture: 'spells.json', delay: 1500 }).as('slowSpells');
    // ...re-enter the spells step...
    cy.contains('Loading spells…').should('be.visible');
    cy.wait('@slowSpells');
    cy.contains('Loading spells…').should('not.exist');
  });
});
```

The point of the stub isn't speed — it's **control**. With 3 known spells you can assert exact
counts. Against the real 300-spell file, your assertions degrade to `length.greaterThan(0)`
mush. And `delay:` lets you *manufacture* the slow-network case that's nearly impossible to
test reliably against a real server.

**Common beginner mistake at this stage:** registering `cy.intercept` *after* the request
already fired. Intercepts only match future requests — if `cy.visit` (or the step transition)
triggered the fetch before your intercept line executed in the queue, the real response wins
and your fixture is ignored, usually silently. Intercept setup goes at the top of the test,
before the visit/action. Corollary: a `cy.wait('@alias')` that times out usually means the
request never matched your URL pattern — check the Cypress runner's request log.

> **Sidebar — the debounced typeahead you'll actually see at work:** server-side search fires
> `GET /search?q=...` per keystroke behind a `debounceTime(300)`. Two idioms: (1) alias the
> intercept and `cy.wait('@search')` after typing — the wait absorbs the debounce with zero
> guessing; assert on `interception.request.url` to verify the final query string, and stub
> different bodies per query using a route handler function. (2) If the debounce itself is under
> test, `cy.clock()` + `cy.tick(300)` gives you deterministic control of time. Never
> `cy.wait(350)` "to be safe."

> **Go deeper — stub vs. real API:** stub when you need determinism, speed, and error-path
> coverage (409s, timeouts, empty lists); hit the real API in a small number of smoke/journey
> tests that prove the contract actually holds. The seam belongs at the HTTP boundary — don't
> mock Angular services from E2E. <https://docs.cypress.io/app/guides/network-requests>

---

## 4. Slice 4 — Shop purchase (flows + payload verification)

**Introduces:** multi-view flows, asserting on **request payloads**, server-authoritative state
changes, error-path stubbing.

### The material

The shop is a **session-mode panel**, not a route. In production it renders only when the
session poll says a DM opened a shop for your character (`state.shopForMe`) — orchestrating
that live requires a second browser as the DM. For a solo crash course, stub the session/shop
GETs so the panel renders, and stub the purchase POST. (Demo mode is out: `ShopService`
hard-throws on purchases there.)

| Thing | Fact |
|---|---|
| Panel | `section.shop-panel > .shop-card`, title `h2.shop-title` "Browse & buy" |
| Gold balance | `span.purse` — formatted from copper (`cp + sp·10 + ep·50 + gp·100 + pp·1000`) |
| Catalog rows | `ul.catalog > li.catalog-row` → `.item-name`, `.item-price` |
| Buy button | `button.btn.buy` — text "Buy", "Too costly" (unaffordable), "…" (in flight) |
| Purchase | `POST :8080/api/v1/session/{sessionId}/shop/purchase` body **`{ pcId, itemKey, qty: 1 }`** |
| Response | `{ coins, inventory }` — server-authoritative; the client patches the PC from it |
| Errors | 409 → toast "Not enough coin for that purchase.", 403 → "That character isn't at this shop." |

### Exercise

```ts
describe('shop purchase', () => {
  beforeEach(() => {
    loginSession('yourUser', 'yourPassword');
    // Stub the shop payload so the Browse & buy panel renders without a live DM:
    cy.intercept('GET', '**/api/v1/session/*/shop', {
      body: {
        shopType: 'GENERAL', settlement: 'Phandalin',
        items: [{ itemKey: 'torch', name: 'Torch', costCp: 1 },
                { itemKey: 'plate-armor', name: 'Plate Armor', costCp: 150000 }],
      },
    }).as('shop');
    // ...enter session mode with your PC (stub the session snapshot with shopForMe: true
    //    the same way if you're running fully stubbed)...
  });

  it('sends the right payload and updates the purse from the response', () => {
    cy.intercept('POST', '**/shop/purchase', {
      body: { coins: { cp: 4, sp: 0, ep: 0, gp: 9, pp: 0 }, inventory: [] },
    }).as('purchase');

    cy.get('.purse').invoke('text').as('purseBefore');

    cy.contains('.catalog-row', 'Torch').find('button.buy').click();

    // The core skill: assert on what the app SENT, not just what it shows
    cy.wait('@purchase').its('request.body').should('deep.include', {
      itemKey: 'torch',
      qty: 1,
    });

    // State change: purse re-renders from the server-authoritative response
    cy.get('@purseBefore').then((before) => {
      cy.get('.purse').should('not.have.text', String(before));
    });
  });

  it('surfaces the broke-adventurer error path', () => {
    cy.intercept('POST', '**/shop/purchase', {
      statusCode: 409, body: { message: 'insufficient funds' },
    }).as('purchase409');

    cy.contains('.catalog-row', 'Torch').find('button.buy').click();
    cy.wait('@purchase409');
    cy.contains('Not enough coin for that purchase.').should('be.visible');
    // and the unaffordable item never even offered a Buy:
    cy.contains('.catalog-row', 'Plate Armor')
      .find('button.buy').should('contain.text', 'Too costly').and('be.disabled');
  });
});
```

Payload assertion (`.its('request.body')`) is the skill that separates E2E tests that check
*pixels* from tests that check *contracts*. The 409 test is something you essentially cannot
write against a real backend without contorting your seed data — with a stub it's three lines.

**Common beginner mistake at this stage:** asserting the balance immediately after `.click()`
without waiting on the aliased request. Sometimes the response lands within the assertion's
retry window and it passes; sometimes not — the classic "flaky on CI, fine locally" test. The
rule: any assertion about post-request state comes **after** `cy.wait('@alias')`. The wait
also fails loudly if the request never fired, which is a better error than a stale-UI
assertion timeout.

> **Go deeper — seeding real data:** the real-world alternative to stubbing is a known database
> state: `cy.request` against your own API in `before` hooks (create the PC, set its coins),
> `cy.task` for direct DB access from Node, or SQL seed scripts run per suite. Real E2E suites
> use both: stubbed tests for breadth and error paths, a thin seeded-data journey layer for
> contract truth. <https://docs.cypress.io/api/commands/task>

---

## 5. Next steps (names only, on purpose)

- **CI integration** — headless `cypress run`, containerized app + DB, artifacts (videos/screenshots) on failure
- **Custom command libraries** — promote `loginSession` to `cy.login()` via `Cypress.Commands.add` + TS declaration merging
- **Component testing** — mount single Angular components in Cypress without the full app
- **Visual regression** — screenshot-diffing plugins for the "it renders but looks wrong" class of bugs
- **Parallelization / Cypress Cloud** — spec splitting, flake analytics, test replay

Work slices 1–4 first. Everything above is additive; none of it changes the mental model from
section 0 — and the mental model is the part your new team will expect you to already have.
