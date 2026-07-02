import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PurchaseResult, SellResult, ShopView } from '../models/shop';

/**
 * Shop client for Session Mode. Real mode talks to character-manager-service;
 * the DM activates/targets/closes a shop and players browse and buy. Discovery
 * of an open shop happens through the session poll (the `shopForMe` flag on
 * SessionState); this service fetches the catalog and runs purchases.
 *
 * Demo mode has no multi-client shop yet (it needs in-memory coin/inventory
 * mutation) — getShop returns null so the UI degrades gracefully, and write
 * operations are rejected. Demo shopping is a later increment.
 */
@Injectable({ providedIn: 'root' })
export class ShopService {

  private readonly base = `${environment.characterApiUrl}/api/v1/session`;

  constructor(private http: HttpClient) {}

  /** DM activates a standard catalog shop (replaces any open one) and targets characters. */
  openShop(sessionId: number | string, category: string, settlement: string,
           pcIds: number[]): Observable<ShopView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<ShopView>(`${this.base}/${sessionId}/shop`,
      { category, settlement, pcIds });
  }

  /** DM activates a pre-built curated shop (replaces any open one) and targets characters. */
  openCuratedShop(sessionId: number | string, curatedShopId: number, settlement: string,
                  pcIds: number[]): Observable<ShopView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<ShopView>(`${this.base}/${sessionId}/shop`,
      { curatedShopId, settlement, pcIds });
  }

  /** DM re-targets the characters at the active shop. */
  setAttendees(sessionId: number | string, pcIds: number[]): Observable<ShopView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<ShopView>(`${this.base}/${sessionId}/shop/attendees`, { pcIds });
  }

  /** DM closes the shop; attendance is cleared. */
  closeShop(sessionId: number | string): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/${sessionId}/shop`);
  }

  /** Browse the active shop — null when there's none for this caller. */
  getShop(sessionId: number | string): Observable<ShopView | null> {
    if (environment.demoMode) return of(null);
    // 204 → empty body → null.
    return this.http.get<ShopView>(`${this.base}/${sessionId}/shop`).pipe();
  }

  /** Buy an item for one of the player's characters at the shop. */
  purchase(sessionId: number | string, pcId: number, itemKey: string,
           qty: number): Observable<PurchaseResult> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<PurchaseResult>(`${this.base}/${sessionId}/shop/purchase`,
      { pcId, itemKey, qty });
  }

  /** Sell the entire stack at inventory position `index` back to the shop. */
  sell(sessionId: number | string, pcId: number, index: number): Observable<SellResult> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<SellResult>(`${this.base}/${sessionId}/shop/sell`, { pcId, index });
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Shopping is not available in demo mode'));
  }
}
