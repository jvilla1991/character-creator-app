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
