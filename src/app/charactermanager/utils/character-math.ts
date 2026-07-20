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

/** Accepts anything carrying a portrait tint key — a PC, a session participant
 *  row, or the account row's user — and falls back to celestial for unknown keys. */
export function tintFor(owner: { portraitTint?: string | null }): string {
  return PORTRAIT_TINTS[owner.portraitTint ?? 'celestial'] ?? PORTRAIT_TINTS['celestial'];
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

// ── Spellcasting (2024 PHB) ─────────────────────────────────────────────────
// Casting ability per class. Paladin/Ranger are half-casters the app doesn't
// model as slot-casters, but their save DC math is still CHA/WIS-based when
// they do carry spells (e.g. DM-granted), so they're mapped here.

export const CASTING_ABILITY: Record<string, 'INT' | 'WIS' | 'CHA'> = {
  Bard: 'CHA', Paladin: 'CHA', Sorcerer: 'CHA', Warlock: 'CHA',
  Cleric: 'WIS', Druid: 'WIS', Ranger: 'WIS',
  Wizard: 'INT',
};

/** Proficiency bonus to use in spell math: the sheet's own value, else derived
 *  from level ((level−1)/4 + 2) so a sheet that never stored prof still works. */
function profForSpellMath(pc: PC): number {
  return pc.prof ?? Math.floor(((pc.level ?? 1) - 1) / 4) + 2;
}

/** Spell save DC = 8 + proficiency + casting-ability modifier; null for a
 *  class with no casting ability (Fighter, unknown classes, …). */
export function spellSaveDc(pc: PC): number | null {
  const ability = CASTING_ABILITY[pc.clazz];
  if (!ability) return null;
  return 8 + profForSpellMath(pc) + modFromScore(pc.stats?.[ability] ?? 10);
}

/** Spell attack bonus = proficiency + casting-ability modifier; null for non-casters. */
export function spellAttackBonus(pc: PC): number | null {
  const ability = CASTING_ABILITY[pc.clazz];
  if (!ability) return null;
  return profForSpellMath(pc) + modFromScore(pc.stats?.[ability] ?? 10);
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

// ── Passive stats (DM dashboard) ────────────────────────────────────────────
// passive = 10 + abilityMod + (expert ? 2×prof : prof ? prof : 0)
// Perception and Insight both key off WIS. Mirrors prototype/data.js.

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/** Proficiency level for a skill, tolerating "Animal Handling" → "Animal". */
export function skillLevel(pc: PC, name: string): 'prof' | 'expert' | null {
  const skills = pc.skills ?? {};
  return skills[name] ?? skills[name.split(' ')[0]] ?? null;
}

export function passiveScore(pc: PC, skill: string, ability: Ability): number {
  const score = pc.stats?.[ability] ?? 10;
  const prof = pc.prof ?? 0;
  const mod = modFromScore(score);
  const lvl = skillLevel(pc, skill);
  const bonus = lvl === 'expert' ? prof * 2 : lvl === 'prof' ? prof : 0;
  return 10 + mod + bonus;
}

// ── Coin value ──────────────────────────────────────────────────────────────
// Total wealth expressed in gold pieces.

export function goldValue(coins: PC['coins']): number {
  if (!coins) return 0;
  const { cp = 0, sp = 0, ep = 0, gp = 0, pp = 0 } = coins;
  return cp / 100 + sp / 10 + ep / 2 + gp + pp * 10;
}
