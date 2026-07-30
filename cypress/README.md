# Cypress E2E — Getting Started

Everything you need to run and write end-to-end tests for Table Mimic. If you've never opened
Cypress before, start at the top and you'll have a test running in about two minutes.

Learning the *concepts*? Read [`docs/cypress-crash-course.md`](../docs/cypress-crash-course.md)
instead — this file is the operational manual, that one is the course.

---

## 1. Run your first test

**Prerequisite: the app must be running.** Cypress drives a real browser against a real dev
server — it does not start one for you. In one terminal:

```bash
npm start
```

Wait for `Compiled successfully` and confirm <http://localhost:4200> loads. Then, in a second
terminal:

```bash
npm run e2e
```

That opens the Cypress app. Click **E2E Testing** → pick **Chrome** → **Start E2E Testing**, then
click `character-creation.cy.ts` in the spec list. The browser opens and the test drives the UI
in front of you while the left-hand command log lists every step.

That's it. The existing spec runs **fully network-stubbed** — every backend response is faked
at the HTTP boundary with `cy.intercept` — so you do *not* need the Java backends
(`authentication-service` on :8085, `character-manager-service` on :8080) or even an internet
connection. The entire real Angular app still runs; only the network is fake. (This is the
industry-standard pattern — see "How this maps to a corporate suite" below.)

### Headless mode

For a quick pass/fail with no GUI — this is what CI would run:

```bash
npm run e2e:run
```

Runs every spec in Electron, prints a results table, and saves video + failure screenshots under
`cypress/videos/` and `cypress/screenshots/`. To run a single spec:

```bash
npx cypress run --spec cypress/e2e/character-creation.cy.ts
```

### Which mode when

| | `npm run e2e` (open) | `npm run e2e:run` (headless) |
|---|---|---|
| Use it for | writing and debugging tests | verifying everything still passes |
| Feedback | live browser, time-travel debugger, auto-rerun on save | terminal summary + video artifacts |
| Speed | slower, interactive | faster, one shot |

While the Cypress app is open, saving a spec file re-runs it immediately. Keep it open while
you write.

---

## 2. What's in here

```
cypress.config.ts           # baseUrl, spec pattern, timeouts (repo root)
cypress/
├── e2e/                    # the specs — one file per feature
│   └── character-creation.cy.ts
├── fixtures/               # canned JSON responses for cy.intercept
│   └── dnd5e/              # stubbed species/class data for the wizard
├── support/
│   ├── e2e.ts              # auto-loaded before every spec
│   └── commands.ts         # cy.visitAuthed(), cy.loginSession(), cy.enterDemo()
├── tsconfig.json           # keeps Cypress + Jasmine globals from colliding
└── README.md               # this file
```

Two config details worth knowing up front, both in
[`cypress.config.ts`](../cypress.config.ts):

- **`baseUrl: 'http://localhost:4200'`** — so specs write `cy.visit('/login')`, not the full URL.
  If your dev server runs on a different port, change it here.
- **`defaultCommandTimeout: 10000`** — Cypress retries a failing query for 10s before giving up
  (the stock default is 4s). Raised because the character wizard can pull class/species data
  from the external dnd5eapi.co.

Also note `cypress/tsconfig.json`: this repo has Jasmine (unit tests) *and* Cypress, and both
declare global `describe`/`it`/`expect` with incompatible types. That file scopes Cypress's
types to this directory, and the root `tsconfig.json` excludes `cypress/`. If your editor starts
red-squiggling `cy.`, that's the file to look at.

---

## 3. Logging in

Most specs need an authenticated app. Three custom commands are defined in
[`support/commands.ts`](support/commands.ts), one per tier:

```ts
cy.visitAuthed('/charactermanager');         // stubbed specs — seeds a fake JWT, no backends
cy.loginSession('yourUser', 'yourPassword'); // real-backend specs — auth service on :8085
cy.enterDemo();                              // app demo mode — manual convenience only
```

**`cy.visitAuthed(path, user?)`** is the default for network-stubbed specs. It mints a
structurally valid JWT (real header/payload, garbage signature — clients never verify
signatures, only servers do) and seeds `localStorage.token` + `username` before the app boots.
Everything downstream is real production code: the route guard decodes the token and checks its
`exp`, and the auth interceptor attaches it as a `Bearer` header — which your spec can then
assert on.

**`cy.loginSession(user, pass)`** POSTs straight to `:8085/api/v1/auth/authenticate` and seeds
the real token — no UI typing. It wraps `cy.session()`, which caches the browser storage and
restores it per test, so the first test pays the network cost and the rest are instant. Use it
for the true end-to-end layer (real backends, seeded data).

**`cy.enterDemo()`** opts into the app's built-in demo mode (in-memory seed data, zero HTTP).
Kept as a convenience for manually poking the app — **not used by the suite**, because demo
mode swaps out the service layer in-app, so a test running against it never exercises the real
HTTP client, interceptor, or serialization code.

### How this maps to a corporate suite

A production E2E suite is two layers, and this repo mirrors that:

1. **Stubbed-network specs (the bulk).** The whole real frontend runs; `cy.intercept` controls
   every response. Fast, deterministic, offline, and the only sane way to cover error paths
   (409s, timeouts, empty states). The risk — drifting from the real API contract — is managed
   by asserting on **request payloads** (see the `@addPc` assertion in
   [`e2e/character-creation.cy.ts`](e2e/character-creation.cy.ts)), so a contract change breaks
   the test even though the response is fake.
