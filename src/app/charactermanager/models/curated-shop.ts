/**
 * DM-curated shop types — client mirror of the backend CuratedShopView /
 * CuratedShopItemView / ShopSummaryView DTOs. Prices are in copper; reuse
 * formatCp/costToCoins from shop.ts to render.
 */
import { PcItem } from './pc';
import { ShopCategory, categoryLabelFor } from './shop';
import { lootImportItemProblem } from './loot';

export { ShopCategory };

export interface ShopSummary {
  id: number;
  campaignId: number;
  name: string;
  settlement: string | null;
  itemCount: number;
}

/**
 * One line of a curated shop: a catalog item with an optional price override,
 * or a custom item the DM wrote out (`custom` true, no `catalogItemKey`). A
 * custom line's two prices are its one price; its damage / armor class /
 * description sit in `details` the way a catalog entry's do, and `category` is
 * the catalog-style code ('WEAPON', 'TREASURE', …).
 */
export interface CuratedShopItem {
  id: number;
  catalogItemKey: string | null;  // null for a custom item
  name: string;
  category: string;
  priceOverrideCp: number | null; // catalog line: null = inherit catalog price; custom line: the price
  effectiveCostCp: number;        // what buyers pay
  weight?: number | null;
  details: { [key: string]: unknown };
  custom?: boolean;
  notes?: string | null;          // a custom item's description
  bulk?: number | null;           // a custom item's explicit bulk; null = worked out from the weight
}

export interface CuratedShop {
  id: number;
  campaignId: number;
  name: string;
  settlement: string | null;
  items: CuratedShopItem[];
}

/**
 * One pasted shop line. Either a catalog reference ("key", an SRD slug, with an
 * optional "priceGp" override in gold — absent = the catalog price), or a
 * custom item ("name", a required "priceGp", and its own stats: "category",
 * "weight", "bulk", "damage" for weapons, "armorClass" for armor, "notes").
 */
export interface ShopImportItem {
  key?: string | null;
  priceGp?: number | null;
  name?: string | null;
  notes?: string | null;
  category?: PcItem['category'] | null;
  weight?: number | null;
  bulk?: number | null;
  damage?: string | null;
  armorClass?: string | null;
}

/**
 * A whole shop as pasted/shared JSON. Every catalog key must exist in the SRD
 * catalog (the server rejects unknown keys, naming them); custom lines carry
 * everything about the item themselves.
 */
export interface ShopImportPayload {
  name: string;
  settlement?: string | null;
  items: ShopImportItem[];
}

function detailText(item: CuratedShopItem, key: string): string | null {
  const value = item.details?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Serialize an existing shop into the import format (share/author by example). */
export function toImportPayload(shop: CuratedShop): ShopImportPayload {
  return {
    name: shop.name,
    settlement: shop.settlement,
    items: shop.items.map((i): ShopImportItem => {
      if (!i.custom) {
        return {
          key: i.catalogItemKey,
          ...(i.priceOverrideCp != null ? { priceGp: i.priceOverrideCp / 100 } : {}),
        };
      }
      const damage = detailText(i, 'damage');
      const armorClass = detailText(i, 'armorClass');
      const notes = i.notes?.trim() || detailText(i, 'notes');
      return {
        name: i.name,
        category: categoryLabelFor(i.category),
        priceGp: i.effectiveCostCp / 100,
        ...(i.weight != null ? { weight: i.weight } : {}),
        ...(i.bulk != null ? { bulk: i.bulk } : {}),
        ...(damage ? { damage } : {}),
        ...(armorClass ? { armorClass } : {}),
        ...(notes ? { notes } : {}),
      };
    }),
  };
}

/**
 * Parse + shape-check pasted import JSON before it goes anywhere. Returns the
 * payload or a human-readable error (catalog keys are validated server-side).
 * A custom line's stats follow the same rules as a custom loot line's.
 */
export function parseImportPayload(raw: string): { payload?: ShopImportPayload; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'Not valid JSON — check for missing quotes, commas, or braces.' };
  }
  const obj = parsed as Partial<ShopImportPayload>;
  if (!obj || typeof obj !== 'object' || typeof obj.name !== 'string' || !obj.name.trim()) {
    return { error: 'The shop needs a "name" string.' };
  }
  if (!Array.isArray(obj.items)) {
    return { error: 'The shop needs an "items" array (it may be empty).' };
  }
  for (const item of obj.items) {
    const hasKey = !!item && typeof item.key === 'string' && !!item.key.trim();
    const hasName = !!item && typeof item.name === 'string' && !!item.name.trim();
    if (hasKey === hasName) {
      return { error: 'Every item needs either a "key" (an SRD catalog slug like "longsword") or a "name" (a custom item) — not both.' };
    }
    const label = (item.key || item.name || '').trim();
    if (item.priceGp != null && (typeof item.priceGp !== 'number' || item.priceGp < 0)) {
      return { error: `"${label}": priceGp must be a non-negative number when present.` };
    }
    if (hasName && item.priceGp == null) {
      return { error: `"${label}": a custom item needs a priceGp — it has no catalog price.` };
    }
    if (hasKey && item.notes != null) {
      return { error: `"${label}": notes apply to custom items only — catalog items take theirs from the catalog.` };
    }
    // The stat rules are the loot line's: one definition of a custom item.
    const problem = lootImportItemProblem({
      key: hasKey ? item.key : null, name: hasName ? item.name : null, notes: item.notes,
      category: item.category, weight: item.weight, bulk: item.bulk,
      damage: item.damage, armorClass: item.armorClass,
    });
    if (problem) return { error: `"${label}": ${problem}` };
  }
  return {
    payload: {
      name: obj.name.trim(),
      settlement: typeof obj.settlement === 'string' ? obj.settlement.trim() : null,
      items: obj.items.map((i): ShopImportItem => {
        if (typeof i.key === 'string' && i.key.trim()) {
          return { key: i.key.trim(), priceGp: i.priceGp ?? null };
        }
        return {
          name: (i.name ?? '').trim(),
          priceGp: i.priceGp ?? null,
          ...(i.category != null ? { category: i.category } : {}),
          ...(i.weight != null ? { weight: i.weight } : {}),
          ...(i.bulk != null ? { bulk: i.bulk } : {}),
          ...(typeof i.damage === 'string' && i.damage.trim() ? { damage: i.damage.trim() } : {}),
          ...(typeof i.armorClass === 'string' && i.armorClass.trim() ? { armorClass: i.armorClass.trim() } : {}),
          ...(typeof i.notes === 'string' && i.notes.trim() ? { notes: i.notes.trim() } : {}),
        };
      }),
    },
  };
}
