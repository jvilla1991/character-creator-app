/**
 * DM-curated encounter types — client mirror of the backend EncounterView /
 * EncounterCreatureView / EncounterSummaryView DTOs. An encounter is a reusable,
 * named list of enemy creatures a DM builds on the campaign screen and loads into
 * a live session, where each creature becomes an enemy combatant.
 */

export interface EncounterSummary {
  id: number;
  campaignId: number;
  name: string;
  notes: string | null;
  creatureCount: number;
}

export interface EncounterCreature {
  id: number;
  name: string;
  dexModifier: number;      // DM-calculated initiative tie-breaker
  hpMax: number | null;     // null = untracked HP
  quantity: number;         // expands into that many numbered combatants on load
}

/** One prepped loot line — a catalog item or a custom free-hand item. */
export interface EncounterLootItem {
  id: number;
  catalogItemKey: string | null; // null for custom items
  name: string;                  // resolved: catalog name or custom name
  custom: boolean;
  customNotes: string | null;
  qty: number;
}

export interface Encounter {
  id: number;
  campaignId: number;
  name: string;
  notes: string | null;
  creatures: EncounterCreature[];
  lootCoinCp: number;            // prepped coin pile, in copper
  lootItems: EncounterLootItem[];
}