2. **A thin true-E2E layer (a handful of journey tests).** Real deployed backends, test data
   seeded via API calls (`cy.request`) or DB tasks (`cy.task`), `cy.loginSession` for auth.
   Slow and environment-dependent, so you keep few of them — their job is proving the stubs
   still tell the truth.

An in-app "demo mode" like this app's is neither layer — it's a product feature, not a test
strategy. If your employer's app has one, don't test against it.

---

## 4. Writing a new spec

Create `cypress/e2e/<feature>.cy.ts`. Minimum viable spec:

```ts
describe('login page', () => {
  beforeEach(() => {
    cy.visit('/login');          // relative to baseUrl
  });

  it('gates submit until the form is valid', () => {
    cy.contains('button', 'Enter the Vault').should('be.disabled');
    cy.get('#username').type('someone');
    cy.get('#password').type('secret');
    cy.contains('button', 'Enter the Vault').should('be.enabled');
  });
});
```

Save it — if the Cypress app is open, it appears in the spec list immediately.

**Three rules that prevent most beginner pain:**

1. **Never use `cy.wait(2000)`.** Cypress retries `cy.get`, `cy.contains`, and `.should()`
   automatically until they pass or time out. Assert the thing you're waiting for and the wait
   is free and exact.
2. **Don't store elements in variables.** `cy.get(...)` returns a queue handle, not an element.
   Chain commands (`cy.get('#x').type('y').should(...)`) or use `.then(($el) => ...)` when you
   truly need the DOM node.
3. **Never `await` a `cy.` command.** They're not Promises. Mixing `async/await` with the
   command queue produces out-of-order execution and flaky specs.

The *why* behind all three is section 0 of the crash course. It's the single highest-value thing
to read before writing your third spec.

**Selectors:** prefer what the user sees — `cy.contains('button', 'Inscribe')` — then stable IDs
(`#username`), then framework attributes (`input[formControlName="password"]`). Avoid styling
classes; they change when CSS changes. Best practice is a dedicated `data-cy` attribute on
anything you test, selected as `cy.get('[data-cy=inscribe]')`. This app doesn't have them yet —
adding them as you go is a legitimate part of the work.

---

## 5. Faking the backend

`cy.intercept()` lets you replace any HTTP response so tests are deterministic and can cover
error paths that are painful to reproduce for real:

```ts
// Must be registered BEFORE the action that fires the request.
cy.intercept('GET', '**/api/2024/classes', { fixture: 'dnd5e/class-list.json' }).as('classes');
cy.visit('/charactermanager');
cy.wait('@classes');            // proceeds the moment it lands — no guessing
```

The `.as('classes')` alias also lets you assert on what the app *sent*, which is how you verify
a payload contract:

```ts
cy.wait('@purchase').its('request.body').should('deep.include', { itemKey: 'torch', qty: 1 });
```

JSON files under `cypress/fixtures/` are referenced by path relative to that directory. See
`fixtures/dnd5e/` for working examples.

---

## 6. Debugging a failing test

- **Time travel:** in the open-mode command log, hover any command to see a DOM snapshot of the
  app at that exact moment. Click it to pin the snapshot and inspect it with devtools. This
  answers "what did the page actually look like when it failed?" faster than anything else.
- **Read the error carefully** — Cypress errors are unusually good. It names the failing
  selector, how long it retried, and often what it *did* find instead.
- **`cy.pause()`** stops the run so you can step through command by command.
  **`.debug()`** in a chain drops a `debugger` breakpoint with the subject in scope.
- **Headless failures:** check `cypress/screenshots/` and `cypress/videos/` — every failure gets
  a screenshot at the moment of death and a video of the whole spec.

### Common errors and what they mean

| Error | Cause | Fix |
|---|---|---|
| `cy.visit() failed trying to load http://localhost:4200` | dev server isn't running | `npm start` in another terminal |
| `Timed out retrying: Expected to find element` | selector is wrong, or the element hasn't rendered | check the DOM snapshot; verify the selector against `src/` |
| `element is detached from the DOM` | you grabbed an element, then the view re-rendered | re-query instead of reusing the reference |
| `cy.wait() timed out waiting for route: @alias` | the intercept never matched | check the URL pattern; confirm the intercept was registered *before* the request |
| Response is real data despite a stub | intercept registered after the request fired | move `cy.intercept` above `cy.visit` |
| `cypress run` exits instantly, no output at all (Windows, exit code `0x80000003`) | the bundled Electron's own sandbox crashes on some Windows setups | set `$env:ELECTRON_EXTRA_LAUNCH_ARGS='--no-sandbox'` before running, or use `npx cypress run --browser chrome` |

---

## 7. Where to go next

- [`docs/cypress-crash-course.md`](../docs/cypress-crash-course.md) — the four-slice course
  (login → character wizard → spell search → shop), with the async command-queue model explained
  properly.
- [Cypress docs](https://docs.cypress.io) — the official API reference; the "Introduction to
  Cypress" page is the canonical explanation of retry-ability.
- Not set up yet, listed in the crash course as next steps: CI integration, component testing,
  visual regression.
