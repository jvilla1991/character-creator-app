import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CuratedLoot, CuratedLootSummary } from '../models/curated-loot';
import { LootImportPayload } from '../models/loot';
import { AuthoredItem } from '../components/item-composer/authored-item';

/**
 * DM-curated loot list management client. Talks to the campaign-scoped
 * curated-loot API; the DM preps reusable loot lists out of session, then drops
 * one into a live session's claim pool (the session loot endpoints handle the
 * drop). Mirrors CuratedEncounterService. Demo mode has no backend, so reads
 * return empty and writes are rejected.
 */
@Injectable({ providedIn: 'root' })
export class CuratedLootService {

  private readonly base = `${environment.characterApiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  list(campaignId: number | string): Observable<CuratedLootSummary[]> {
    if (environment.demoMode) return of([]);
    return this.http.get<CuratedLootSummary[]>(`${this.base}/campaign/${campaignId}/loot`);
  }

  create(campaignId: number | string, name: string, notes: string | null): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedLoot>(`${this.base}/campaign/${campaignId}/loot`, { name, notes });
  }

  get(lootId: number): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.get<CuratedLoot>(`${this.base}/curated-loot/${lootId}`);
  }

  update(lootId: number, name: string, notes: string | null): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<CuratedLoot>(`${this.base}/curated-loot/${lootId}`, { name, notes });
  }

  delete(lootId: number): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/curated-loot/${lootId}`);
  }

  /**
   * Add a prepped line from the shared item composer's payload — a catalog
   * item (key + qty) or a custom item carrying the full attribute set the
   * backend persists (category, valueGp, weight, damage, armorClass, notes).
   */
  addItem(lootId: number, item: AuthoredItem): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedLoot>(`${this.base}/curated-loot/${lootId}/items`,
      toAddLootItemRequest(item));
  }

  /** Update a line's qty (and, for custom lines, name/notes). */
  updateItem(lootId: number, lootItemId: number, qty: number,
             customName: string | null, customNotes: string | null): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<CuratedLoot>(`${this.base}/curated-loot/${lootId}/items/${lootItemId}`,
      { qty, customName, customNotes });
  }

  removeItem(lootId: number, lootItemId: number): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.delete<CuratedLoot>(`${this.base}/curated-loot/${lootId}/items/${lootItemId}`);
  }

  /** Set the list's prepped coin pile, in gold (fractions allowed). */
  setCoins(lootId: number, coinGp: number): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<CuratedLoot>(`${this.base}/curated-loot/${lootId}/coins`, { coinGp });
  }

  /** Bulk-add lines from pasted JSON (appends; coinGp adds to the pile). */
  importLoot(lootId: number, payload: LootImportPayload): Observable<CuratedLoot> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<CuratedLoot>(`${this.base}/curated-loot/${lootId}/import`, payload);
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Curated loot lists are not available in demo mode'));
  }
}

/**
 * Map the composer's AuthoredItem onto the backend AddLootItemRequest wire
 * shape (shared by the curated editor and the live session pool endpoints).
 * Exported so LootService reuses the exact same mapping.
 */
export function toAddLootItemRequest(item: AuthoredItem): {
  catalogItemKey: string | null;
  customName: string | null;
  customNotes: string | null;
  qty: number;
  category?: string;
  valueGp?: number;
  weight?: number;
  damage?: string;
  armorClass?: string;
} {
  if (item.kind === 'catalog') {
    return { catalogItemKey: item.item.itemKey, customName: null, customNotes: null, qty: item.qty };
  }
  return {
    catalogItemKey: null,
    customName: item.name,
    customNotes: item.notes ?? null,
    qty: item.qty,
    category: item.category,
    ...(item.valueGp != null ? { valueGp: item.valueGp } : {}),
    ...(item.weight != null ? { weight: item.weight } : {}),
    ...(item.damage ? { damage: item.damage } : {}),
    ...(item.armorClass ? { armorClass: item.armorClass } : {}),
  };
}
