import { PC } from '../models/pc';
import { DEMON_HUNTER_SUBCLASS, EBON_BLADE_SUBCLASS } from '../models/hero-class';
import {
  ARCANA_DOMAIN, ARCANE_ARCHER, CONJURER, ENCHANTER, NECROMANCER, TRANSMUTER, VESTIGE_PATRON,
} from '../models/arcana-subclasses';
import { SCHOOLS_OF_MAGIC, schoolMasteryFeat } from '../models/arcana-feats';
import { featNamesOn } from '../models/character-feats';
import { modFromScore } from './character-math';

/**
 * Limited-use class features a character tracks between rests (D&D 2024, plus
 * the World of Warcraft module's Death Knight and Demon Hunter and the Arcana
 * Unleashed subclasses) — the client mirror of the server's
 * `progression/ClassResources`. The maximum is always
 * computed from class, subclass, level and ability scores; only the amount
 * USED is stored on the character (`pc.classResources`), and the server cleans
 * it on every save.
 *
 * The two tables are pinned together by one shared list of cases:
 * class-resources.spec.ts here and ClassResourcesTest on the server carry the
 * same block of text.
 *
 * Feats add counters of their own (featResourcesFor): the free casts and
 * limited uses of the Arcana Unleashed feats. They are the same kind of
 * resource, stored in the same map, listed after the class's and named for the
 * feat they belong to. A second shared block of cases pins those.
 */

/** What a Short Rest gives back. A Long Rest always restores everything. */
export type ShortRestRecovery = 'NONE' | 'ONE' | 'ALL';

export interface ClassResource {
  /** Stable key the used amount is stored under ("secondWind"). */
  key: string;
  /** What the sheet calls it ("Second Wind"). */
  name: string;
  /** The class feature it belongs to, as the feature lists name it ("Font of Magic"). */
  feature: string;
  /** The most the character can have; always at least 1. */
  max: number;
  shortRest: ShortRestRecovery;
  /** A pool of points or dice spent several at a time, not a handful of uses. */
  pool: boolean;
  /** What one of it is called ("uses", "points", "d8", "fragments"). */
  unit: string;
  /** True for a counter a feat gives; `feature` is then the feat's name. */
  fromFeat?: boolean;
}

/** A resource with how much of it the character has used and has left. */
export interface ClassResourceState extends ClassResource {
  used: number;
  remaining: number;
}

type ResourceSource = Pick<PC, 'clazz' | 'subclass' | 'level' | 'stats'> & Partial<Pick<PC, 'feat' | 'features'>>;

const uses = (key: string, name: string, feature: string, max: number, shortRest: ShortRestRecovery): ClassResource =>
  ({ key, name, feature, max, shortRest, pool: false, unit: 'uses' });

const pool = (
  key: string, name: string, feature: string, max: number, shortRest: ShortRestRecovery, unit: string,
): ClassResource => ({ key, name, feature, max, shortRest, pool: true, unit });

/** How a feat counter's maximum is worked out. */
type FeatMax =
  /** One use. */
  | 'one'
  /** As many as the Proficiency Bonus. */
  | 'proficiency'
  /** The highest of the Intelligence, Wisdom and Charisma modifiers, at least one. */
  | 'mental';

interface FeatUse {
  feat: string;
  key: string;
  name: string;
  max: FeatMax;
  shortRest: ShortRestRecovery;
}

const featUse = (feat: string, key: string, name: string, max: FeatMax, shortRest: ShortRestRecovery = 'NONE'): FeatUse =>
  ({ feat, key, name, max, shortRest });

/**
 * The Arcana Unleashed feats with something to count, in the book's order
 * (Origin, General, Epic Boon) — the server's ClassResources.FEAT_USES.
 * Everything returns on a Long Rest; Spell Overload on a Short Rest too. Boon of
 * Magic School Mastery is not listed: it has one counter per school taken.
 */
