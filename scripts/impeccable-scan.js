#!/usr/bin/env node
/**
 * Impeccable detector scan of the real, signed-in screens.
 *
 * `impeccable detect <url>` opens a clean browser and cannot sign in, so on
 * its own it only ever sees the login page. This script gets it past that
 * with no backend and no credentials:
 *
 *   1. serves the production build (dist/) on a local port,
 *   2. starts a headless Chrome with its DevTools port open,
 *   3. turns on the app's own demo mode (localStorage.demoMode = 'true',
 *      in-memory seed data) and clicks its way to each screen in SURFACES,
 *   4. at each screen runs `impeccable detect --cdp <port>`, which scans the
 *      page exactly as it is shown.
 *
 * The CLI, unlike an in-page detector run, applies .impeccable/config.json,
 * so the allow-list there is honoured.
 *
 * It needs nothing installed beyond Node 22+ and Chrome: the DevTools
 * protocol is spoken over Node's built-in WebSocket, and the detector comes
 * from `npx impeccable@<IMPECCABLE_VERSION>`.
 *
 * This script never fails a build. Findings, a screen that could not be
 * reached, even a detector crash all end in exit code 0, with a warning in
 * the log. It is an advisory report, not a gate. See
 * docs/impeccable-adoption-plan.md, "Phase 4 results".
 *
 * Usage:
 *   npm run build -- --configuration production
 *   node scripts/impeccable-scan.js [options]
 *
 *   --github          print GitHub Actions annotations (the detector's own
 *                     --github output) and write a job summary
 *   --json <file>     write every finding, per screen, to <file>
 *   --no-config       ignore .impeccable/config.json (shows what the
 *                     allow-list is hiding)
 *   --only <a,b>      scan only the named screens
 *   --viewport <WxH>  viewport, default 375x812 (players hold phones)
 *   --theme <name>    midnight (default), candlelit or vellum
 *   --dist <dir>      built app, default dist/character-creator/browser
 */
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

// Pinned on purpose: this is the version the skill on the owner's machine was
// installed from, and a detector upgrade changes the rule set. Bump it by hand.
const IMPECCABLE_VERSION = '4.8.0';

const ROOT = path.resolve(__dirname, '..');

// ── The screens ──────────────────────────────────────────────────────────────
// Each entry is a screen the app's demo mode can reach. `go` drives the page
// there; the detector then scans whatever is on screen. `demo: false` means
// the screen is only shown to a signed-out visitor.
const SURFACES = [
  // Signed out. A reset link with any token shows the form; nothing is sent.
  { name: 'login', demo: false, go: p => p.open('/login', '.login-card') },
  { name: 'register', demo: false, go: p => p.open('/register', 'form') },
  { name: 'reset-password', demo: false, go: p => p.open('/reset-password?token=scan', 'form') },

  // Player.
  { name: 'roster-empty', go: p => p.asRole('player') },
  { name: 'sheet', go: p => openSheet(p, 'Sheet') },
  { name: 'sheet-spells', go: p => openSheet(p, 'Spells') },
  { name: 'sheet-inventory', go: p => openSheet(p, 'Inventory') },
  { name: 'sheet-renown', go: p => openSheet(p, 'Renown') },
  { name: 'sheet-followers', go: p => openSheet(p, 'Followers') },
  { name: 'sheet-professions', go: p => openSheet(p, 'Professions') },
  { name: 'sheet-notes', go: p => openSheet(p, 'Notes') },
  { name: 'sheet-log', go: p => openSheet(p, 'Log') },
  {
    name: 'settings',
    go: async p => {
      await p.asRole('player');
      await p.click('.account-row');
      await p.waitForSelector('.slideover.dialog-active');
    },
  },
  {
    name: 'dice-roller',
    go: async p => {
      await openSheet(p, 'Sheet');
      await p.click('.dice-fab');
      await p.waitForSelector('.dice-modal.dialog-active');
    },
  },
  {
    name: 'wizard',
    go: async p => {
      await p.asRole('player');
      await p.click('button.btn.primary', 'Create Character');
      await p.waitForSelector('.modal.wizard.dialog-active');
    },
  },
  {
    name: 'wizard-class',
    go: async p => {
      await p.asRole('player');
      await p.click('button.btn.primary', 'Create Character');
      await p.click('.modal.wizard button.btn.primary', 'Next');
    },
  },

  // Dungeon Master.
  { name: 'dm-campaigns', go: p => p.asRole('dm') },
  { name: 'campaign-dashboard', go: p => openCampaign(p) },
  {
    name: 'session',
    go: async p => {
      await openCampaign(p);
      await p.click('button.btn.play', 'Start Session');
      await p.waitFor(`document.querySelector('h1.sheet-name')?.textContent.includes('Initiative')`, 'the session screen');
    },
  },
  {
    // An encounter in progress: this is the screen with the whose-turn row.
    name: 'session-encounter',
    go: async p => {
      await openCampaign(p);
      await p.click('button.btn.play', 'Start Session');
      await p.select('select[aria-label="Encounter to load"]', 'Goblin Ambush');
      await p.click('button.btn.primary', 'Load');
      await p.click('button.btn.primary', 'Start Encounter');
    },
  },
];

