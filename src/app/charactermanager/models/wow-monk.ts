import type { FeatureCard, FeatureCardInput, FeatureCardRow } from './hero-class';
import { modFromScore } from '../utils/character-math';

/**
 * The World of Warcraft Monk's sheet cards — for a WoW monk on the WoW-only
 * Warrior of Mystic Brews (the Brewmaster's tradition): its level-3 features
 * from Monk 3, and the Mystic Brew card with the numbers worked out from Monk 6.
 * Computed from the character, never persisted; the feature text itself comes
 * from the server, so the cards are short paraphrases. The monk's
 * class-variant entry lives in {@link ./wow-class-variants}.
 */

/** The WoW-only monk subclass — the server offers it to WoW monks only. */
export const WARRIOR_OF_MYSTIC_BREWS = 'Warrior of Mystic Brews';

/** The Monk's Martial Arts die by Monk level: d6 (1–4), d8 (5–10), d10 (11–16), d12 (17+). */
export function martialArtsDie(level: number): number {
  return level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
}

/** Proficiency bonus: the stored one, else derived from the level. */
function proficiency(input: FeatureCardInput): number {
  return input.prof ?? Math.floor((Math.max(1, input.level) - 1) / 4) + 2;
}

function wisMod(input: FeatureCardInput): number {
  return modFromScore(input.stats?.WIS ?? 10);
}

/** The Mystic Brew save DC (Cinnamon Dragon): 8 + WIS modifier + Proficiency Bonus. */
export function mysticBrewSaveDc(input: FeatureCardInput): number {
  return 8 + wisMod(input) + proficiency(input);
}

/**
 * Refreshing Dip's pool of Martial Arts dice: WIS modifier + half the Monk level
 * (rounded down), never below one die.
 */
export function refreshingDipDice(input: FeatureCardInput): number {
  return Math.max(1, wisMod(input) + Math.floor(input.level / 2));
}

function sameName(a: string | null | undefined, b: string): boolean {
  return (a ?? '').toLowerCase() === b.toLowerCase();
}

// ── Warrior of Mystic Brews (Monk 3) ─────────────────────────────────────────

export function mysticBrewsCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 3 || !sameName(input.subclass, WARRIOR_OF_MYSTIC_BREWS)) return null;
  const die = `d${martialArtsDie(input.level)}`;
  const rows: FeatureCardRow[] = [
    {
      name: 'Bonus Proficiencies',
      text: "You're proficient in Performance (or another Monk skill if you already are) and with Brewer's Supplies.",
    },
    {
      name: 'Drunken Technique',
      text: 'When you spend a Focus Point on Patient Defense, your Speed rises by 10 ft. until the end of the turn '
        + 'and you can make one Unarmed Strike right after that Bonus Action.',
    },
  ];
  if (input.level >= 6) {
    rows.push({
      name: 'Tipsy Sway',
      kind: 'Monk 6',
      text: 'Standing up from Prone costs only 5 ft. of movement. When an enemy misses you with a melee attack, you can '
        + 'take a Reaction and spend 1 Focus Point to turn that attack onto another creature within 5 ft. of you.',
    });
  }
  if (input.level >= 17) {
    rows.push({
      name: 'Intoxicated Frenzy',
      kind: 'Monk 17',
      text: 'Right after you use Patient Defense, move up to your Speed and make one Unarmed Strike against each creature '
        + 'you pass within 5 ft. of (once per creature per turn); a creature you hit falls Prone unless it passes a '
        + 'Dexterity save.',
    });
  }
  return {
    name: WARRIOR_OF_MYSTIC_BREWS,
    source: `${WARRIOR_OF_MYSTIC_BREWS} 3`,
    stats: [{ label: 'Martial Arts', value: die }],
    rows,
  };
}

// ── Mystic Brew (Monk 6) ─────────────────────────────────────────────────────

/** The brew rules, as one line under the card heading. */
export const MYSTIC_BREW_RULES = "Brew one beverage when you finish a Short or Long Rest holding Brewer's Supplies. "
  + 'Only you can drink it, which takes 1 minute; it lasts 1 hour, or 8 hours if you spend 1 Focus Point. '
  + 'An undrunk brew vanishes when you next finish a rest.';

export function mysticBrewCard(input: FeatureCardInput): FeatureCard | null {
  if (input.level < 6 || !sameName(input.subclass, WARRIOR_OF_MYSTIC_BREWS)) return null;
  const die = martialArtsDie(input.level);
  const dc = mysticBrewSaveDc(input);
  const pool = refreshingDipDice(input);
  const rows: FeatureCardRow[] = [
    {
      name: 'Cinnamon Dragon',
      kind: `4d${die} Fire`,
      text: `Magic action: exhale a 30-ft. Cone. Each creature in it makes a DC ${dc} Dexterity save — on a failure it `
        + 'takes the damage and is Poisoned until the end of its next turn; on a success, half damage only.',
    },
    {
      name: 'Heavenly Spirit',
      text: 'You have Resistance to two of Cold, Necrotic, Psychic, or Radiant damage (your choice).',
    },
    {
      name: 'Refreshing Dip',
      kind: `${pool}d${die} pool`,
      text: 'When you regain Hit Points, spend a die from the pool to add its roll to the healing.',
    },
  ];
  if (input.level >= 11) {
    rows.push(
      {
        name: 'Blue Lightning',
        kind: 'Wizened Brewer · Monk 11',
        text: "When you take a Reaction that isn't an Opportunity Attack or a spell, you can also make one Unarmed Strike.",
      },
      {
        name: "Drunkard's Luck",
        kind: 'Wizened Brewer · Monk 11',
        text: 'Gain Heroic Inspiration if you lack it; without it, you can grant it to yourself when you make an ability '
          + 'check or saving throw.',
      },
      {
        name: 'Stumbling Monk',
        kind: 'Wizened Brewer · Monk 11',
        text: 'After you take a Bonus Action other than Patient Defense, you can also use Patient Defense.',
      },
    );
  }
  if (input.level >= 17) {
    rows.push({
      name: 'Master Brewer',
      kind: 'Monk 17',
      text: 'Each Mystic Brew can combine two of these options in one beverage.',
    });
  }
  return {
    name: 'Mystic Brew',
    source: `${WARRIOR_OF_MYSTIC_BREWS} 6`,
    summary: MYSTIC_BREW_RULES,
    stats: [
      { label: 'Martial Arts', value: `d${die}` },
      { label: 'Brew save DC', value: String(dc) },
      { label: 'Refreshing Dip', value: `${pool}d${die}` },
    ],
    rowsTitle: 'Brew options',
    rows,
  };
}

/** Every card a WoW monk's sheet shows at this level and subclass, in panel order. */
export function monkFeatureCards(input: FeatureCardInput): FeatureCard[] {
  return [mysticBrewsCard(input), mysticBrewCard(input)].filter((card): card is FeatureCard => !!card);
}
