import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { RenownChange, RenownFaction } from '../models/renown';

@Injectable({ providedIn: 'root' })
export class RenownService {
  private definitions = new Map<string, RenownFaction[]>();
  private scores = new Map<string, number>();
  private nextId = 1;
  constructor(private http: HttpClient) {}
  private url(pcId: number): string {
    return `${environment.characterApiUrl}/api/v1/pc/${pcId}/renown`;
  }
  list(pcId: number, campaignId: string): Observable<RenownFaction[]> {
    if (!environment.demoMode) return this.http.get<RenownFaction[]>(this.url(pcId));
    return of((this.definitions.get(campaignId) ?? []).map(f => ({
      ...f, score: this.scores.get(`${pcId}:${f.id}`) ?? 0,
    }))).pipe(delay(50));
  }
  create(pcId: number, campaignId: string, name: string, parentId: number | null): Observable<RenownFaction> {
    if (!environment.demoMode) return this.http.post<RenownFaction>(this.url(pcId), { name, parentId });
    const faction = { id: this.nextId++, parentId, name: name.trim(), score: 0 };
    this.definitions.set(campaignId, [...(this.definitions.get(campaignId) ?? []), faction]);
    return of(faction).pipe(delay(50));
  }
  /** Save a DM's whole renown edit in one request (one activity-log entry).
   *  Returns the character's full, updated faction list. */
  saveAll(pcId: number, campaignId: string, changes: RenownChange[]): Observable<RenownFaction[]> {
    if (!environment.demoMode) return this.http.patch<RenownFaction[]>(this.url(pcId), changes);
    const known = this.definitions.get(campaignId) ?? [];
    if (!changes.length || changes.some(c => !known.some(f => f.id === c.factionId))) {
      return throwError(() => new Error('Invalid renown changes'));
    }
    for (const change of changes) {
      const key = `${pcId}:${change.factionId}`;
      this.scores.set(key, Math.max(-100, Math.min(100, (this.scores.get(key) ?? 0) + change.delta)));
    }
    return this.list(pcId, campaignId);
  }
}
