import { PC, PcSpell } from '../models/pc';
import { isMysticArtsMonk, mysticArtsPreparedSpells } from './mystic-arts';

/**
 * 2024 PHB "Prepared Spells" column from each class's Features table — the cap
 * on leveled (non-cantrip) spells a character may have prepared at a given
 * class level. Index = class level − 1. Cantrips are always available and never
 * count against the cap. Values verified against the SRD 5.2 class tables.
 *
 * Mirrors the shape of SPELL_COUNTS in dnd-resources.service.ts (which covers
 * only the level-1 creation counts); kept in its own utils file so the sheet
 * doesn't pull the whole resources service in for a constant lookup.
 */
export const PREPARED_SPELLS: Record<string, readonly number[]> = {
  //          1  2  3  4  5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20
  bard:     [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  cleric:   [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  druid:    [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  paladin:  [2, 3, 4, 5, 6,  6,  7,  7,  9,  9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  ranger:   [2, 3, 4, 5, 6,  6,  7,  7,  9,  9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  warlock:  [2, 3, 4, 5, 6,  7,  8,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  wizard:   [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
};

/**
 * Prepared-spell cap for a class at a level, or null when the class has no
 * Prepared Spells table (non-caster or homebrew) — callers treat null as
 * "no cap enforced". Levels clamp into the 1–20 table range.
 *
 * `subclass` matters for a Monk of the Warrior of the Mystic Arts, who has a
 * Prepared Spells column of its own from Monk level 3 (null below it).
 */
export function preparedSpellCap(
  clazz: string | undefined, level: number | undefined, subclass?: string | null,
): number | null {
  if (isMysticArtsMonk({ clazz, subclass })) return mysticArtsPreparedSpells(level ?? 1) || null;
  const row = PREPARED_SPELLS[(clazz ?? '').trim().toLowerCase()];
  if (!row) return null;
  const idx = Math.min(Math.max(level ?? 1, 1), row.length) - 1;
  return row[idx];
}

/**
 * True for a leveled spell a feature always keeps prepared (`alwaysPrepared` on
 * the saved spell). Such a spell is outside the prepared list altogether: it is
 * always castable, never counts against the cap, and is not part of a long-rest
 * spell change. The server's LongRestRules reads the same marker.
 */
export function isAlwaysPrepared(spell: PcSpell): boolean {
  return spell.lvl > 0 && spell.alwaysPrepared === true;
}

/**
 * Whether a spell counts as prepared. Cantrips are always prepared (2024 rules:
 * always available, never counted), so is a spell a feature always keeps
 * prepared, and a missing `prepared` field — spells saved before the flag
 * existed — is treated as prepared so older characters keep casting exactly as
 * before.
 */
export function isSpellPrepared(spell: PcSpell): boolean {
  return spell.lvl === 0 || isAlwaysPrepared(spell) || spell.prepared !== false;
}

/**
 * How many leveled spells are prepared against the class cap: cantrips and
 * always-prepared spells are not counted.
 */
export function countPreparedSpells(spells: PC['spells']): number {
  return (spells ?? []).filter(s => s.lvl > 0 && !isAlwaysPrepared(s) && isSpellPrepared(s)).length;
}

/**
 * A copy of newly chosen spells with at most `cap` leveled ones prepared, in
 * pick order; the rest start unprepared. A Wizard's six level-1 spellbook
 * spells against four prepared is the one case at character creation. Cantrips
 * and always-prepared spells are left alone; a null cap changes nothing.
 */
export function withPreparedCap(spells: readonly PcSpell[], cap: number | null): PcSpell[] {
  let prepared = 0;
  return spells.map(s => {
    if (cap == null || s.lvl === 0 || isAlwaysPrepared(s) || !isSpellPrepared(s)) return s;
    prepared++;
    return prepared > cap ? { ...s, prepared: false } : s;
  });
}

// ── Long rest ───────────────────────────────────────────────────────────────
// What a class may do to its prepared spells as a long rest ends (2024 PHB).
// The server (LongRestRules) checks the same rules when the player readies.

/** ANY: any number (Cleric, Druid, Wizard). ONE: replace one (Paladin, Ranger). NONE: no change at a long rest. */
export type LongRestSpellChange = 'ANY' | 'ONE' | 'NONE';

export function longRestSpellChange(clazz: string | undefined): LongRestSpellChange {
  switch ((clazz ?? '').trim().toLowerCase()) {
    case 'cleric':
    case 'druid':
    case 'wizard':
      return 'ANY';
    case 'paladin':
    case 'ranger':
      return 'ONE';
    default:
      return 'NONE';
  }
}

/**
 * The hero's leveled spells, in sheet order — the ones a prepared list is chosen
 * from, so always-prepared spells are left out.
 */
export function leveledSpells(spells: PC['spells']): PcSpell[] {
  return (spells ?? []).filter(s => s.lvl > 0 && !isAlwaysPrepared(s));
}

/** Names of the leveled spells that count as prepared right now. */
export function preparedSpellNames(spells: PC['spells']): string[] {
  return leveledSpells(spells).filter(isSpellPrepared).map(s => s.name);
}

/** True when a hero has prepared spells to choose as a long rest ends. */
export function canChangeSpellsAtLongRest(pc: Pick<PC, 'clazz' | 'spells'>): boolean {
  return longRestSpellChange(pc.clazz) !== 'NONE' && leveledSpells(pc.spells).length > 0;
}

/**
 * Whether a spell may be ticked or unticked in a long rest prepared list.
 * `original` is the list the hero came into the rest with, `selected` the list
 * as it stands. Unticking is always allowed for ANY; ticking stops at the cap.
 * For ONE the list may differ from the original by one spell out and one in,
 * and undoing either half is always allowed.
 */
export function canToggleLongRestSpell(
  name: string, original: readonly string[], selected: readonly string[],
  change: LongRestSpellChange, cap: number | null,
): boolean {
  if (change === 'NONE') return false;
  const isSelected = selected.includes(name);
  const wasSelected = original.includes(name);
  const added = selected.filter(n => !original.includes(n));
  const removed = original.filter(n => !selected.includes(n));
  if (isSelected) {
    if (change === 'ANY') return true;
    return !wasSelected || removed.length === 0;        // undo the add, or make the one removal
  }
  const room = cap == null || selected.length < cap;
  if (change === 'ANY') return room;
  if (wasSelected) return true;                         // undo the removal (it was within the cap before)
  return added.length === 0 && room;                    // make the one addition
}

/** The same two lists as sets: has the hero changed anything? */
export function samePreparedList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every(n => b.includes(n));
}

/**
 * A copy of the spell list with `prepared` set from a chosen list of names
 * (cantrips and always-prepared spells untouched).
 */
export function withPreparedSpells(spells: PC['spells'], names: readonly string[]): PcSpell[] {
  const wanted = new Set(names.map(n => n.toLowerCase()));
  return (spells ?? []).map(s => (s.lvl > 0 && !isAlwaysPrepared(s)
    ? { ...s, prepared: wanted.has(s.name.toLowerCase()) } : s));
}
