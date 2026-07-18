/**
 * DM-curated encounter types — client mirror of the backend EncounterView /
 * EncounterCreatureView / EncounterSummaryView DTOs. An encounter is a reusable,
 * named list of enemy creatures a DM builds on the campaign screen and loads into
 * a live session, where each creature becomes an enemy combatant. Prepped loot is
 * no longer attached here — it lives on standalone curated loot lists (see
 * models/curated-loot.ts).
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
  armorClass: number | null; // AC at a glance in the tracker; null = unknown
  hpMax: number | null;      // null = untracked HP
  quantity: number;          // expands into that many numbered combatants on load
}

export interface Encounter {
  id: number;
  campaignId: number;
  name: string;
  notes: string | null;
  creatures: EncounterCreature[];
}
