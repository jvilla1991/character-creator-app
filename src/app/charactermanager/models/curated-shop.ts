/**
 * DM-curated shop types — client mirror of the backend CuratedShopView /
 * CuratedShopItemView / ShopSummaryView DTOs. Prices are in copper; reuse
 * formatCp/costToCoins from shop.ts to render.
 */
import { ShopCategory } from './shop';

export { ShopCategory };

export interface ShopSummary {
  id: number;
  campaignId: number;
  name: string;
  settlement: string | null;
  itemCount: number;
}

export interface CuratedShopItem {
  id: number;
  catalogItemKey: string;
  name: string;
  category: string;
  priceOverrideCp: number | null; // null = inherit catalog price
  effectiveCostCp: number;        // what buyers pay
  weight?: number | null;
  details: { [key: string]: any };
}

export interface CuratedShop {
  id: number;
  campaignId: number;
  name: string;
  settlement: string | null;
  items: CuratedShopItem[];
}

/**
 * A whole shop as pasted/shared JSON. Every key must exist in the SRD catalog
 * (the server rejects unknown keys, naming them); priceGp is an optional
 * override in gold (fractions allowed), absent = inherit the catalog price.
 */
export interface ShopImportPayload {
  name: string;
  settlement?: string | null;
  items: Array<{ key: string; priceGp?: number | null }>;
}

/** Serialize an existing shop into the import format (share/author by example). */
export function toImportPayload(shop: CuratedShop): ShopImportPayload {
  return {
    name: shop.name,
    settlement: shop.settlement,
    items: shop.items.map(i => ({
      key: i.catalogItemKey,
      ...(i.priceOverrideCp != null ? { priceGp: i.priceOverrideCp / 100 } : {}),
    })),
  };
}

/**
 * Parse + shape-check pasted import JSON before it goes anywhere. Returns the
 * payload or a human-readable error (catalog keys are validated server-side).
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
    if (!item || typeof item.key !== 'string' || !item.key.trim()) {
      return { error: 'Every item needs a "key" (an SRD catalog slug like "longsword").' };
    }
    if (item.priceGp != null && (typeof item.priceGp !== 'number' || item.priceGp < 0)) {
      return { error: `"${item.key}": priceGp must be a non-negative number when present.` };
    }
  }
  return {
    payload: {
      name: obj.name.trim(),
      settlement: typeof obj.settlement === 'string' ? obj.settlement.trim() : null,
      items: obj.items.map(i => ({ key: i.key.trim(), priceGp: i.priceGp ?? null })),
    },
  };
}
