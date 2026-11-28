import { PC } from './pc';
import { Follower, FollowerStatBlock } from './follower';
import { VESTIGE_PATRON, VESTIGE_TYPES, VestigeType } from './arcana-subclasses';
import { companionCarriedOver, isCompanion } from './companion';
import { adjustmentSum, adjustmentsFor } from './stat-adjustment';
import { fmtMod, modFromScore, proficiencyForLevel } from '../utils/character-math';

/**
 * A Vestige Patron's companion (Arcana Unleashed, Warlock 3): the client's copy
 * of the server's VestigeCompanion and VestigeCompanionSync.
 *
 * The companion is a follower the server owns. It exists exactly while its
 * warlock is a Vestige Patron of level 3 or higher with a Vestige type chosen,
 * and every number on it comes from the warlock, so the server rebuilds it
 * after every level-up, sheet save and change of the type. In the real app
 * this file builds nothing: the sheet shows the follower the server made. It
 * is here for demo mode, which has no server, and its builder is pinned to the
 * server's by the cases in the spec (the same block of text sits in the
 * backend's VestigeCompanionTest).
 *
 * The block is laid out like a creature a spell makes (models/spell-followers):
 * the attack, the trait and the bonus action are features named by their
 * `source`, facts about the creature are "other" features, and the condition
 * immunities are the sheet's own chips. It also carries `companion: 'vestige'`,
 * which tells this companion from any other. Feature text is a summary in our
 * own words.
 */

/** The name a new vestige is given; the player may rename it. */
export const VESTIGE_NAME = 'Vestige';

/** The Warlock level the companion arrives at. */
export const VESTIGE_FROM_LEVEL = 3;

/** A vestige's stat block: a follower's, plus the marker. */
export type VestigeStatBlock = FollowerStatBlock & { companion: 'vestige' };

type Feature = NonNullable<PC['features']>[number];

const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** True for a Warlock whose subclass is the Vestige Patron, whatever its level or choices. */
export function isVestigePatron(pc: Pick<PC, 'clazz' | 'subclass'> | null | undefined): boolean {
  return lower(pc?.clazz) === 'warlock' && lower(pc?.subclass) === lower(VESTIGE_PATRON);
}

/**
 * The type of the vestige this character has, or null when it has none: it is
 * not a Vestige Patron, it is below Warlock 3, or no valid type is chosen.
 */
export function vestigeTypeOf(
  pc: Pick<PC, 'clazz' | 'subclass' | 'level' | 'subclassChoices'> | null | undefined,
): VestigeType | null {
  if (!pc || !isVestigePatron(pc) || (pc.level ?? 1) < VESTIGE_FROM_LEVEL) return null;
  const wanted = lower(pc.subclassChoices?.vestigeType);
  return VESTIGE_TYPES.find(type => lower(type) === wanted) ?? null;
}

/** True when a follower is a vestige. */
export function isVestigeCompanion(follower: Pick<Follower, 'kind' | 'statBlock'>): boolean {
  return isCompanion(follower) && (follower.statBlock as Partial<VestigeStatBlock>)?.companion === 'vestige';
}

/** The damage a vestige of each type deals and resists. */
export const VESTIGE_DAMAGE: Readonly<Record<VestigeType, string>> = {
  Celestial: 'Radiant', Fiend: 'Fire', Undead: 'Necrotic',
};

/** `1d6 + 7`, `1d6 - 2`, or the bare dice when the bonus is zero. */
const dice = (die: string, bonus: number): string =>
  bonus === 0 ? die : `${die} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`;

const feature = (name: string, source: string, desc: string): Feature => ({ name, source, desc });
const fact = (name: string, desc: string): Feature => ({ name, source: 'Stat block', desc, category: 'other' });

const USE = ' One use, counted as Divine Power on your sheet.';

/** The one Divine Power option a vestige of this type has. */
function divinePower(type: VestigeType, charismaModifier: number): Feature {
  switch (type) {
    case 'Celestial': return feature('Divine Power: Healing Touch', 'Bonus Action',
      `It touches another creature, which regains ${dice('2d8', charismaModifier)} Hit Points and loses one `
      + `condition: Blinded, Deafened or Poisoned.${USE}`);
    case 'Undead': return feature('Divine Power: Cursed Invocation', 'Bonus Action',
      'It curses a creature you can see within 30 ft. of it for 1 minute. The cursed creature has Disadvantage on '
      + `attack rolls against you and the vestige.${USE}`);
    default: return feature('Divine Power: Fiendish Swap', 'Bonus Action',
      `While you and the vestige are within 60 ft. of each other, you teleport into each other's space.${USE}`);
  }
}

const BIO = 'The vestige of a dying god, bound to you by your pact. It acts on your turn: it moves and uses its '
  + 'Reaction by itself, but only Dodges unless you command it with a Bonus Action or give up one attack of your '
  + "Attack action for its Vestige's Strike. At 0 Hit Points it disappears until you perform a 1-minute ceremony, "
  + 'which brings it back with all its Hit Points.';

