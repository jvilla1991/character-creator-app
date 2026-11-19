// ── Labelled adjustments to a calculated number ─────────────────────────────
// A DM adds lines such as "+1 | Taunka" under the lines the app works out by
// itself. They are stored on the character, keyed by the number they adjust,
// and are part of that number's saved total (so `pc.ac` already includes them).
//
// A DM can also take one of the app's own lines out of a number ("Dexterity"
// under Armor Class). Those are stored beside the lines, under a companion key
// (`acRemoved`), one entry per removed line, named by the line's label.

/** One line a DM added to a number: a signed whole amount and a short reason. */
export interface StatAdjustment {
  value: number;
  label: string;
}

/** The six ability scores, by the key they are stored and logged under. */
export const ABILITY_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export type AbilityStat = typeof ABILITY_STATS[number];

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
 * The numbers that can carry adjustment lines: Armor Class, the six ability
 * scores, and the slot maximum of each spell level. A new entry here plus a
 * definition in `utils/stat-breakdown.ts` is all another number needs (the
 * stored JSON is keyed by this name, so no schema change).
 */
export type AdjustableStat = 'ac' | AbilityStat | SlotStat;

/** Where a number's removed calculated lines are stored: `acRemoved` for `ac`. */
export type RemovedLinesKey = `${AdjustableStat}Removed`;

/**
 * The stored shape: `{ "ac": [{ "value": 1, "label": "Taunka" }] }`, plus
 * `{ "acRemoved": [{ "value": 1, "label": "Dexterity" }] }` when the DM took a
 * calculated line out. A removed entry reuses the line shape because that is
 * what the server accepts; only its label means anything.
 */
export type StatAdjustments = Partial<Record<AdjustableStat | RemovedLinesKey, StatAdjustment[]>>;

/**
 * One line of a number's breakdown that the app works out by itself ("Chain
 * Shirt 13", "Dexterity +2"). `note` says why the amount is what it is when
 * that is not obvious from the label ("capped at +2 by medium armor").
 * `removed` marks a line the DM took out: still shown, no longer counted.
 */
export interface BreakdownLine {
  label: string;
  value: number;
  note?: string;
  removed?: boolean;
}

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

// ── Removed calculated lines ────────────────────────────────────────────────

/** The amount stored on a removed entry. It means nothing; the server refuses 0. */
const REMOVED_ENTRY_VALUE = 1;

export function removedKey(stat: AdjustableStat): RemovedLinesKey {
  return `${stat}Removed`;
}

/**
 * The name a calculated line is removed under: its label as the DM saw it, cut
 * to what the server stores. A removal follows the label, so "Dexterity" stays
 * out through an armor change while a removed "Shield" covers that item only.
 */
export function removalLabel(label: string): string {
  return (label ?? '').trim().slice(0, ADJUSTMENT_LABEL_MAX).trim();
}

/**
 * The labels of the calculated lines removed from one number. Includes entries
 * whose line is not there right now (the armor came off): they are kept, since
 * the line may come back, and simply match nothing meanwhile.
 */
export function removedLabelsFor(pc: HasAdjustments, stat: AdjustableStat): string[] {
  return (pc.statAdjustments?.[removedKey(stat)] ?? [])
    .map(entry => removalLabel(entry.label))
    .filter(label => label.length > 0);
}

/** Removed labels in their stored form, ready to save under {@link removedKey}. */
export function removedEntries(labels: string[]): StatAdjustment[] {
  return labels.map(label => ({ value: REMOVED_ENTRY_VALUE, label }));
}

/**
 * Mark the lines a set of removed labels takes out. Each entry takes out one
 * line, the first with that label, so two shields of the same name need two
 * entries. Lines that stay are returned as they came.
 */
export function markRemoved(lines: BreakdownLine[], removed: string[]): BreakdownLine[] {
  const pending = removed.map(removalLabel);
  return lines.map(line => {
    const at = pending.indexOf(removalLabel(line.label));
    if (at < 0) return line;
    pending.splice(at, 1);
    return { ...line, removed: true };
  });
}

/** What a number's calculated lines add up to, leaving the removed ones out. */
export function countedSum(lines: BreakdownLine[]): number {
  return lines.reduce((sum, line) => (line.removed ? sum : sum + line.value), 0);
}

/** "+1", "-2", "+0" — how an adjustment amount is shown and logged. */
export function signed(value: number): string {
  return value < 0 ? `-${Math.abs(value)}` : `+${value}`;
}