const FEAT_USES: readonly FeatUse[] = [
  featUse('Arcane Artist', 'inspiringMagic', 'Inspiring Magic', 'one'),
  featUse('Arcane Infiltrator', 'cunningDiversion', 'Cunning Diversion', 'proficiency'),
  featUse('Arcane Omens', 'helpfulPremonition', 'Helpful Premonition', 'proficiency'),
  featUse('Arcane Overload', 'powerSurge', 'Power Surge', 'one'),
  featUse('Arcane Safeguard', 'bonusActionResistance', 'Bonus Action Resistance', 'proficiency'),
  featUse('Arcane Undertaker', 'understandingOfDeath', 'Understanding of Death', 'one'),
  featUse('Familiar Friend', 'findFamiliarFreeCast', 'Find Familiar (free cast)', 'one'),
  featUse('Familiar Friend', 'helpfulFriend', 'Helpful Friend', 'proficiency'),
  featUse('Portal Jumper', 'portalStep', 'Portal Step', 'proficiency'),
  featUse('Transmuted Anatomy', 'resilientAnatomy', 'Resilient Anatomy', 'proficiency'),
  featUse('Divination Adept', 'prescientIntervention', 'Prescient Intervention', 'one'),
  featUse('Magic Connoisseur', 'connoisseurLevel1Spell', 'Level 1 spell (free cast)', 'one'),
  featUse('Magic Connoisseur', 'connoisseurLevel2Spell', 'Level 2 spell (free cast)', 'one'),
  featUse('Spell Resistant', 'magicResistant', 'Magic Resistant', 'proficiency'),
  featUse('Spell Subterfuge', 'shroudingSpells', 'Shrouding Spells', 'mental'),
  featUse('Warlike Familiar', 'battleFamiliarFreeCast', 'Battle Familiar (free cast)', 'one'),
  featUse('Boon of Erupting Spellpower', 'spellOverload', 'Spell Overload', 'one', 'ALL'),
];

/**
 * The counters a character's feats give it: for each feat it holds, in the
 * order held, that feat's free casts and limited uses. The resource's `feature`
 * is the feat's name, so the sheet puts the counter under the feat.
 *
 * "Proficiency Bonus" is the bonus for the character's level. Spell Subterfuge
 * counts "the modifier of the ability this feat increased"; that increase is
 * made by hand and not recorded, so the highest of the Intelligence, Wisdom
 * and Charisma modifiers is used (at least 1). Boon of Magic School Mastery has
 * one Signature Arcanum cast per school taken.
 *
 * @param feats names on the character that may be feats (featNamesOn); case and
 *   surrounding spaces do not matter, and a name listed twice counts once
 */
export function featResourcesFor(
  feats: readonly string[], level: number | null | undefined, stats?: Partial<NonNullable<PC['stats']>> | null,
): ClassResource[] {
  const out: ClassResource[] = [];
  const lvl = Math.max(1, level ?? 1);
  const proficiencyBonus = Math.floor((Math.min(lvl, 20) - 1) / 4) + 2;
  const mental = Math.max(1, ...(['INT', 'WIS', 'CHA'] as const).map(ability => modFromScore(stats?.[ability] ?? 10)));
  const held = [...new Set(feats.map(f => (f ?? '').trim().toLowerCase()).filter(f => !!f))];
  for (const feat of held) {
    for (const use of FEAT_USES) {
      if (use.feat.toLowerCase() !== feat) continue;
      const max = use.max === 'one' ? 1 : use.max === 'proficiency' ? proficiencyBonus : mental;
      out.push({ ...uses(use.key, use.name, use.feat, max, use.shortRest), fromFeat: true });
    }
    for (const school of SCHOOLS_OF_MAGIC) {
      const mastery = schoolMasteryFeat(school);
      if (mastery.toLowerCase() !== feat) continue;
      out.push({
        ...uses(`signatureArcanum${school}`, `Signature Arcanum (${school})`, mastery, 1, 'NONE'), fromFeat: true,
      });
    }
  }
  return out;
}

/**
 * The resources a character has, in display order: the class's, then its
 * feats'. Empty for a character with none.
 */
export function classResourcesFor(pc: ResourceSource | null | undefined): ClassResource[] {
  return [...resourcesOfClass(pc), ...featResourcesFor(featNamesOn(pc), pc?.level, pc?.stats)];
}

