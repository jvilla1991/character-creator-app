import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CuratedShop, ShopImportPayload, ShopSummary } from '../models/curated-shop';
import { AuthoredItem } from '../components/item-composer/authored-item';

/**
 * DM-curated shop management client (Phase 2). Talks to the campaign-scoped
 * curated-shop API; the DM builds reusable shops out of session, then activates
 * them in Session Mode. Demo mode has no backend, so reads return empty and
 * writes are rejected.
 */
@Injectable({ providedIn: 'root' })
export class CuratedShopService {

  private readonly base = `${environment.characterApiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  list(campaignId: number | string): Observable<ShopSummary[]> {
    if (environment.demoMode) return of([]);
    return this.http.get<ShopSummary[]>(`${this.base}/campaign/${campaignId}/shops`);
  }

  create(campaignId: number | string, name: string, settlement: string): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedShop>(`${this.base}/campaign/${campaignId}/shops`, { name, settlement });
  }

  get(shopId: number): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.get<CuratedShop>(`${this.base}/shops/${shopId}`);
  }

  update(shopId: number, name: string, settlement: string): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<CuratedShop>(`${this.base}/shops/${shopId}`, { name, settlement });
  }

  delete(shopId: number): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/shops/${shopId}`);
  }

  /**
   * Add one line authored in the shared item composer: a catalog item (sold
   * at the catalog price until the DM overrides it) or a custom item with its
   * own stats, whose composer "value" is the shop's price.
   */
  addItem(shopId: number, item: AuthoredItem): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedShop>(`${this.base}/shops/${shopId}/items`, toAddShopItemRequest(item));
  }

  updateItem(shopId: number, itemId: number, priceCp: number | null): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<CuratedShop>(`${this.base}/shops/${shopId}/items/${itemId}`, { priceCp });
  }

  removeItem(shopId: number, itemId: number): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.delete<CuratedShop>(`${this.base}/shops/${shopId}/items/${itemId}`);
  }

  importCategory(shopId: number, category: string): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedShop>(
      `${this.base}/shops/${shopId}/import?category=${encodeURIComponent(category)}`, {});
  }

  /**
   * Create a whole shop from pasted JSON — all-or-nothing server-side: any
   * unknown catalog key rejects the import with a 400 naming the offenders.
   */
  importShop(campaignId: number | string, payload: ShopImportPayload): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedShop>(`${this.base}/campaign/${campaignId}/shops/import`, payload);
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Curated shops are not available in demo mode'));
  }
}

/**
 * Map the composer's AuthoredItem onto the backend AddShopItemRequest wire
 * shape. A shop has no quantity, so the composer's qty is not sent; a custom
 * item's value in gold becomes its price in copper.
 */
export function toAddShopItemRequest(item: AuthoredItem): {
  catalogItemKey?: string;
  priceCp: number | null;
  customName?: string;
  customNotes?: string;
  category?: string;
  weight?: number;
  bulk?: number;
  damage?: string;
  armorClass?: string;
} {
  if (item.kind === 'catalog') {
    return { catalogItemKey: item.item.itemKey, priceCp: null };
  }
  return {
    customName: item.name,
    priceCp: item.valueGp != null ? Math.round(item.valueGp * 100) : null,
    category: item.category,
    ...(item.notes ? { customNotes: item.notes } : {}),
    ...(item.weight != null ? { weight: item.weight } : {}),
    ...(item.bulk != null ? { bulk: item.bulk } : {}),
    ...(item.damage ? { damage: item.damage } : {}),
    ...(item.armorClass ? { armorClass: item.armorClass } : {}),
  };
}
