/**
 * DM-curated loot list types — client mirror of the backend CuratedLootView /
 * CuratedLootItemView / CuratedLootSummaryView DTOs. A loot list is a
 * standalone, reusable set of prepped spoils (item lines plus a coin pile in
 * copper) a DM builds on the campaign dashboard and drops into a live
 * session's claim pool (copy semantics — the list survives being dropped any
 * number of times). Decoupled from encounters, mirroring curated shops.
 */

import { PcItem } from './pc';

export interface CuratedLootSummary {
  id: number;
  campaignId: number;
  name: string;
  notes: string | null;
  coinCp: number;                // prepped coin pile, in copper
  itemCount: number;
}

/**
 * One prepped line — a catalog item or a custom free-hand item. The attribute
 * fields are set on custom lines only (catalog lines take their stats from the
 * catalog at claim time) and mirror what a DM grant stamps on an inventory
 * entry, so a claimed custom item lands fully stat'd.
 */
export interface CuratedLootItem {
  id: number;
  catalogItemKey: string | null; // null for custom items
  name: string;                  // resolved: catalog name or custom name
  custom: boolean;
  customNotes: string | null;
  category?: PcItem['category'] | null;
  unitCostCp?: number | null;    // value in copper
  weight?: number | null;        // pounds
  damage?: string | null;        // custom weapons
  armorClass?: string | null;    // custom armor
  qty: number;
}

export interface CuratedLoot {
  id: number;
  campaignId: number;
  name: string;
  notes: string | null;
  coinCp: number;                // prepped coin pile, in copper
  items: CuratedLootItem[];
}