/** The class's own resources; empty for a class with none. */
function resourcesOfClass(pc: ResourceSource | null | undefined): ClassResource[] {
  const out: ClassResource[] = [];
  const clazz = (pc?.clazz ?? '').trim().toLowerCase();
  const subclass = (pc?.subclass ?? '').trim().toLowerCase();
  const lvl = Math.max(1, pc?.level ?? 1);
  const cha = modFromScore(pc?.stats?.CHA ?? 10);
  const wis = modFromScore(pc?.stats?.WIS ?? 10);
  const int = modFromScore(pc?.stats?.INT ?? 10);
  const is = (name: string): boolean => subclass === name.toLowerCase();
  /** One use, back on a Long Rest: most of the Arcana Unleashed subclass counters. */
  const once = (key: string, name: string, feature: string): ClassResource => uses(key, name, feature, 1, 'NONE');

  switch (clazz) {
    case 'fighter':
      out.push(uses('secondWind', 'Second Wind', 'Second Wind', lvl >= 10 ? 4 : lvl >= 4 ? 3 : 2, 'ONE'));
      if (lvl >= 2) out.push(uses('actionSurge', 'Action Surge', 'Action Surge', lvl >= 17 ? 2 : 1, 'ALL'));
      if (is(ARCANE_ARCHER)) {
        if (lvl >= 3) out.push(uses('arcaneShot', 'Arcane Shot', 'Arcane Shot', Math.max(1, int), 'ALL'));
        if (lvl >= 7) out.push(uses('magicalAmmunition', 'Magical Ammunition', 'Magical Ammunition', 1, 'ALL'));
      }
      break;
    case 'barbarian':
      out.push(uses('rage', 'Rage', 'Rage', lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2, 'ONE'));
      break;
    case 'bard':
      // Font of Inspiration (Bard 5): all back on a Short Rest too.
      out.push(uses('bardicInspiration', 'Bardic Inspiration', 'Bardic Inspiration',
        Math.max(1, cha), lvl >= 5 ? 'ALL' : 'NONE'));
      break;
    case 'cleric':
      if (lvl >= 2) {
        out.push(uses('channelDivinity', 'Channel Divinity', 'Channel Divinity', lvl >= 18 ? 4 : lvl >= 6 ? 3 : 2, 'ONE'));
      }
      if (is(ARCANA_DOMAIN) && lvl >= 6) {
        out.push(uses('dispellingRecovery', 'Dispelling Recovery', 'Dispelling Recovery', 1, 'ALL'));
      }
      break;
    case 'druid':
      if (lvl >= 2) out.push(uses('wildShape', 'Wild Shape', 'Wild Shape', lvl >= 17 ? 4 : lvl >= 6 ? 3 : 2, 'ONE'));
      break;
    case 'monk':
      if (lvl >= 2) out.push(pool('focusPoints', 'Focus Points', "Monk's Focus", lvl, 'ALL', 'points'));
      break;
    case 'paladin':
      if (subclass === EBON_BLADE_SUBCLASS.toLowerCase()) {
        // Death Knight: Death Coil replaces Lay On Hands — a pool of d8s, 1 + Charisma modifier.
        out.push(pool('deathCoil', 'Death Coil', 'Death Coil', Math.max(1, 1 + cha), 'NONE', 'd8'));
      } else {
        out.push(pool('layOnHands', 'Lay On Hands', 'Lay On Hands', 5 * lvl, 'NONE', 'points'));
      }
      if (lvl >= 3) out.push(uses('channelDivinity', 'Channel Divinity', 'Channel Divinity', lvl >= 11 ? 3 : 2, 'ONE'));
      break;
    case 'ranger':
      if (subclass === DEMON_HUNTER_SUBCLASS.toLowerCase() && lvl >= 3) {
        // Wisdom modifier (at least 1), one more from Ranger 13, two more from 17.
        const bonus = lvl >= 17 ? 2 : lvl >= 13 ? 1 : 0;
        out.push(pool('soulFragments', 'Soul Fragments', 'Soul Fragments', Math.max(1, wis) + bonus, 'NONE', 'fragments'));
      }
      break;
    case 'sorcerer':
      if (lvl >= 2) out.push(pool('sorceryPoints', 'Sorcery Points', 'Font of Magic', lvl, 'NONE', 'points'));
      break;
    case 'warlock':
      if (is(VESTIGE_PATRON)) {
        // Vestige Power (Warlock 6): the companion's Divine Power returns on a Short Rest too.
        if (lvl >= 3) out.push(uses('divinePower', 'Divine Power', 'Vestige Companion', 1, lvl >= 6 ? 'ALL' : 'NONE'));
        if (lvl >= 10) out.push(once('vestigeRecovery', 'Vestige Recovery', 'Vestige Recovery'));
        if (lvl >= 14) out.push(once('semblanceOfLife', 'Semblance of Life', 'Semblance of Life'));
      }
      break;
    case 'wizard':
      if (is(CONJURER)) {
        if (lvl >= 3) {
          out.push(uses('benignTransposition', 'Benign Transposition', 'Benign Transposition', Math.max(1, int), 'NONE'));
        }
        if (lvl >= 14) out.push(once('splinteredSummons', 'Splintered Summons', 'Splintered Summons'));
      } else if (is(ENCHANTER)) {
        if (lvl >= 3) out.push(uses('hypnoticPresence', 'Hypnotic Presence', 'Hypnotic Presence', Math.max(1, int), 'NONE'));
        // Split Enchantment has no minimum of one use: no counter without a positive modifier.
        if (lvl >= 6 && int >= 1) out.push(uses('splitEnchantment', 'Split Enchantment', 'Split Enchantment', int, 'NONE'));
        if (lvl >= 10) out.push(once('instinctiveCharm', 'Instinctive Charm', 'Instinctive Charm'));
      } else if (is(NECROMANCER)) {
        if (lvl >= 6) out.push(once('undeadThralls', 'Animate Dead (free cast)', 'Undead Thralls'));
        if (lvl >= 14) out.push(once('bolsterUndead', 'Bolster Undead', "Death's Master"));
      } else if (is(TRANSMUTER)) {
        if (lvl >= 3) out.push(once('wondrousAlteration', 'Alter Self (free cast)', 'Wondrous Alteration'));
        if (lvl >= 6) {
          out.push(uses('empoweredTransmutation', 'Empowered Transmutation', 'Empowered Transmutation', Math.max(1, int), 'NONE'));
        }
        if (lvl >= 10) {
          out.push(once('shapeShifterCast', 'Polymorph (free cast)', 'Shape-Shifter'));
          out.push(once('shapeShifterSelf', 'Shape-Shifter (self)', 'Shape-Shifter'));
        }
        if (lvl >= 14) out.push(once('masterTransmuter', 'Master Transmuter', 'Master Transmuter'));
      }
      break;
  }
  return out;
}