/** What a vestige is built from: all of it the warlock's. */
export interface VestigeInputs {
  type: VestigeType;
  /** The warlock's level: Hit Points and Hit Dice follow it. */
  level: number;
  /** The warlock's Charisma score. */
  charisma: number;
  /** The warlock's Proficiency Bonus. */
  prof: number;
  /** The languages the warlock knows, which the vestige speaks. */
  languages: readonly string[];
}

/**
 * The vestige's stat block at full Hit Points, with no temporary Hit Points and
 * no conditions. Key for key the block the server builds.
 */
export function buildVestigeStatBlock(input: VestigeInputs): VestigeStatBlock {
  const cha = modFromScore(input.charisma);
  const hp = 4 + 4 * input.level;
  const damage = VESTIGE_DAMAGE[input.type];
  return {
    companion: 'vestige',
    clazz: 'Vestige',
    race: input.type,
    level: input.level,
    alignment: 'Neutral',
    hp: { max: hp, cur: hp, temp: 0 },
    ac: 13 + cha,
    init: 2,
    speed: 5,
    prof: input.prof,
    stats: { STR: 1, DEX: 14, CON: 10, INT: 15, WIS: 15, CHA: 16 },
    saves: [],
    skills: {},
    conditions: [],
    conditionImmunities: ['charmed', 'frightened', 'prone'],
    coins: { cp: 0, sp: 0, gp: 0 },
    spellSlots: {},
    spells: [],
    inventory: [],
    features: [
      feature('Pact Bond', 'Trait',
        `Adds ${fmtMod(input.prof)} (your Proficiency Bonus) to every ability check and saving throw it makes.`),
      feature("Vestige's Strike", 'Action',
        `Melee or ranged attack: ${fmtMod(input.prof + cha)} to hit, reach 5 ft. or range 60 ft. `
        + `Hit: ${dice('1d6', 3 + cha)} ${damage} damage.`),
      divinePower(input.type, cha),
      fact('Creature', `Small ${input.type}, Neutral`),
      fact('Movement', 'Fly 30 ft. (hover)'),
      fact('Resistance', `${damage} damage.`),
      fact('Hit Dice', `${input.level}d6`),
    ],
    languages: [...input.languages],
    toolProfs: [],
    bio: BIO,
  };
}

/**
 * What this character's vestige is built from, or null when it has none. The
 * Proficiency Bonus is worked out the way the server does it: the table for
 * the level plus the DM's lines, not whatever the sheet happens to store.
 */
export function vestigeInputsFor(
  pc: Pick<PC, 'clazz' | 'subclass' | 'level' | 'subclassChoices' | 'stats' | 'statAdjustments' | 'languages'>,
): VestigeInputs | null {
  const type = vestigeTypeOf(pc);
  if (!type) return null;
  const level = pc.level ?? 1;
  return {
    type,
    level,
    charisma: pc.stats?.CHA ?? 10,
    prof: proficiencyForLevel(level) + adjustmentSum(adjustmentsFor(pc, 'prof')),
    languages: (pc.languages ?? []).filter(l => typeof l === 'string' && !!l.trim()).map(l => l.trim()),
  };
}

/**
 * The server's one sync step, for demo mode: a character's followers after the
 * character changed. A character that has a vestige gets one (named
 * {@link VESTIGE_NAME}, at full Hit Points) or has its block rebuilt, keeping
 * the name, the Hit Points (raised by any growth of the maximum), the temporary
 * Hit Points and the conditions; a character that has none loses it. Every
 * other follower is returned as it was, and when nothing changes so is the
 * list itself.
 *
 * @param newId the id for a follower that has to be created
 */
export function syncVestigeCompanion(
  followers: readonly Follower[], pc: PC, newId: () => number,
): readonly Follower[] {
  const vestiges = followers.filter(isVestigeCompanion);
  const inputs = vestigeInputsFor(pc);
  if (!inputs) return vestiges.length ? followers.filter(f => !isVestigeCompanion(f)) : followers;

  const fresh = buildVestigeStatBlock(inputs);
  if (!vestiges.length) {
    return [...followers, {
      id: newId(), pcId: pc.id, name: VESTIGE_NAME, statBlock: fresh,
      createdAt: new Date().toISOString(), kind: 'COMPANION',
    }];
  }
  const kept = vestiges[0];
  const next = companionCarriedOver(fresh, kept.statBlock);
  const same = JSON.stringify(next) === JSON.stringify(kept.statBlock);
  if (same && vestiges.length === 1) return followers;
  return followers
    .filter(f => f === kept || !isVestigeCompanion(f))
    .map(f => (f === kept && !same ? { ...kept, statBlock: next } : f));
}