async function openSheet(p, tab) {
  await p.asRole('player');
  await p.click('.roster-item', 'Lyra Moonwhisper');
  await p.waitForSelector('h1.sheet-name');
  await p.click('.sheet-tab', tab);
}

async function openCampaign(p) {
  await p.asRole('dm');
  await p.click('.campaign-item', 'The Veiled Compass');
  await p.waitFor(`document.querySelector('h1.sheet-name')?.textContent.includes('Veiled Compass')`, 'the campaign dashboard');
}

// ── Options ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    github: false,
    json: null,
    config: true,
    only: null,
    viewport: { width: 375, height: 812 },
    theme: 'midnight',
    dist: path.join(ROOT, 'dist', 'character-creator', 'browser'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--github') opts.github = true;
    else if (a === '--no-config') opts.config = false;
    else if (a === '--json') opts.json = path.resolve(argv[++i]);
    else if (a === '--only') opts.only = argv[++i].split(',').map(s => s.trim());
    else if (a === '--theme') opts.theme = argv[++i];
    else if (a === '--dist') opts.dist = path.resolve(argv[++i]);
    else if (a === '--viewport') {
      const [w, h] = argv[++i].split('x').map(Number);
      opts.viewport = { width: w, height: h };
    } else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
}

// ── Static server with single-page-app fallback ──────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
};

function serve(dist) {
  const index = path.join(dist, 'index.html');
  if (!fs.existsSync(index)) {
    throw new Error(`No build at ${dist}. Run: npm run build -- --configuration production`);
  }
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dist, urlPath);
    // Stay inside dist; anything that is not a real file is an app route.
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = index;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ── Chrome ───────────────────────────────────────────────────────────────────
function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const found = candidates.find(c => c && fs.existsSync(c));
  if (!found) throw new Error('No Chrome found. Set CHROME_BIN to a Chrome or Chromium binary.');
  return found;
}

async function launchChrome(viewport) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'impeccable-scan-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0', // Chrome picks a free port and writes it to the profile
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    ...(process.env.CHROME_FLAGS ? process.env.CHROME_FLAGS.split(/\s+/).filter(Boolean) : []),
    'about:blank',
  ];
  const child = spawn(findChrome(), args, { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) {
    child.kill();
    throw new Error('Chrome did not open its DevTools port within 15s.');
  }
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  return { child, port, profile };
}