/** The class whose spell slots (Pact Magic) all return on a Short Rest. */
export function regainsSpellSlotsOnShortRest(clazz: string | null | undefined): boolean {
  return (clazz ?? '').trim().toLowerCase() === 'warlock';
}

/** The resources shown on the hero-class panel (beside the hero feature) rather than in the class feature list. */
export const HERO_PANEL_RESOURCES: readonly string[] = ['deathCoil', 'soulFragments'];

const clamp = (value: unknown, max: number): number =>
  Math.max(0, Math.min(typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0, max));

/** Every resource the character has, with what is used and what is left (clamped to the maximum). */
export function classResourceStates(pc: PC | null | undefined): ClassResourceState[] {
  const stored = pc?.classResources ?? {};
  return classResourcesFor(pc).map(r => {
    const used = clamp(stored[r.key], r.max);
    return { ...r, used, remaining: r.max - used };
  });
}

/**
 * The stored map after setting one resource's used amount: clamped, with
 * unknown resources and zeroes dropped. Always an object (never null), so a
 * save that hands everything back still tells the server so.
 */
export function withResourceUsed(pc: PC, key: string, used: number): Record<string, number> {
  const next: Record<string, number> = {};
  for (const r of classResourceStates(pc)) {
    const amount = r.key === key ? clamp(used, r.max) : r.used;
    if (amount > 0) next[r.key] = amount;
  }
  return next;
}

/** "Short Rest: 1 back. Long Rest: all back." — when a resource returns. */
export function recoveryLabel(resource: ClassResource): string {
  if (resource.shortRest === 'ALL') return 'All back on a Short or Long Rest.';
  if (resource.shortRest === 'ONE') return 'Short Rest: 1 back. Long Rest: all back.';
  return 'All back on a Long Rest.';
}

/** A Long Rest: every resource back (demo mirror of the server). */
export function restoreClassResources(pc: PC): PC {
  return classResourcesFor(pc).length || pc.classResources ? { ...pc, classResources: {} } : pc;
}

/**
 * A Short Rest (demo mirror of the server): each resource regains what the
 * table says, and a Warlock's Pact Magic slots return. A hero at 0 Hit Points
 * is left alone.
 */
export function applyShortRestToPc(pc: PC): PC {
  if (pc.hp && pc.hp.cur <= 0) return pc;
  const classResources: Record<string, number> = {};
  for (const r of classResourceStates(pc)) {
    const after = r.shortRest === 'ALL' ? 0 : r.shortRest === 'ONE' ? Math.max(0, r.used - 1) : r.used;
    if (after > 0) classResources[r.key] = after;
  }
  const spellSlots = regainsSpellSlotsOnShortRest(pc.clazz) && pc.spellSlots
    ? Object.fromEntries(Object.entries(pc.spellSlots).map(([lvl, slot]) => [lvl, { ...slot, used: 0 }]))
    : pc.spellSlots;
  return { ...pc, classResources, spellSlots };
}
