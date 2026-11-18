import type { FeatureCard, FeatureCardInput, FeatureCardRow } from './hero-class';
import { modFromScore } from '../utils/character-math';

/**
 * The World of Warcraft Warrior (Fighter)'s sheet card — the Battle Master's
 * Superiority Dice, maneuver save DC and the five World of Warcraft maneuvers.
 * Computed from the character, never persisted. Maneuvers and Superiority Dice
 * aren't modelled anywhere in the app (nothing is granted or tracked), so the
 * card is reference text only. Text is paraphrased. The warrior's class-variant
 * entry lives in {@link ./wow-class-variants}.
 */

/** The Battle Master subclass name, as the server and the class data spell it. */
export const BATTLE_MASTER = 'Battle Master';

/** Superiority Dice from Fighter level 3: 4, 5 from level 7, 6 from level 15; 0 before level 3. */
export function superiorityDiceCount(level: number): number {
  if (level < 3) return 0;
  return level >= 15 ? 6 : level >= 7 ? 5 : 4;
}

/** The Superiority Die's size: d8, d10 from Fighter level 10, d12 from level 18. */
export function superiorityDieSize(level: number): number {
  return level >= 18 ? 12 : level >= 10 ? 10 : 8;
}

/** Proficiency bonus: the stored one, else derived from the level. */
function proficiency(input: FeatureCardInput): number {
  return input.prof ?? Math.floor((Math.max(1, input.level) - 1) / 4) + 2;
}

/**
 * Maneuver save DC: 8 + Proficiency Bonus + Strength or Dexterity modifier (the
 * player's choice — the higher one is shown).
 */
export function maneuverSaveDc(input: FeatureCardInput): number {
  const str = modFromScore(input.stats?.STR ?? 10);
  const dex = modFromScore(input.stats?.DEX ?? 10);
  return 8 + proficiency(input) + Math.max(str, dex);
}

/** The five World of Warcraft maneuvers, with the die size (and save DC) filled in. */
export function wowManeuverRows(level: number, dc: number, strength: number | undefined): FeatureCardRow[] {
  const die = `d${superiorityDieSize(level)}`;
  const leap = strength ? `${strength} ft., your Strength score` : 'your Strength score in feet';
  return [
    {
      name: 'Battle Shout',
      kind: 'Bonus Action',
      text: `Spend a Superiority Die and roll it (${die}) to rally the allies within 30 ft. who can hear you. `
        + 'Until the start of your next turn, each of them adds the roll to its damage the next time it hits '
        + 'with a melee attack.',
    },
    {
      name: 'Demoralizing Shout',
      kind: 'Bonus Action',
      text: `Spend a Superiority Die and roll it (${die}). Until the end of your next turn, each enemy within `
        + '30 ft. that can hear you subtracts the roll from its damage the next time it hits a target other '
        + 'than you with a melee attack.',
    },
    {
      name: 'Heroic Leap',
      kind: 'Bonus Action',
      text: `Spend a Superiority Die (${die}) and leap up to ${leap}. Each creature within 5 ft. of where you `
        + `land makes a DC ${dc} Strength saving throw, taking Bludgeoning damage equal to the die roll on a `
        + 'failure, or half as much on a success.',
    },
    {
      name: 'Mortal Strike',
      kind: 'On a hit',
      text: `When you hit a creature with an attack roll, spend a Superiority Die and add its roll (${die}) `
        + "to the damage. The target can't regain Hit Points until the end of your next turn.",
    },
    {
      name: 'Warding Maneuver',
      kind: 'Reaction',
      text: 'When you or a creature within 5 ft. of you is hit by an attack roll while you wield a melee weapon '
        + `or a Shield, spend a Superiority Die and add its roll (${die}) to the target's AC against that attack. `
        + 'If the attack still hits, the target has Resistance to its damage.',
    },
  ];
}

/** The Battle Master card, for a Battle Master at Fighter level 3+; null otherwise. */
export function battleMasterCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || (input.subclass ?? '').toLowerCase() !== BATTLE_MASTER.toLowerCase()) return null;
  const dc = maneuverSaveDc(input);
  return {
    name: BATTLE_MASTER,
    source: `${BATTLE_MASTER} 3`,
    summary: 'Combat Superiority: spend a Superiority Die to fuel a maneuver. You regain all expended dice '
      + 'when you finish a Short or Long Rest. Maneuver saves use your Maneuver save DC '
      + '(8 + Proficiency Bonus + Strength or Dexterity modifier).',
    stats: [
      { label: 'Superiority Dice', value: String(superiorityDiceCount(input.level)) },
      { label: 'Die', value: `d${superiorityDieSize(input.level)}` },
      { label: 'Maneuver DC', value: String(dc) },
      { label: 'Regain', value: 'Short or Long Rest' },
    ],
    rowsTitle: 'World of Warcraft maneuvers',
    rows: wowManeuverRows(input.level, dc, input.stats?.STR),
    note: "Maneuvers aren't tracked by the app — pick yours on paper or with your DM.",
  };
}

/** Every card a WoW warrior's sheet shows at this level and subclass, in panel order. */
export function warriorFeatureCards(input: FeatureCardInput): FeatureCard[] {
  const card = battleMasterCard(input);
  return card ? [card] : [];
}
