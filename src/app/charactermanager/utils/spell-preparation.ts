import { PC, PcSpell } from '../models/pc';

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
 */
export function preparedSpellCap(clazz: string | undefined, level: number | undefined): number | null {
  const row = PREPARED_SPELLS[(clazz ?? '').trim().toLowerCase()];
  if (!row) return null;
  const idx = Math.min(Math.max(level ?? 1, 1), row.length) - 1;
  return row[idx];
}

/**
 * Whether a spell counts as prepared. Cantrips are always prepared (2024 rules:
 * always available, never counted), and a missing `prepared` field — spells
 * saved before the flag existed — is treated as prepared so older characters
 * keep casting exactly as before.
 */
export function isSpellPrepared(spell: PcSpell): boolean {
  return spell.lvl === 0 || spell.prepared !== false;
}

/** How many leveled spells are currently prepared (cantrips excluded). */
export function countPreparedSpells(spells: PC['spells']): number {
  return (spells ?? []).filter(s => s.lvl > 0 && isSpellPrepared(s)).length;
}
