import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CuratedShop, ShopImportPayload, ShopSummary } from '../models/curated-shop';

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

  addItem(shopId: number, catalogItemKey: string, priceCp: number | null): Observable<CuratedShop> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedShop>(`${this.base}/shops/${shopId}/items`, { catalogItemKey, priceCp });
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
