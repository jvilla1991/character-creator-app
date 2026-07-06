import { PC, PcItem } from '../models/pc';
import { modFromScore } from './character-math';
import { isSupplyItem } from './survival';

// ── Darker Dungeons "Active Inventory" (ch. 10) ─────────────────────────────
// Pure slot/bulk math for campaigns with the slotInventory variant rule.
// Bulk is stamped on items server-side (catalog rating at purchase, or the
// join-time conversion); these helpers only read and total it.

/**
 * DD weight bands for items without a stamped bulk: negligible → 0.2,
 * ≤2 lb → 1, ≤5 lb → 2, ≤10 lb → 3, ≤35 lb → 6, heavier → 9. Unknown → 1.
 */
export function bulkFromWeight(weight?: number): number {
  if (weight == null) return 1;
  if (weight <= 0) return 0.2;
  if (weight <= 2) return 1;
  if (weight <= 5) return 2;
  if (weight <= 10) return 3;
  if (weight <= 35) return 6;
  return 9;
}

/** An item's bulk: the stamped rating, else the weight-band fallback. */
export function itemBulk(item: PcItem): number {
  return item.bulk ?? bulkFromWeight(item.weight);
}

/**
 * Slots filled: Σ bulk × qty over owned (non-dropped) lines, to 1 decimal.
 * Travel supplies (rations/water) are tracked as charges elsewhere and never
 * count toward bulk.
 */
export function usedSlots(items: PcItem[] | undefined): number {
  const total = (items ?? [])
    .filter(i => i.status !== 'dropped' && !isSupplyItem(i))
    .reduce((sum, i) => sum + itemBulk(i) * (i.qty || 1), 0);
  return Math.round(total * 10) / 10; // kill 0.2 float drift
}

/**
 * Inventory capacity = size-based slots + STR modifier (DD p. 55):
 * Small species 14 + STR, Medium 18 + STR; goliaths count as Large-framed
 * via Powerful Build (22 + 2×STR). Unknown species default to Medium.
 */
export function slotCapacity(pc: PC): number {
  const str = modFromScore(pc.stats?.STR ?? 10);
  const species = (pc.race ?? '').toLowerCase();
  if (species.includes('goliath')) return 22 + 2 * str;
  if (species.includes('halfling') || species.includes('gnome')) return 14 + str;
  return 18 + str;
}

export function isEncumbered(pc: PC): boolean {
  return usedSlots(pc.inventory) > slotCapacity(pc);
}

export const ENCUMBERED_PENALTY =
  'Speed halved · disadvantage on STR/DEX/CON checks, attack rolls & saving throws';

// ── Demo-mode conversion ────────────────────────────────────────────────────
// Mirror of the server-side SlotInventoryConversionService for demo mode,
// which has no catalog: legacy weapons/gear become ad-hoc inventory lines and
// bulk falls back to weight bands / 1. Idempotent — legacy arrays empty and
// existing bulk untouched on a second run.

export function convertPcToSlotInventory(pc: PC): PC {
  const inventory: PcItem[] = (pc.inventory ?? []).map(i => ({ ...i }));

  for (const weapon of pc.weapons ?? []) {
    inventory.push({
      name: weapon.name,
      category: 'weapon',
      qty: 1,
      ...(weapon.dmg ? { damage: weapon.dmg } : {}),
      ...legacyNotes(weapon),
    });
  }
  for (const gear of pc.gear ?? []) {
    inventory.push({
      name: gear.name,
      category: 'gear',
      qty: 1,
      ...(gear.equipped ? { equipped: true } : {}),
      ...legacyNotes(gear),
    });
  }
  for (const line of inventory) {
    if (typeof line.bulk !== 'number') line.bulk = itemBulk(line);
  }

  return { ...pc, inventory, weapons: [], gear: [] };
}

function legacyNotes(legacy: { magic?: boolean; notes?: string }): { notes?: string } {
  const base = (legacy.notes ?? '').trim();
  const notes = legacy.magic ? (base ? `magic · ${base}` : 'magic') : base;
  return notes ? { notes } : {};
}
