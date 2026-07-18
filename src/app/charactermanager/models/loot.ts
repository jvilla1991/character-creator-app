/**
 * Post-combat loot types — client mirror of the backend LootView / LootItemView /
 * ClaimResult DTOs, plus the paste-JSON import payload for curated loot lists.
 * Coin amounts are in copper; reuse formatCp from shop.ts to render.
 */

import { CuratedLoot } from './curated-loot';
import { PcItem } from './pc';

/** The lowercase inventory categories a custom loot item may carry. */
export const LOOT_ITEM_CATEGORIES: ReadonlyArray<PcItem['category']> =
  ['weapon', 'armor', 'material-component', 'gear'];

export interface LootItem {
  id: number;
  catalogItemKey: string | null; // null for custom (free-hand) items
  name: string;                  // resolved: catalog name or custom name
  custom: boolean;
  customNotes: string | null;
  // Custom-item attributes copied from the curated line (absent/null on
  // catalog lines and on legacy pool rows created before the columns existed).
  category?: PcItem['category'] | null;
  unitCostCp?: number | null;
  weight?: number | null;
  damage?: string | null;
  armorClass?: string | null;
  qty: number;
  qtyRemaining: number;          // what's left to claim (first-come-first-served)
}

export interface LootView {
  id: number;
  sessionId: number;
  name: string | null;           // drop label, e.g. the seeding loot list's name
  dropped: boolean;              // false = DM draft, true = players may claim
  coinCpTotal: number;
  coinCpRemaining: number;
  items: LootItem[];
}

/** Outcome of a claim: the character's new purse + inventory, and the refreshed pool. */
export interface ClaimResult {
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  inventory: PcItem[];
  loot: LootView;
}

/**
 * A curated loot list as pasted/shared JSON. Each line is either a catalog
 * reference ("key", an SRD slug) or a custom free-hand item ("name" + optional
 * "notes") — exactly one of the two; qty defaults to 1. Custom items may also
 * carry the attributes a DM grant stamps: "category" (weapon | armor |
 * material-component | gear), "valueGp" (≥ 0, fractions ok), "weight" (≥ 0,
 * pounds), "damage" (weapons) and "armorClass" (armor). Legacy payloads
 * (key/name/notes/qty + coinGp only) stay valid. coinGp adds to the list's
 * coin pile. Import APPENDS to the existing loot.
 */
export interface LootImportPayload {
  coinGp?: number | null;
  items: Array<{
    key?: string | null;
    name?: string | null;
    notes?: string | null;
    qty?: number | null;
    category?: PcItem['category'] | null;
    valueGp?: number | null;
    weight?: number | null;
    damage?: string | null;
    armorClass?: string | null;
  }>;
}

/** Serialize a curated loot list into the import format (share/author by example). */
export function toLootImportPayload(loot: CuratedLoot): LootImportPayload {
  return {
    ...(loot.coinCp > 0 ? { coinGp: loot.coinCp / 100 } : {}),
    items: loot.items.map(i => ({
      ...(i.custom
        ? {
            name: i.name,
            ...(i.customNotes ? { notes: i.customNotes } : {}),
            ...(i.category ? { category: i.category } : {}),
            ...(i.unitCostCp != null ? { valueGp: i.unitCostCp / 100 } : {}),
            ...(i.weight != null ? { weight: i.weight } : {}),
            ...(i.damage ? { damage: i.damage } : {}),
            ...(i.armorClass ? { armorClass: i.armorClass } : {}),
          }
        : { key: i.catalogItemKey }),
      ...(i.qty !== 1 ? { qty: i.qty } : {}),
    })),
  };
}

/**
 * Parse + shape-check pasted loot JSON before it goes anywhere. Returns the
 * payload or a human-readable error (catalog keys are validated server-side,
 * which rejects the whole import naming any unknown ones). The attribute
 * fields are custom-item-only and validated to match the backend's rules, so
 * a doomed import never gets sent.
 */
