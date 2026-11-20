import { PC } from '../models/pc';
import { BreakdownLine, adjustmentSum, adjustmentsFor, countedSum, skillStat } from '../models/stat-adjustment';

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
// Casting ability per class: the full casters, the Warlock, and the half
// casters Paladin (CHA) and Ranger (WIS).

export const CASTING_ABILITY: Record<string, 'INT' | 'WIS' | 'CHA'> = {
  Bard: 'CHA', Paladin: 'CHA', Sorcerer: 'CHA', Warlock: 'CHA',
  Cleric: 'WIS', Druid: 'WIS', Ranger: 'WIS',
  Wizard: 'INT',
};

/** The proficiency bonus the 2024 table gives a character level: +2 at 1st, +6 at 17th. */
export function proficiencyForLevel(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

/** Proficiency bonus to use in spell and skill math: the sheet's own value
 *  (the table plus any DM lines), else the table for the character's level so a
 *  sheet that never stored prof still works. */
export function proficiencyBonus(pc: Pick<PC, 'prof' | 'level'>): number {
  return pc.prof ?? proficiencyForLevel(pc.level ?? 1);
}

/** Spell save DC = 8 + proficiency + casting-ability modifier; null for a
 *  class with no casting ability (Fighter, unknown classes, …). */
export function spellSaveDc(pc: PC): number | null {
  const ability = CASTING_ABILITY[pc.clazz];
  if (!ability) return null;
  return 8 + proficiencyBonus(pc) + modFromScore(pc.stats?.[ability] ?? 10);
}

/** Spell attack bonus = proficiency + casting-ability modifier; null for non-casters. */
export function spellAttackBonus(pc: PC): number | null {
  const ability = CASTING_ABILITY[pc.clazz];
  if (!ability) return null;
  return proficiencyBonus(pc) + modFromScore(pc.stats?.[ability] ?? 10);
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

// ── Skill modifiers ─────────────────────────────────────────────────────────
// A skill modifier = the governing ability's modifier + the proficiency bonus
// (twice it with expertise) + any lines the DM added to that skill. Nothing
// but the DM's lines is saved: the rest is worked out whenever it is shown, so
// the sheet's "+x", its breakdown and the passive scores always agree.

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const ABILITY_NAMES: Record<Ability, string> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

/** A skill's full name: SKILL_DEFS lists Sleight of Hand as "Sleight". */
export function skillFullName(name: string): string {
  return name === 'Sleight' ? 'Sleight of Hand' : name;
}

/** Proficiency level for a skill, tolerating "Animal Handling" → "Animal". */
export function skillLevel(pc: PC, name: string): 'prof' | 'expert' | null {
  const skills = pc.skills ?? {};
  return skills[name] ?? skills[name.split(' ')[0]] ?? null;
}

/**
 * The lines the app works out for a skill, in order: the ability modifier,
 * then the proficiency bonus (doubled for expertise, +0 without proficiency).
 */
export function skillAutoLines(pc: PC, name: string, ability: Ability): BreakdownLine[] {
  const score = pc.stats?.[ability] ?? 10;
  const prof = proficiencyBonus(pc);
  const level = skillLevel(pc, name);
  const proficiency: BreakdownLine = level === 'expert'
    ? { label: 'Expertise', value: prof * 2, note: `twice the proficiency bonus of ${fmtMod(prof)}` }
    : level === 'prof'
      ? { label: 'Proficiency', value: prof }
      : { label: 'Proficiency', value: 0, note: `not proficient in ${skillFullName(name)}` };
  return [
    { label: ABILITY_NAMES[ability], value: modFromScore(score), note: `score ${score}` },
    proficiency,
  ];
}

/** A skill's modifier as the sheet shows it: the worked-out lines plus the DM's lines. */
export function skillModifier(pc: PC, name: string, ability: Ability): number {
  return countedSum(skillAutoLines(pc, name, ability)) + adjustmentSum(adjustmentsFor(pc, skillStat(name)));
}

// ── Passive stats (DM dashboard) ────────────────────────────────────────────
// passive = 10 + the skill modifier. Perception and Insight both key off WIS.

export function passiveScore(pc: PC, skill: string, ability: Ability): number {
  return 10 + skillModifier(pc, skill, ability);
}

// ── Coin value ──────────────────────────────────────────────────────────────
// Total wealth expressed in gold pieces.

export function goldValue(coins: PC['coins']): number {
  if (!coins) return 0;
  const { cp = 0, sp = 0, gp = 0 } = coins;
  return cp / 100 + sp / 10 + gp;
}
