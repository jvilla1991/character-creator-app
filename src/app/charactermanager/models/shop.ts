/**
 * Shopping feature types — the client mirror of the backend ShopView /
 * ShopItemView / PurchaseResult DTOs. Prices arrive in copper (`costCp`); use
 * {@link costToCoins} / {@link formatCp} to render gp/sp/cp.
 */

import { PcItem } from './pc';

export type ShopCategory = 'WEAPON' | 'ARMOR' | 'MATERIAL_COMPONENT' | 'GEAR';

/**
 * One entry from the raw SRD catalog browse (`GET /api/v1/catalog`), used by the
 * DM-grant equipment picker. Unlike {@link ShopItem} it carries the effective
 * `bulk` rating the backend stamps at purchase, so a granted line can be
 * denormalized client-side without re-deriving weight bands. `category` is the
 * raw backend enum (e.g. 'WEAPON'); map it with {@link categoryLabelFor}.
 */
export interface CatalogItem {
  itemKey: string;
  name: string;
  category: string;
  costCp: number;
  weight?: number | null;
  bulk: number;
  details: { [key: string]: any };
}

/** Map a backend catalog category ('WEAPON') to the lowercase inventory label
 *  ('weapon'). Mirrors the backend ShopService#categoryLabel mapping — the
 *  single client-side source of truth (inventory panel and grant picker share it). */
export function categoryLabelFor(backendCategory: string): PcItem['category'] {
  switch (backendCategory) {
    case 'WEAPON': return 'weapon';
    case 'ARMOR': return 'armor';
    case 'MATERIAL_COMPONENT': return 'material-component';
    default: return backendCategory.toLowerCase() as PcItem['category'];
  }
}

export interface ShopItem {
  itemKey: string;
  name: string;
  category: string;
  costCp: number;
  weight?: number | null;
  details: { [key: string]: any };
  stock: number | null; // null = unlimited (standard shops, Phase 1)
}

export interface ShopView {
  shopId: number;
  sessionId: number;
  category: string | null;        // null for a curated shop (spans categories)
  settlement: string | null;
  attendeePcIds: number[];
  items: ShopItem[];
  curatedShopId?: number | null;  // set when a curated shop is active
  shopName?: string | null;       // the curated shop's name (null for standard)
}

export interface PurchaseResult {
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  inventory: PcItem[];
  totalCostCp: number;
}

export interface SellResult {
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  inventory: PcItem[];
  totalGainCp: number;
}

/** Break a copper price into whole gp/sp/cp (no electrum), matching the purse rates. */
export function costToCoins(costCp: number): { gp: number; sp: number; cp: number } {
  let rem = Math.max(0, Math.floor(costCp));
  const gp = Math.floor(rem / 100); rem %= 100;
  const sp = Math.floor(rem / 10); rem %= 10;
  return { gp, sp, cp: rem };
}

/** Compact price label, e.g. 1500 → "15 gp", 110 → "1 gp 1 sp", 5 → "5 cp". */
export function formatCp(costCp: number): string {
  const { gp, sp, cp } = costToCoins(costCp);
  const parts: string[] = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (cp) parts.push(`${cp} cp`);
  return parts.length ? parts.join(' ') : '0 cp';
}
