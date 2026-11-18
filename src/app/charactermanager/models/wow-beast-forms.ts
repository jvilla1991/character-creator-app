import { modFromScore } from '../utils/character-math';
import { CIRCLE_OF_THE_MOON } from './wow-class-variants';

/**
 * The World of Warcraft Druid's beast forms — the Cat and Bear Form stat cards
 * (Circle of the Moon) and the classic beasts every other WoW druid's Wild Shape
 * takes. Computed from the character, never persisted. Text is paraphrased. The
 * druid's class-variant entry itself lives in {@link ./wow-class-variants}.
 */

// ── Beast forms ──────────────────────────────────────────────────────────────

/** What a beast-form card is computed from. */
export interface BeastFormInput {
  /** Druid level. */
  level: number;
  /** Wisdom score (not modifier). */
  wis: number;
  /** Spell attack bonus. */
  spellAttack: number;
  /** Spell save DC. */
  spellDc: number;
}

export interface BeastFormAttack {
  name: string;
  /** Attack bonus, e.g. 5 → shown as "+5". */
  toHit: number;
  reach: string;
  /** Formatted damage, e.g. "2d10 + 3 slashing". */
  damage: string;
}

export interface BeastFormAction {
  name: string;
  /** 'Bonus Action', 'Reaction', 'Movement' … */
  kind: string;
  text: string;
}

export interface BeastFormCard {
  name: 'Cat Form' | 'Bear Form';
  size: 'Medium' | 'Large';
  ac: number;
  tempHp: number;
  speed: string;
  /** STR and DEX both become the Wisdom score. */
  strDex: number;
  senses: string;
  skills?: string;
  multiattack: string;
  attacks: BeastFormAttack[];
  actions: BeastFormAction[];
}

/** Shared by both forms (shown once under the cards). */
export const BEAST_FORM_UNCHANGED =
  'Your creature type, alignment, CON/INT/WIS/CHA, languages and proficiency bonus stay the same.';

/** "1d10 + 3" / "1d10 − 1" / "1d10" — dice plus a flat modifier. */
export function diceWithMod(dice: string, mod: number): string {
  if (mod === 0) return dice;
  return mod > 0 ? `${dice} + ${mod}` : `${dice} − ${Math.abs(mod)}`;
}

/** Dice count that steps up at 5 / 11 / 17 like a cantrip (1 → 4). */
export function tierDice(level: number): number {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

/** Pounce's extra d6s on an Advantage hit: 1, then +1 at 6 / 9 / 12 / 15 / 18. */
export function pounceBonusDice(level: number): number {
  return 1 + [6, 9, 12, 15, 18].filter(l => level >= l).length;
}

export function catForm(input: BeastFormInput): BeastFormCard {
  const wisMod = modFromScore(input.wis);
  return {
    name: 'Cat Form',
    size: 'Medium',
    ac: 13 + wisMod,
    tempHp: 3 * input.level,
    speed: '40 ft.',
    strDex: input.wis,
    senses: 'Darkvision 60 ft.',
    skills: 'Stealth (proficient)',
    multiattack: 'Make one Pounce attack and use Prowl.',
    attacks: [{
      name: 'Pounce',
      toHit: input.spellAttack,
      reach: '5 ft.',
      damage: `${diceWithMod(`${tierDice(input.level)}d10`, wisMod)} slashing`,
    }],
    actions: [
      {
        name: 'Pounce (with Advantage)',
        kind: 'On hit',
        text: `If you had Advantage and the target is Large or smaller, it takes an extra `
          + `${pounceBonusDice(input.level)}d6 slashing and is knocked Prone.`,
      },
      {
        name: 'Primal Wrath',
        kind: 'Bonus Action',
        text: `Spend a spell slot (level 1+). Creatures you choose within a 5-ft. emanation make a `
          + `DC ${input.spellDc} Dexterity save, taking ${diceWithMod('2d6 per slot level', wisMod)} slashing on a failure.`,
      },
      {
        name: 'Prowl',
        kind: 'Movement',
        text: 'Move up to half your Speed without provoking Opportunity Attacks, then you may Hide.',
      },
    ],
  };
}

export function bearForm(input: BeastFormInput): BeastFormCard {
  const wisMod = modFromScore(input.wis);
  return {
    name: 'Bear Form',
    size: 'Large',
    ac: 15 + wisMod,
    tempHp: 3 * input.level,
    speed: '30 ft.',
    strDex: input.wis,
    senses: 'Darkvision 60 ft.',
    multiattack: 'Make two Mangle attacks.',
    attacks: [{
      name: 'Mangle',
      toHit: input.spellAttack,
      reach: '5 ft.',
      damage: `${diceWithMod(`${tierDice(input.level)}d8`, wisMod)} slashing`,
    }],
    actions: [
      {
        name: 'Frenzied Regeneration',
        kind: 'Bonus Action',
        text: 'Spend a spell slot (level 1+) to gain Temporary Hit Points equal to 5 × the slot level.',
      },
      {
        name: 'Growl',
        kind: 'Reaction',
        text: 'When a creature you can see attacks someone other than you within 5 ft. of you, it has '
          + 'Disadvantage on that attack — and on its other attacks against that target until the start '
          + 'of your next turn, as long as you stay within 5 ft.',
      },
    ],
  };
}

// ── Classic beast forms (non-Moon WoW druids, and Moon druids' travel shapes) ─

export interface ClassicBeastForm {
  form: string;
  beast: string;
  /** Druid level the beast becomes available. */
  fromLevel: number;
  available: boolean;
}

interface ClassicFormRow {
  form: string;
  beast: string;
  level: number;
  /** Earlier level for Circle of the Moon druids. */
  moonLevel?: number;
  /** Cat/Bear rows — Moon druids use the stat cards instead. */
  combat?: boolean;
}

const CLASSIC_FORMS: readonly ClassicFormRow[] = [
  { form: 'Cat Form',     beast: 'Panther',        level: 2, combat: true },
  { form: 'Cat Form',     beast: 'Tiger',          level: 8, combat: true },
  { form: 'Bear Form',    beast: 'Black Bear',     level: 4, combat: true },
  { form: 'Bear Form',    beast: 'Brown Bear',     level: 8, combat: true },
  { form: 'Travel Form',  beast: 'Elk',            level: 2 },
  { form: 'Aquatic Form', beast: 'Giant Seahorse', level: 4, moonLevel: 3 },
  { form: 'Flight Form',  beast: 'Eagle, Giant Bat, Hawk, Pteranodon, or Raven', level: 8 },
];

/**
 * The classic beast for each WoW form at `level`. Circle of the Moon druids skip
 * the Cat/Bear rows (they use the stat cards) and get the seahorse at 3.
 */
export function classicBeastForms(level: number, moon: boolean): ClassicBeastForm[] {
  return CLASSIC_FORMS
    .filter(r => !(moon && r.combat))
    .map(r => {
      const fromLevel = moon && r.moonLevel ? r.moonLevel : r.level;
      return { form: r.form, beast: r.beast, fromLevel, available: level >= fromLevel };
    });
}

/** True when a stored subclass is the Circle of the Moon (case-insensitive). */
export function isMoonCircle(subclass: string | null | undefined): boolean {
  return (subclass ?? '').toLowerCase() === CIRCLE_OF_THE_MOON.toLowerCase();
}
