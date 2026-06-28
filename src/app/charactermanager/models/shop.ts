/**
 * Shopping feature types — the client mirror of the backend ShopView /
 * ShopItemView / PurchaseResult DTOs. Prices arrive in copper (`costCp`); use
 * {@link costToCoins} / {@link formatCp} to render gp/sp/cp.
 */

import { PcItem } from './pc';

export type ShopCategory = 'WEAPON' | 'ARMOR' | 'MATERIAL_COMPONENT';

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
  category: string;
  settlement: string | null;
  attendeePcIds: number[];
  items: ShopItem[];
}

export interface PurchaseResult {
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number };
  inventory: PcItem[];
  totalCostCp: number;
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
