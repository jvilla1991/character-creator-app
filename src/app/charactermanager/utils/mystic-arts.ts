import { WARRIOR_OF_THE_MYSTIC_ARTS } from '../models/arcana-subclasses';

// ── Warrior of the Mystic Arts (Arcana Unleashed) ────────────────────────────
// The Monk subclass that casts Sorcerer spells with Wisdom from Monk level 3:
// a third-caster table of its own. Client mirror of the server's
// progression/MysticArtsSpellcasting; mystic-arts.spec.ts pins every level to
// the same numbers as MysticArtsSpellcastingTest. Tables only: the app's
// class-keyed lookups (classSlotTable, preparedSpellCap, the casting ability,
// the spell list) read them for this one subclass, and no other character
// gets anything from here.

/** The class the subclass belongs to, as the class-keyed tables spell it. */
const MYSTIC_ARTS_CLASS = 'monk';

/** The Monk level its Spellcasting starts at. */
export const MYSTIC_ARTS_SPELLCASTING_LEVEL = 3;

/** The class whose spell list it learns from. */
export const MYSTIC_ARTS_SPELL_LIST = 'Sorcerer';

/** Its spellcasting ability. */
export const MYSTIC_ARTS_CASTING_ABILITY = 'WIS';

/** The Monk level Mystic Focus arrives at. */
export const MYSTIC_FOCUS_LEVEL = 6;

/** The highest spell level it ever has slots for, and Mystic Focus can recover. */
export const MYSTIC_FOCUS_MAX_SLOT_LEVEL = 4;

/** Slots by Monk level 1-20 (rows) and spell level from 1st up (columns). */
const SLOTS: number[][] = [
  [], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3],
  [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3],
  [4, 3, 3, 1], [4, 3, 3, 1],
];

/** The Prepared Spells column by Monk level 1-20. */
const PREPARED: readonly number[] = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];

/** Focus Points a recovered slot costs, by spell level 1-4. */
const FOCUS_COST: readonly number[] = [2, 3, 5, 6];

/** The Monk level needed to recover a slot, by spell level 1-4. */
const RECOVER_MIN_LEVEL: readonly number[] = [6, 7, 13, 19];

/** True for a Monk whose subclass is the Warrior of the Mystic Arts (case and spaces aside). */
export function isMysticArtsMonk(
  pc: { clazz?: string | null; subclass?: string | null } | null | undefined,
): boolean {
  return (pc?.clazz ?? '').trim().toLowerCase() === MYSTIC_ARTS_CLASS
    && (pc?.subclass ?? '').trim().toLowerCase() === WARRIOR_OF_THE_MYSTIC_ARTS.toLowerCase();
}

const rowIndex = (level: number): number => Math.min(Math.max(Math.trunc(level), 1), 20) - 1;

/** Its slot maximum per spell level at a Monk level (clamped into 1-20); empty below 3. */
export function mysticArtsSlotTable(level: number): { [spellLevel: number]: number } {
  const out: { [spellLevel: number]: number } = {};
  SLOTS[rowIndex(level)].forEach((max, i) => { if (max > 0) out[i + 1] = max; });
  return out;
}

/** Prepared spells at a Monk level: 3 at level 3, 13 at level 20; 0 below 3. */
export function mysticArtsPreparedSpells(level: number): number {
  return level < 1 ? 0 : PREPARED[rowIndex(level)];
}

/** Sorcerer cantrips known at a Monk level: two from 3, a third from 10. */
export function mysticArtsCantripsKnown(level: number): number {
  if (level < MYSTIC_ARTS_SPELLCASTING_LEVEL) return 0;
  return level >= 10 ? 3 : 2;
}

/** True for a spell level Mystic Focus deals in: 1 to 4. */
export function isMysticFocusSlotLevel(slotLevel: number | null | undefined): slotLevel is number {
  return Number.isInteger(slotLevel) && slotLevel! >= 1 && slotLevel! <= MYSTIC_FOCUS_MAX_SLOT_LEVEL;
}

/** Focus Points it costs to recover a slot of this level: 2, 3, 5, 6 for levels 1 to 4. */
export function mysticFocusCost(slotLevel: number): number {
  return FOCUS_COST[slotLevel - 1];
}

/** The Monk level needed to recover a slot of this level: 6, 7, 13, 19 for levels 1 to 4. */
export function mysticFocusMinLevel(slotLevel: number): number {
  return RECOVER_MIN_LEVEL[slotLevel - 1];
}