// ── A very small DevTools-protocol client ────────────────────────────────────
class Page {
  static async attach(port) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find(t => t.type === 'page');
    if (!target) throw new Error('Chrome has no page to attach to.');
    const page = new Page(new WebSocket(target.webSocketDebuggerUrl));
    await new Promise((resolve, reject) => {
      page.ws.addEventListener('open', resolve, { once: true });
      page.ws.addEventListener('error', () => reject(new Error('DevTools socket failed')), { once: true });
    });
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    return page;
  }

  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message));
      else waiter.resolve(msg.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Run an expression in the page and return its (JSON-serialisable) value. */
  async eval(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    }
    return result.value;
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor('document.readyState === "complete"');
  }

  /** Poll until the expression is truthy; the label is what the error says. */
  async waitFor(expression, label = expression, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let value = false;
      try { value = await this.eval(`!!(${expression})`); } catch { /* mid-navigation */ }
      if (value) return;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
      await sleep(100);
    }
  }

  waitForSelector(selector, timeoutMs) {
    return this.waitFor(`document.querySelector(${JSON.stringify(selector)})`, selector, timeoutMs);
  }

  /** Click the first visible element matching the selector (and, if given, the text). */
  async click(selector, text) {
    const what = text ? `${selector} "${text}"` : selector;
    await this.waitFor(`(${FIND})(${JSON.stringify(selector)}, ${JSON.stringify(text ?? null)})`, what);
    await this.eval(`(${FIND})(${JSON.stringify(selector)}, ${JSON.stringify(text ?? null)}).click()`);
    await this.settle();
  }

  /** Pick the option containing the text in a <select>, the way a person would. */
  async select(selector, optionText) {
    await this.waitForSelector(selector);
    const picked = await this.eval(`(() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      const option = [...select.options].find(o => o.textContent.includes(${JSON.stringify(optionText)}));
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!picked) throw new Error(`no option "${optionText}" in ${selector}`);
    await this.settle();
  }

  /** Let Angular render and any short transition finish. */
  async settle(ms = 400) {
    await sleep(ms);
  }

  /** Load a path of the served app and wait for something on it. */
  async open(pathname, selector) {
    await this.goto(this.base + pathname);
    await this.waitForSelector(selector);
    await this.settle();
  }

  /** Sign-in state for the next screen: demo mode on (via the real button) or off. */
  async setDemo(on) {
    if (on === this.demoOn) return;
    await this.goto(this.base + '/login');
    if (on) {
      await this.click('button', 'Enter in Demo Mode');
      await this.waitFor(`location.pathname.startsWith('/charactermanager')`, 'the signed-in app');
    } else {
      // Only the sign-in keys: the chosen theme stays.
      await this.eval(`localStorage.removeItem('demoMode'); localStorage.removeItem('token')`);
    }
    this.demoOn = on;
  }

  /**
   * Start from a fresh load of the signed-in app in the given role. Demo data
   * lives in memory, so the reload also throws away whatever the previous
   * screen did (an open session, a half-filled wizard).
   */
  async asRole(role) {
    await this.open('/charactermanager', '.account-row');
    await this.click('.account-row');
    const seg = role === 'dm' ? '.role-seg.dm' : '.role-seg:not(.dm)';
    await this.waitForSelector(seg);
    if (!(await this.eval(`document.querySelector(${JSON.stringify(seg)}).classList.contains('active')`))) {
      await this.click(seg);
    }
    await this.click('.slideover-close');
    await this.waitFor(`!document.querySelector('.slideover.dialog-active')`, 'settings to close');
  }

  /** Pick a theme the way a person does, from the settings panel. */
  async setTheme(theme) {
    await this.open('/charactermanager', '.account-row');
    await this.click('.account-row');
    await this.click('.theme-swatch', theme);
    await this.waitFor(`document.documentElement.getAttribute('data-theme') === ${JSON.stringify(theme)}`, `the ${theme} theme`);
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

// Runs inside the page: first visible element matching selector (+ text).
const FIND = `function (selector, text) {
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  for (const el of document.querySelectorAll(selector)) {
    if (!el.getClientRects().length) continue;
    if (text && !norm(el.textContent).includes(norm(text))) continue;
    return el;
  }
  return null;
}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── The detector ─────────────────────────────────────────────────────────────
function detect(port, opts, extra) {
  const args = ['--yes', `impeccable@${IMPECCABLE_VERSION}`, 'detect', '--cdp', String(port), ...extra];
  if (!opts.config) args.push('--no-config');
  // One command string through the shell, so `npx` resolves to npx.cmd on
  // Windows. Every argument is built in this file; none comes from outside.
  return spawnSync(`npx ${args.join(' ')}`, { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const surfaces = SURFACES.filter(s => !opts.only || opts.only.includes(s.name));
  const report = [];
  let server, chrome, page;

  try {
    server = await serve(opts.dist);
    chrome = await launchChrome(opts.viewport);
    page = await Page.attach(chrome.port);
    page.base = `http://127.0.0.1:${server.address().port}`;
    // Chrome will not make a headless window narrower than about 500px, so
    // the phone width is set by emulation. It holds while this script stays
    // attached, which it does for the whole scan.
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: opts.viewport.width, height: opts.viewport.height, deviceScaleFactor: 1, mobile: false,
    });
    if (opts.theme !== 'midnight') {
      await page.setDemo(true);
      await page.setTheme(opts.theme);
    }

    for (const surface of surfaces) {
      const entry = { surface: surface.name, findings: [], error: null };
      report.push(entry);
      try {
        await page.setDemo(surface.demo !== false);
        await surface.go(page);
        await page.eval('document.fonts.ready.then(() => true)');
        await page.settle();
        const result = detect(chrome.port, opts, ['--json']);
        // 0 = clean, 2 = findings. Anything else is the detector failing.
        if (result.status !== 0 && result.status !== 2) {
          throw new Error(`detector exited ${result.status}: ${(result.stderr || '').trim().slice(0, 300)}`);
        }
        entry.findings = JSON.parse(result.stdout || '[]');
      } catch (err) {
        entry.error = err.message;
      }
      const n = entry.findings.length;
      console.error(entry.error ? `  ! ${surface.name}: not scanned (${entry.error})` : `  ${surface.name}: ${n} finding${n === 1 ? '' : 's'}`);
    }
  } finally {
    if (page) page.close();
    if (chrome) {
      chrome.child.kill();
      await sleep(300);
      fs.rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    if (server) server.close();
  }

  if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  main().catch(err => {
    // Advisory job: say what went wrong, never fail the build.
    console.error(`impeccable-scan could not run: ${err.message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Impeccable scan did not run::${err.message}`);
  });
}

module.exports = { SURFACES, parseArgs, serve, launchChrome, Page, detect, sleep, IMPECCABLE_VERSION, ROOT };
