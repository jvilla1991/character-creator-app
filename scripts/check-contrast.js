#!/usr/bin/env node
/**
 * Theme contrast regression check.
 *
 * Verifies every text colour token in src/styles.css against every surface
 * token, in every theme, at the WCAG AA threshold for normal body text.
 *
 * Why this exists: the app has three themes but only the default (midnight)
 * is ever rendered by a page scanner, so contrast failures in `vellum` and
 * `candlelit` are invisible to per-page tooling. An audit in Nov 2026 found
 * 26 of 135 combinations below AA, including the app's most-used text token.
 * Several of the fixes clear the bar by small margins, so a change to any
 * surface colour can silently reintroduce a failure.
 *
 * See docs/theme-contrast-audit.md — in particular the measurement notes,
 * which explain why naive contrast maths gives confident wrong answers on
 * this stylesheet.
 *
 * Usage:  node scripts/check-contrast.js [path/to/styles.css]
 * Exits 1 if any combination falls below the threshold.
 */

const fs = require('fs');
const path = require('path');

const AA_NORMAL_TEXT = 4.5;

/* Tokens used as `color:` somewhere in the app. --gold-deep is deliberately
   excluded: it only ever appears inside gradients and color-mix() tints, never
   as text, so the text threshold does not apply to it. */
const FOREGROUND = [
  '--text', '--text-2', '--text-dim',
  '--gold', '--gold-2',
  '--celestial', '--crimson', '--emerald', '--violet',
];

/* Tokens used as a `background:` behind that text. */
const BACKGROUND = ['--bg', '--bg-2', '--surface', '--surface-2', '--surface-3'];

function parseThemes(css) {
  const themes = {};
  const blockRe = /(?::root,\s*)?\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g;
  for (const match of css.matchAll(blockRe)) {
    const vars = {};
    for (const v of match[2].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      vars['--' + v[1]] = v[2];
    }
    themes[match[1]] = vars;
  }
  return themes;
}

function relativeLuminance(hex) {
  const channels = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

function main() {
  const target = process.argv[2] || path.join(__dirname, '..', 'src', 'styles.css');
  if (!fs.existsSync(target)) {
    console.error(`check-contrast: cannot read ${target}`);
    process.exit(1);
  }

  const themes = parseThemes(fs.readFileSync(target, 'utf8'));
  const themeNames = Object.keys(themes);

  if (themeNames.length === 0) {
    console.error('check-contrast: no [data-theme="..."] blocks found — did the selector change?');
    process.exit(1);
  }

  const failures = [];
  let checked = 0;

  for (const theme of themeNames) {
    const vars = themes[theme];
    for (const fg of FOREGROUND) {
      if (!vars[fg]) continue;
      for (const bg of BACKGROUND) {
        if (!vars[bg]) continue;
        checked++;
        const ratio = contrastRatio(vars[fg], vars[bg]);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push({ theme, fg, bg, fgHex: vars[fg], bgHex: vars[bg], ratio });
        }
      }
    }
  }

  console.log(
    `check-contrast: ${checked} combinations across ${themeNames.length} themes ` +
      `(${themeNames.join(', ')}) at ${AA_NORMAL_TEXT}:1`,
  );

  if (failures.length === 0) {
    console.log('check-contrast: all combinations pass WCAG AA.');
    return;
  }

  console.error(`\ncheck-contrast: ${failures.length} combination(s) below ${AA_NORMAL_TEXT}:1\n`);
  for (const f of failures) {
    console.error(
      `  ${f.theme.padEnd(10)} ${f.fg.padEnd(12)} ${f.fgHex} on ` +
        `${f.bg.padEnd(12)} ${f.bgHex}   ${f.ratio.toFixed(2)}:1`,
    );
  }
  console.error('\nSee docs/theme-contrast-audit.md for the token values and how they were chosen.');
  process.exit(1);
}

main();
