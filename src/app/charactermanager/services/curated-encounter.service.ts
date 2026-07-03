import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Encounter, EncounterSummary } from '../models/encounter';

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

  private demoUnsupported<T>(): Observable<T> {
    return throwError(() => new Error('Curated encounters are not available in demo mode'));
  }
}
