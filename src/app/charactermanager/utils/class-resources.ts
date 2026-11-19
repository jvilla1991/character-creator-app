import { PC } from '../models/pc';
import { DEMON_HUNTER_SUBCLASS, EBON_BLADE_SUBCLASS } from '../models/hero-class';
import { modFromScore } from './character-math';

/**
 * Limited-use class features a character tracks between rests (D&D 2024, plus
 * the World of Warcraft module's Death Knight and Demon Hunter) — the client
 * mirror of the server's `progression/ClassResources`. The maximum is always
 * computed from class, subclass, level and ability scores; only the amount
 * USED is stored on the character (`pc.classResources`), and the server cleans
 * it on every save.
 *
 * The two tables are pinned together by one shared list of cases:
 * class-resources.spec.ts here and ClassResourcesTest on the server carry the
 * same block of text.
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
}

/** A resource with how much of it the character has used and has left. */
export interface ClassResourceState extends ClassResource {
  used: number;
  remaining: number;
}

type ResourceSource = Pick<PC, 'clazz' | 'subclass' | 'level' | 'stats'>;

const uses = (key: string, name: string, feature: string, max: number, shortRest: ShortRestRecovery): ClassResource =>
  ({ key, name, feature, max, shortRest, pool: false, unit: 'uses' });

const pool = (
  key: string, name: string, feature: string, max: number, shortRest: ShortRestRecovery, unit: string,
): ClassResource => ({ key, name, feature, max, shortRest, pool: true, unit });

/** The resources a character has, in display order; empty for a class with none. */
export function classResourcesFor(pc: ResourceSource | null | undefined): ClassResource[] {
  const out: ClassResource[] = [];
  const clazz = (pc?.clazz ?? '').trim().toLowerCase();
  const subclass = (pc?.subclass ?? '').trim().toLowerCase();
  const lvl = Math.max(1, pc?.level ?? 1);
  const cha = modFromScore(pc?.stats?.CHA ?? 10);
  const wis = modFromScore(pc?.stats?.WIS ?? 10);

  switch (clazz) {
    case 'fighter':
      out.push(uses('secondWind', 'Second Wind', 'Second Wind', lvl >= 10 ? 4 : lvl >= 4 ? 3 : 2, 'ONE'));
      if (lvl >= 2) out.push(uses('actionSurge', 'Action Surge', 'Action Surge', lvl >= 17 ? 2 : 1, 'ALL'));
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
