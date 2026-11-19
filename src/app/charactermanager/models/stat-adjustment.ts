// ── Labelled adjustments to a calculated number ─────────────────────────────
// A DM adds lines such as "+1 | Taunka" under the lines the app works out by
// itself. They are stored on the character, keyed by the number they adjust,
// and are part of that number's saved total (so `pc.ac` already includes them).

/** One line a DM added to a number: a signed whole amount and a short reason. */
export interface StatAdjustment {
  value: number;
  label: string;
}

/**
 * The maximum number of spell slots of one spell level, 1st to 9th. Unlike
 * Armor Class the server works this total out itself: the class table plus
 * these lines (`{ "slot3": [{ "value": 1, "label": "Pearl of Power" }] }` is
 * one more 3rd-level slot). See SpellSlotState in the backend.
 */
export type SlotStat = 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7' | 'slot8' | 'slot9';

/** Every slot key, in spell-level order: `SLOT_STATS[0]` is `slot1`. */
export const SLOT_STATS: readonly SlotStat[] =
  ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9'];

/** The key holding the bonus lines for a spell level (1-9): 3 → `slot3`. */
export function slotStat(spellLevel: number): SlotStat {
  const stat = SLOT_STATS[spellLevel - 1];
  if (!stat) throw new Error(`No spell slots of level ${spellLevel}`);
  return stat;
}

/** The spell level a slot key stands for (`slot3` → 3); null for any other number. */
export function slotLevelOf(stat: AdjustableStat): number | null {
  const index = SLOT_STATS.indexOf(stat as SlotStat);
  return index < 0 ? null : index + 1;
}

/**
 * The numbers that can carry adjustment lines: Armor Class, and the slot
 * maximum of each spell level. A new entry here plus a definition in
 * `utils/stat-breakdown.ts` is all another number needs (the stored JSON is
 * keyed by this name, so no schema change).
 */
export type AdjustableStat = 'ac' | SlotStat;

/** The stored shape: `{ "ac": [{ "value": 1, "label": "Taunka" }] }`. */
export type StatAdjustments = Partial<Record<AdjustableStat, StatAdjustment[]>>;

/** Limits the server enforces too (see StatAdjustmentRules in the backend). */
export const ADJUSTMENT_LABEL_MAX = 40;
export const ADJUSTMENT_VALUE_MAX = 99;
export const ADJUSTMENT_LINES_MAX = 12;

type HasAdjustments = { statAdjustments?: StatAdjustments | null };

/** The adjustment lines saved for one number; empty when there are none. */
export function adjustmentsFor(pc: HasAdjustments, stat: AdjustableStat): StatAdjustment[] {
  return pc.statAdjustments?.[stat] ?? [];
}

/** What a set of adjustment lines adds up to. */
export function adjustmentSum(lines: StatAdjustment[]): number {
  return lines.reduce((sum, line) => sum + line.value, 0);
}

/** "+1", "-2", "+0" — how an adjustment amount is shown and logged. */
export function signed(value: number): string {
  return value < 0 ? `-${Math.abs(value)}` : `+${value}`;
}
