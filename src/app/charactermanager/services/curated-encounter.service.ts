import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Encounter, EncounterSummary } from '../models/encounter';
import { LootImportPayload } from '../models/loot';

/**
 * DM-curated encounter management client. Talks to the campaign-scoped
 * curated-encounter API; the DM builds reusable encounters out of session, then
 * loads them into Session Mode. Demo mode has no backend, so reads return empty
 * and writes are rejected.
 */
@Injectable({ providedIn: 'root' })
export class CuratedEncounterService {

  private readonly base = `${environment.characterApiUrl}/api/v1`;

  constructor(private http: HttpClient) {}

  list(campaignId: number | string): Observable<EncounterSummary[]> {
    // Demo has no backend; offer one canned encounter so the in-session loader is
    // still exercisable (SessionService.demoLoadEncounter spawns its creatures).
    if (environment.demoMode) {
      return of([{ id: -1, campaignId: Number(campaignId) || 0, name: 'Goblin Ambush (demo)',
        notes: 'Three goblins spring from the underbrush.', creatureCount: 3 }]);
    }
    return this.http.get<EncounterSummary[]>(`${this.base}/campaign/${campaignId}/encounters`);
  }

  create(campaignId: number | string, name: string, notes: string): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<Encounter>(`${this.base}/campaign/${campaignId}/encounters`, { name, notes });
  }

  get(encounterId: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.get<Encounter>(`${this.base}/encounters/${encounterId}`);
  }

  update(encounterId: number, name: string, notes: string): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<Encounter>(`${this.base}/encounters/${encounterId}`, { name, notes });
  }

  delete(encounterId: number): Observable<void> {
    if (environment.demoMode) return of(void 0);
    return this.http.delete<void>(`${this.base}/encounters/${encounterId}`);
  }

  addCreature(encounterId: number, name: string, dexModifier: number,
              hpMax: number | null, quantity: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<Encounter>(`${this.base}/encounters/${encounterId}/creatures`,
      { name, dexModifier, hpMax, quantity });
  }

  updateCreature(encounterId: number, creatureId: number, name: string, dexModifier: number,
                 hpMax: number | null, quantity: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<Encounter>(`${this.base}/encounters/${encounterId}/creatures/${creatureId}`,
      { name, dexModifier, hpMax, quantity });
  }

  removeCreature(encounterId: number, creatureId: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.delete<Encounter>(`${this.base}/encounters/${encounterId}/creatures/${creatureId}`);
  }

  /** Add a prepped loot line — a catalog item (key) or a custom item (name + notes). */
  addLootItem(encounterId: number, catalogItemKey: string | null, customName: string | null,
              customNotes: string | null, qty: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<Encounter>(`${this.base}/encounters/${encounterId}/loot`,
      { catalogItemKey, customName, customNotes, qty });
  }

  /** Update a loot line's qty (and, for custom lines, name/notes). */
  updateLootItem(encounterId: number, lootItemId: number, qty: number,
                 customName: string | null, customNotes: string | null): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<Encounter>(`${this.base}/encounters/${encounterId}/loot/${lootItemId}`,
      { qty, customName, customNotes });
  }

  /** Remove a loot line from the encounter. */
  removeLootItem(encounterId: number, lootItemId: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.delete<Encounter>(`${this.base}/encounters/${encounterId}/loot/${lootItemId}`);
  }

  /** Set the encounter's prepped coin pile, in gold (fractions allowed). */
  setLootCoins(encounterId: number, coinGp: number): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.put<Encounter>(`${this.base}/encounters/${encounterId}/loot-coins`, { coinGp });
  }

  /** Bulk-add loot lines from pasted JSON (appends; coinGp adds to the pile). */
  importLoot(encounterId: number, payload: LootImportPayload): Observable<Encounter> {
    if (environment.demoMode) return this.demoUnsupported();
    return this.http.post<Encounter>(`${this.base}/encounters/${encounterId}/loot/import`, payload);
  }

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Curated encounters are not available in demo mode'));
  }
}
