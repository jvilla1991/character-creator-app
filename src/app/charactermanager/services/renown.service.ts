import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { RenownFaction } from '../models/renown';

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
  adjust(pcId: number, campaignId: string, factionId: number, delta: number): Observable<RenownFaction> {
    if (!environment.demoMode) return this.http.patch<RenownFaction>(`${this.url(pcId)}/${factionId}`, { delta });
    const faction = this.definitions.get(campaignId)?.find(f => f.id === factionId);
    if (!faction || ![-1, 1].includes(delta)) return throwError(() => new Error('Invalid adjustment'));
    const key = `${pcId}:${factionId}`;
    const score = Math.max(-100, Math.min(100, (this.scores.get(key) ?? 0) + delta));
    this.scores.set(key, score);
    return of({ ...faction, score }).pipe(delay(50));
  }
}
