import type { FeatureCard, FeatureCardInput, FeatureCardRow } from './hero-class';
import { modFromScore } from '../utils/character-math';

/**
 * The World of Warcraft Shaman (Barbarian)'s sheet cards — Totems for every WoW
 * barbarian from level 3, plus the card for each WoW-only path (Path of the
 * Elements, Path of the Spiritual Guardian). Computed from the character, never
 * persisted; the feature text itself comes from the server. Text is paraphrased.
 * The shaman's class-variant entry lives in {@link ./wow-class-variants}.
 */

/** The WoW-only barbarian paths — the server offers them to WoW barbarians only. */
export const PATH_OF_THE_ELEMENTS = 'Path of the Elements';
export const PATH_OF_THE_SPIRITUAL_GUARDIAN = 'Path of the Spiritual Guardian';

/** The Barbarian's Rage Damage bonus by Barbarian level: +2, +3 from 9, +4 from 16. */
export function rageDamageBonus(level: number): number {
  return level >= 16 ? 4 : level >= 9 ? 3 : 2;
}

/** Proficiency bonus: the stored one, else derived from the level. */
function proficiency(input: FeatureCardInput): number {
  return input.prof ?? Math.floor((Math.max(1, input.level) - 1) / 4) + 2;
}

function sameName(a: string | null | undefined, b: string): boolean {
  return (a ?? '').toLowerCase() === b.toLowerCase();
}

// ── Totems (every WoW barbarian, Barbarian 3) ────────────────────────────────

export function totemsCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3) return null;
  return {
    name: 'Totems',
    source: 'Barbarian 3',
    summary: 'Replaces Primal Knowledge. As a Bonus Action, plant a totem in an unoccupied space within 10 ft. '
      + 'It has AC 10 and 1 HP and lasts 1 minute; at the end of each of your turns it pulses its effect '
      + 'in a 30-ft. emanation.',
    rows: [
      { name: 'Earthbind', text: 'Grips the ground, slowing creatures you choose in the emanation.' },
      {
        name: 'Primal Knowledge',
        text: 'Lends primal insight to you and your allies in the emanation. Once per Long Rest; '
          + 'spend a Rage to use it again.',
      },
      { name: 'Tremor', text: 'Shakes allies in the emanation free of fear and charm.' },
      { name: 'Wind Rush', text: 'Quickens allies in the emanation with a rush of wind.' },
    ],
  };
}

// ── Path of the Elements ─────────────────────────────────────────────────────

export function ragingElementsCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || !sameName(input.subclass, PATH_OF_THE_ELEMENTS)) return null;
  const pb = proficiency(input);
  const con = modFromScore(input.stats?.CON ?? 10);
  const dc = 8 + con + pb;
  const attack = con + pb;
  const n = rageDamageBonus(input.level);
  const overload = input.level >= 14;
  const withOverload = (text: string, rider: string) => overload ? `${text} Elemental Overload: ${rider}` : text;

  const rows: FeatureCardRow[] = [
    {
      name: 'Icefury',
      kind: `${n}d8 Cold`,
      text: withOverload(
        `Spell attack (${fmtBonus(attack)}), range 30 ft. On a hit, your next Fire damage deals an extra 1d10.`,
        'the target subtracts half the Cold damage rolled from its next damage roll.',
      ),
    },
    {
      name: 'Lava Burst',
      kind: `${n}d4 Fire`,
      text: withOverload(
        `DC ${dc} Dexterity save, half damage on a success. On a failure, your next Lightning damage deals an extra 1d8.`,
        'the target and enemies within 10 ft. of it start burning.',
      ),
    },
    {
      name: 'Lightning Bolt',
      kind: `${n}d6 Lightning`,
      text: withOverload(
        `DC ${dc} Dexterity save, half damage on a success. On a failure, your next Cold damage deals an extra 1d6.`,
        `the bolt chains to a second target within 30 ft. (DC ${dc} Dexterity save, full damage on a failure, half on a success).`,
      ),
    },
  ];
  if (input.level >= 6) {
    rows.push({
      name: 'Echo of the Elements',
      kind: 'Barbarian 6',
      text: 'You know Elementalism. Spend a Rage to cast Daylight, Water Walk, or Wind Wall; '
        + 'Wisdom is your spellcasting ability for them.',
      spells: ['Elementalism', 'Daylight', 'Water Walk', 'Wind Wall'],
    });
  }
  if (input.level >= 10) {
    rows.push({
      name: 'Primordial Bond',
      kind: 'Barbarian 10',
      text: 'While raging, you have Resistance to Cold, Fire, and Lightning damage.',
    });
  }
  return {
    name: 'Raging Elements',
    source: `${PATH_OF_THE_ELEMENTS} 3`,
    summary: `Choose one option; N is your Rage Damage bonus (${fmtBonus(n)}).`
      + (overload ? ' From level 14 each option adds its Elemental Overload.' : ''),
    stats: [
      { label: 'Save DC', value: String(dc) },
      { label: 'Spell attack', value: fmtBonus(attack) },
      { label: 'Rage Damage', value: fmtBonus(n) },
    ],
    rows,
  };
}

// ── Path of the Spiritual Guardian ───────────────────────────────────────────

export function spiritualGuardianCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || !sameName(input.subclass, PATH_OF_THE_SPIRITUAL_GUARDIAN)) return null;
  const n = rageDamageBonus(input.level);
  const rows: FeatureCardRow[] = [
    { name: 'Distract', text: 'The spirits harry a foe, drawing its attention away from your allies.' },
    { name: 'Hinder', text: 'The spirits cling to a foe and hamper it.' },
    { name: 'Strike', text: 'The spirits lash out for an extra 1d4 Cold, Fire, or Lightning damage (your choice).' },
  ];
  if (input.level >= 6) {
    rows.push({
      name: 'Spirit Shield',
      kind: 'Reaction · Barbarian 6',
      text: `When a creature you can see within 30 ft. takes damage, reduce that damage by ${n}d6.`,
    });
  }
  if (input.level >= 10) {
    rows.push({
      name: 'Consult the Spirits',
      kind: 'Barbarian 10',
      text: 'Cast Augury or Clairvoyance without a spell slot or material components; Wisdom is your '
        + 'spellcasting ability. Once per Short or Long Rest.',
      spells: ['Augury', 'Clairvoyance'],
    });
  }
  if (input.level >= 14) {
    rows.push({
      name: "Spirits' Fury",
      kind: 'Barbarian 14',
      text: 'When you roll 18–20 on the d20 for a melee weapon attack made as part of the Attack action, '
        + 'you can make one extra attack. Once per turn.',
    });
  }
  return {
    name: 'Spiritual Guardian',
    source: `${PATH_OF_THE_SPIRITUAL_GUARDIAN} 3`,
    summary: 'Spiritual Protectors: your guardian spirits can take one of these options.',
    stats: [{ label: 'Rage Damage', value: fmtBonus(n) }],
    rows,
  };
}

/** Every card a WoW barbarian's sheet shows at this level and path, in panel order. */
export function shamanFeatureCards(input: FeatureCardInput): FeatureCard[] {
  return [totemsCard(input), ragingElementsCard(input), spiritualGuardianCard(input)]
    .filter((card): card is FeatureCard => !!card);
}

/** "+5" / "−1" for a bonus. */
function fmtBonus(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
