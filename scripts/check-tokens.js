#!/usr/bin/env node
/**
 * Theme-token leak check.
 *
 * Fails on the ways a component style can bypass the design system:
 *
 *   1. `var(--x)` where `--x` is never declared anywhere in src/. The
 *      browser then silently uses the fallback (or nothing), which is
 *      always the midnight value, so the element ignores vellum and
 *      candlelit entirely.
 *   2. A white-alpha literal `rgba(255, 255, 255, …)` in any stylesheet
 *      under src/ (component styles and the global styles.css). White ink or a white wash reads on the two dark themes and
 *      vanishes on vellum's parchment.
 *   3. Italic text: `font-style: italic` / `oblique`, the `font:` shorthand
 *      with either keyword, `fontStyle` set from code, or an italic face in
 *      the Google Fonts URL (the `ital` axis), anywhere under src/:
 *      stylesheets, templates and inline `styles:` alike. The system sets
 *      nothing in italic (owner decision 2026-11-18; DESIGN.md, Typography).
 *      There is no allow-comment for this one.
 *   4. Text below the 11px floor: a `font-size` (or the size in a `font:`
 *      shorthand, or `fontSize` set from code) under 11px, or under
 *      0.6875rem (11px at the 16px root), anywhere under src/. DESIGN.md's
 *      11px Floor Rule exempts nothing, micro-labels and glyphs included, so
 *      there is no allow-comment for this one either. Use `var(--text-2xs)`.
 *      `em` and `%` sizes are relative to the parent and are not checked;
 *      neither is a size inside `max()`, which can only grow.
 *
 * Why this exists: check-contrast.js only compares token *pairs*, so it
 * stayed green (0/135 failures) while vellum was broken on five screens
 * by exactly these two leaks. See docs/impeccable-adoption-plan.md §10,
 * "The finding that reframes Phase 3".
 *
 * A white-alpha literal that is genuinely theme-independent (a specular
 * highlight on a coloured button, say) may stay if the line carries the
 * comment `token-check: allow-white` with a reason.
 *
 * Usage:  node scripts/check-tokens.js
 * Exits 1 on any finding.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const ALLOW_WHITE = 'token-check: allow-white';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(s?css|html|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const declared = new Set();
const uses = [];
const whites = [];
const italics = [];
const smalls = [];

const FLOOR_PX = 11;
const ROOT_PX = 16;
// The value of a size declaration, up to the end of the declaration.
const SIZE_RES = [
  /font-size\s*:\s*([^;{}"'`]+)/gi,
  /fontSize['"]?\s*[:=]\s*['"`]([^'"`]+)/g,
];
// The `font:` shorthand: its size is the first length, before any `/line-height`.
const SHORTHAND_RE = /\bfont\s*:\s*[^;{}]*?(-?[0-9]*\.?[0-9]+)(px|rem)\b/gi;

function belowFloor(n, unit) {
  const px = unit.toLowerCase() === 'rem' ? n * ROOT_PX : n;
  return px < FLOOR_PX - 1e-9;
}

function smallSizes(line) {
  const found = [];
  for (const re of SIZE_RES) {
    for (const m of line.matchAll(re)) {
      const value = m[1].trim();
      if (/^max\(/i.test(value)) continue;
      for (const n of value.matchAll(/(-?[0-9]*\.?[0-9]+)(px|rem)\b/gi)) {
        if (belowFloor(parseFloat(n[1]), n[2])) found.push(n[0]);
      }
    }
  }
  for (const m of line.matchAll(SHORTHAND_RE)) {
    if (belowFloor(parseFloat(m[1]), m[2])) found.push(m[1] + m[2]);
  }
  return found;
}

// Declarations only, so the word "italic" in a comment or in copy is fine.
const ITALIC_RES = [
  /font-style\s*:\s*(italic|oblique)/i,
  /\bfont\s*:[^;{}]*\b(italic|oblique)\b/i,
  /fontStyle['"]?\s*[:=]\s*['"`](italic|oblique)/i,
  /fonts\.googleapis\.com[^"'\s]*:ital\b/i,
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const isStyle = /\.s?css$/.test(file);

  // Declarations: `--x:` in stylesheets, and custom properties set from
  // templates or code (`[style.--x]`, `setProperty('--x'`, `'--x':`).
  const declRe = isStyle
    ? /(--[a-zA-Z0-9-]+)\s*:/g
    : /(?:style\.|setProperty\(\s*['"`]|['"`])(--[a-zA-Z0-9-]+)/g;
  for (const m of text.matchAll(declRe)) declared.add(m[1]);

  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      uses.push({ name: m[1], file, line: i + 1 });
    }
    if (
      isStyle &&
      /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/.test(line) &&
      !line.includes(ALLOW_WHITE)
    ) {
      whites.push({ file, line: i + 1, text: line.trim() });
    }
    if (ITALIC_RES.some((re) => re.test(line))) {
      italics.push({ file, line: i + 1, text: line.trim().slice(0, 120) });
    }
    if (smallSizes(line).length) {
      smalls.push({ file, line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
}

const rel = (f) => path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/');
const undeclared = uses.filter((u) => !declared.has(u.name));

if (undeclared.length) {
  console.log(`Undeclared custom properties (${undeclared.length} uses):`);
  for (const u of undeclared) console.log(`  ${u.name}  ${rel(u.file)}:${u.line}`);
}
if (whites.length) {
  console.log(`White-alpha literals in stylesheets (${whites.length}):`);
  for (const w of whites) console.log(`  ${rel(w.file)}:${w.line}  ${w.text}`);
  console.log(`  Use a theme token, or add "/* ${ALLOW_WHITE}: <reason> */" to the line.`);
}

if (italics.length) {
  console.log(`Italic text (${italics.length}):`);
  for (const t of italics) console.log(`  ${rel(t.file)}:${t.line}  ${t.text}`);
  console.log('  The system uses no italics. Tell secondary text apart with the text ramp,');
  console.log('  size, weight or an accent token instead (DESIGN.md, Typography).');
}

if (smalls.length) {
  console.log(`Text below the 11px floor (${smalls.length}):`);
  for (const t of smalls) console.log(`  ${rel(t.file)}:${t.line}  ${t.text}`);
  console.log('  No text ships below 11px. Use var(--text-2xs), and raise tracking with');
  console.log('  var(--track-label) on uppercase labels (DESIGN.md, The 11px Floor Rule).');
}

if (undeclared.length || whites.length || italics.length || smalls.length) {
  console.log('\nFAIL: styles bypass the design system.');
  process.exit(1);
}
console.log(`OK: ${uses.length} var() uses all declared; no white-alpha literals in stylesheets; no italics; no text below 11px.`);
