/**
 * The neutral payload the shared ItemComposerComponent emits — one shape for
 * every "a DM authors an item" surface (inventory grant, curated loot lists,
 * the live session pool). A catalog pick carries the full CatalogItem so hosts
 * can denormalize through pcItemFromCatalog without a second lookup; a custom
 * item carries the same optional attributes a DM grant stamps.
 */

import { PcItem } from '../../models/pc';
import { CatalogItem, pcItemFromCatalog } from '../../models/shop';
import { bulkFromWeight } from '../../utils/slot-inventory';

export type AuthoredItem =
  | { kind: 'catalog'; item: CatalogItem; qty: number }
  | {
      kind: 'custom';
      name: string;
      category: PcItem['category'];
      qty: number;
      valueGp?: number;
      weight?: number;
      damage?: string;      // weapons only
      armorClass?: string;  // armor only
      notes?: string;
    };

/**
 * Denormalize an authored item into an owned inventory line — the client twin
 * of the backend's InventoryEntries (catalog snapshot via pcItemFromCatalog;
 * custom lines get value → unitCostCp, weight, the category stat, notes, and a
 * bulk stamped from the canonical weight bands so the line never drifts).
 */
export function pcItemFromAuthored(authored: AuthoredItem): PcItem {
  if (authored.kind === 'catalog') {
    return pcItemFromCatalog(authored.item, authored.qty);
  }
  const entry: PcItem = {
    name: authored.name,
    category: authored.category,
    qty: authored.qty,
  };
  if (authored.valueGp != null && authored.valueGp >= 0) {
    entry.unitCostCp = Math.round(authored.valueGp * 100);
  }
  if (authored.weight != null && authored.weight >= 0) {
    entry.weight = authored.weight;
  }
  entry.bulk = bulkFromWeight(entry.weight);
  if (authored.category === 'weapon' && authored.damage) entry.damage = authored.damage;
  if (authored.category === 'armor' && authored.armorClass) entry.armorClass = authored.armorClass;
  if (authored.notes) entry.notes = authored.notes;
  return entry;
}
