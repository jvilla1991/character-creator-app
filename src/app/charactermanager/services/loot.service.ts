import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClaimResult, LootView } from '../models/loot';

/**
 * Post-combat loot client for Session Mode. Real mode talks to
 * character-manager-service; the DM opens a pool (optionally seeded from a
 * curated encounter), edits it as a draft, drops it, and players claim items
 * and coins first-come-first-served. Discovery happens through the session poll
 * (the `lootStatus` flag on SessionState); this service fetches the pool and
 * runs claims. Demo mode has no backend, so getLoot returns null and writes
 * are rejected (mirrors ShopService).
 */
@Injectable({ providedIn: 'root' })
export class LootService {

  private readonly base = `${environment.characterApiUrl}/api/v1/session`;

  constructor(private http: HttpClient) {}

  /** DM opens a loot pool as a draft (replaces any existing). encounterId seeds it from curated loot. */
  open(sessionId: number | string, encounterId: number | null, name: string | null): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot`, { encounterId, name });
  }

  /** DM drops the loot — players can now see and claim. */
  drop(sessionId: number | string): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/drop`, {});
  }

  /** DM discards the pool; unclaimed loot is gone. */
  close(sessionId: number | string): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/${sessionId}/loot`);
  }

  /** DM adds a line — a catalog item (key) or a custom item (name + notes). */
  addItem(sessionId: number | string, catalogItemKey: string | null, customName: string | null,
          customNotes: string | null, qty: number): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/items`,
      { catalogItemKey, customName, customNotes, qty });
  }

  /** DM edits a line (qty shifts the remaining count by the same delta). */
  updateItem(sessionId: number | string, itemId: number, qty: number,
             customName: string | null, customNotes: string | null): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<LootView>(`${this.base}/${sessionId}/loot/items/${itemId}`,
      { qty, customName, customNotes });
  }

  /** DM removes a line from the pool. */
  removeItem(sessionId: number | string, itemId: number): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.delete<LootView>(`${this.base}/${sessionId}/loot/items/${itemId}`);
  }

  /** DM sets the coin pile, in gold (fractions allowed). */
  setCoins(sessionId: number | string, coinGp: number): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<LootView>(`${this.base}/${sessionId}/loot/coins`, { coinGp });
  }

  /** The pool as seen by this caller — null when there's none visible (204). */
  getLoot(sessionId: number | string): Observable<LootView | null> {
    if (environment.demoMode) return of(null);
    return this.http.get<LootView>(`${this.base}/${sessionId}/loot`);
  }

  /** Claim qty of a loot line into one of the player's seated characters. */
  claimItem(sessionId: number | string, pcId: number, lootItemId: number,
            qty: number): Observable<ClaimResult> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<ClaimResult>(`${this.base}/${sessionId}/loot/claim-item`,
      { pcId, lootItemId, qty });
  }

  /** Take coins from the pile (any amount up to what remains, expressed in gp). */
  claimCoins(sessionId: number | string, pcId: number,
             coins: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }): Observable<ClaimResult> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<ClaimResult>(`${this.base}/${sessionId}/loot/claim-coins`, { pcId, coins });
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Loot is not available in demo mode'));
  }
}