export function parseLootImportPayload(raw: string): { payload?: LootImportPayload; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Not valid JSON — check for missing quotes, commas, or braces.' };
  }
  const obj = parsed as Partial<LootImportPayload>;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) {
    return { error: 'The loot needs an "items" array (it may be empty).' };
  }
  if (obj.coinGp != null && (typeof obj.coinGp !== 'number' || obj.coinGp < 0)) {
    return { error: '"coinGp" must be a non-negative number when present.' };
  }
  for (const item of obj.items) {
    const hasKey = !!item && typeof item.key === 'string' && !!item.key.trim();
    const hasName = !!item && typeof item.name === 'string' && !!item.name.trim();
    if (hasKey === hasName) {
      return { error: 'Every item needs either a "key" (an SRD slug like "longsword") or a "name" (a custom item) — not both.' };
    }
    const label = (item.key || item.name || '').trim();
    if (item.qty != null && (typeof item.qty !== 'number' || item.qty < 1)) {
      return { error: `"${label}": qty must be a positive number when present.` };
    }
    if (item.notes != null && typeof item.notes !== 'string') {
      return { error: `"${label}": notes must be a string when present.` };
    }
    const hasAttributes = item.category != null || item.valueGp != null
      || item.weight != null || item.damage != null || item.armorClass != null;
    if (hasKey && hasAttributes) {
      return { error: `"${label}": category/valueGp/weight/damage/armorClass apply to custom items only — catalog items take their stats from the catalog.` };
    }
    if (item.category != null
        && !(LOOT_ITEM_CATEGORIES as readonly string[]).includes(item.category)) {
      return { error: `"${label}": category must be one of weapon, armor, material-component, gear.` };
    }
    if (item.valueGp != null && (typeof item.valueGp !== 'number' || item.valueGp < 0)) {
      return { error: `"${label}": valueGp must be a non-negative number when present.` };
    }
    if (item.weight != null && (typeof item.weight !== 'number' || item.weight < 0)) {
      return { error: `"${label}": weight must be a non-negative number when present.` };
    }
    if (item.damage != null && typeof item.damage !== 'string') {
      return { error: `"${label}": damage must be a string when present.` };
    }
    if (item.armorClass != null && typeof item.armorClass !== 'string') {
      return { error: `"${label}": armorClass must be a string when present.` };
    }
    // The category stat belongs to its category (no category defaults to gear).
    const effectiveCategory = item.category ?? 'gear';
    if (item.damage != null && item.damage.trim() && effectiveCategory !== 'weapon') {
      return { error: `"${label}": damage applies to weapon items only — set "category": "weapon".` };
    }
    if (item.armorClass != null && item.armorClass.trim() && effectiveCategory !== 'armor') {
      return { error: `"${label}": armorClass applies to armor items only — set "category": "armor".` };
    }
  }
  return {
    payload: {
      coinGp: obj.coinGp ?? null,
      items: obj.items.map(i => ({
        key: typeof i.key === 'string' && i.key.trim() ? i.key.trim() : null,
        name: typeof i.name === 'string' && i.name.trim() ? i.name.trim() : null,
        notes: typeof i.notes === 'string' && i.notes.trim() ? i.notes.trim() : null,
        qty: i.qty ?? null,
        // The attribute fields ride only when present, so a legacy payload
        // normalizes to exactly the legacy shape.
        ...(i.category != null ? { category: i.category } : {}),
        ...(i.valueGp != null ? { valueGp: i.valueGp } : {}),
        ...(i.weight != null ? { weight: i.weight } : {}),
        ...(typeof i.damage === 'string' && i.damage.trim() ? { damage: i.damage.trim() } : {}),
        ...(typeof i.armorClass === 'string' && i.armorClass.trim() ? { armorClass: i.armorClass.trim() } : {}),
      })),
    },
  };
}
