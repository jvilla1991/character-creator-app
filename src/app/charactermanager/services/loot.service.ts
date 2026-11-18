import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LootView } from '../models/loot';
import { AuthoredItem } from '../components/item-composer/authored-item';
import { toAddLootItemRequest } from './curated-loot.service';

/**
 * Post-combat loot client for Session Mode. Real mode talks to
 * character-manager-service; the DM opens a pool (optionally seeded from a
 * curated loot list), edits it as a draft, drops it, and the party splits it
 * between their characters and votes on the split. Discovery happens through
 * the session poll (the `lootStatus` flag on SessionState); this service
 * fetches the pool and runs the split and vote calls. Demo mode has no backend, so getLoot returns null and writes
 * are rejected (mirrors ShopService).
 */
@Injectable({ providedIn: 'root' })
export class LootService {

  private readonly base = `${environment.characterApiUrl}/api/v1/session`;

  constructor(private http: HttpClient) {}

  /** DM opens a loot pool as a draft (replaces any existing). lootId seeds it from a curated loot list. */
  open(sessionId: number | string, lootId: number | null, name: string | null): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot`, { lootId, name });
  }

  /** DM drops the loot — the party can now see and split it. */
  drop(sessionId: number | string): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/drop`, {});
  }

  /** DM discards the pool; anything not yet distributed is gone. */
  close(sessionId: number | string): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/${sessionId}/loot`);
  }

  /**
   * DM adds a line from the shared item composer's payload — a catalog item or
   * a custom item with the full attribute set (same wire shape the curated
   * loot editor uses, so the two flows can't drift).
   */
  addItem(sessionId: number | string, item: AuthoredItem): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/items`,
      toAddLootItemRequest(item));
  }

  /** DM edits a line (lowering qty below what was shared returns those shares to the pile). */
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

  // --- party split ---------------------------------------------------------

  /**
   * Move qty of a pool line: pile → character (fromParticipantId null),
   * character → pile (toParticipantId null) or character → character.
   */
  assign(sessionId: number | string, lootItemId: number, fromParticipantId: number | null,
         toParticipantId: number | null, qty = 1): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/split/assign`,
      { lootItemId, fromParticipantId, toParticipantId, qty });
  }

  /** Set one character's share of the coin pile, in copper (0 clears it). */
  setCoinShare(sessionId: number | string, participantId: number, coinCp: number): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<LootView>(`${this.base}/${sessionId}/loot/split/coins`, { participantId, coinCp });
  }

  /** Split the whole coin pile evenly across the seated characters. */
  splitCoinsEvenly(sessionId: number | string): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/split/coins/even`, {});
  }

  /** Lock the split (the pile must be empty) and open the party vote. */
  propose(sessionId: number | string): Observable<LootView> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView>(`${this.base}/${sessionId}/loot/split/propose`, {});
  }

  /**
   * Cast or re-cast a ballot: vote true = ✓, false = ✗ (pvp: null = deciding,
   * true = PvP, false = just object), null = take it back. Emits null when the
   * vote resolved and the pool is gone for this caller (distributed or cancelled).
   */
  vote(sessionId: number | string, vote: boolean | null, pvp: boolean | null): Observable<LootView | null> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView | null>(`${this.base}/${sessionId}/loot/split/vote`, { vote, pvp });
  }

  /** DM override: APPROVE distributes the split now; CANCEL takes the loot back as a draft. */
  override(sessionId: number | string, action: 'APPROVE' | 'CANCEL'): Observable<LootView | null> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<LootView | null>(`${this.base}/${sessionId}/loot/split/override`, { action });
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Loot is not available in demo mode'));
  }
}
