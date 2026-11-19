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
 * The numbers that can carry adjustment lines. Armor Class is the only one with
 * a breakdown today; a new entry here plus a definition in
 * `utils/stat-breakdown.ts` is all another number needs (the stored JSON is
 * keyed by this name, so no schema change).
 */
export type AdjustableStat = 'ac';

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
