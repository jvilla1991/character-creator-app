import { PC } from '../models/pc';

// ── Ability score math ──────────────────────────────────────────────────────

export function modFromScore(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ── Portrait tints ──────────────────────────────────────────────────────────
// Object is a module-level constant so it is allocated once, never per-call.

export const PORTRAIT_TINTS: Record<string, string> = {
  celestial: 'color-mix(in oklch, var(--celestial) 25%, var(--surface-3))',
  gold:      'color-mix(in oklch, var(--gold) 22%, var(--surface-3))',
  crimson:   'color-mix(in oklch, var(--crimson) 25%, var(--surface-3))',
  violet:    'color-mix(in oklch, var(--violet) 28%, var(--surface-3))',
  emerald:   'color-mix(in oklch, var(--emerald) 24%, var(--surface-3))',
};

export function tintFor(pc: PC): string {
  return PORTRAIT_TINTS[pc.portraitTint ?? 'celestial'] ?? PORTRAIT_TINTS['celestial'];
}

// ── Hit dice ────────────────────────────────────────────────────────────────

export const CLASS_HIT_DICE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

export function hitDieFor(clazz: string): number {
  return CLASS_HIT_DICE[clazz] ?? 8;
}

// ── Skill / condition constants ─────────────────────────────────────────────

/** [skill name, governing ability] pairs matching prototype/data.js SKILL_DEFS */
export const SKILL_DEFS: [string, string][] = [
  ['Acrobatics',      'DEX'], ['Animal Handling', 'WIS'], ['Arcana',        'INT'],
  ['Athletics',       'STR'], ['Deception',       'CHA'], ['History',       'INT'],
  ['Insight',         'WIS'], ['Intimidation',    'CHA'], ['Investigation', 'INT'],
  ['Medicine',        'WIS'], ['Nature',          'INT'], ['Perception',    'WIS'],
  ['Performance',     'CHA'], ['Persuasion',      'CHA'], ['Religion',      'INT'],
  ['Sleight',         'DEX'], ['Stealth',         'DEX'], ['Survival',      'WIS'],
];

/** Full conditions list matching prototype/data.js CONDITIONS_LIST */
export const CONDITIONS_LIST: string[] = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious',
  'raging', 'concentration', 'inspired',
];
