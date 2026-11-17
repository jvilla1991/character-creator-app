import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ProfessionGrant, ProfessionKey } from '../models/profession';

@Injectable({ providedIn: 'root' })
export class ProfessionService {
  private demoGrants = new Map<number, ProfessionGrant[]>();
  constructor(private http: HttpClient) {}
  private url(pcId: number): string { return `${environment.characterApiUrl}/api/v1/pc/${pcId}/professions`; }
  list(pcId: number): Observable<ProfessionGrant[]> {
    return environment.demoMode ? of([...(this.demoGrants.get(pcId) ?? [])]).pipe(delay(50))
      : this.http.get<ProfessionGrant[]>(this.url(pcId));
  }
  grant(pcId: number, profession: ProfessionKey): Observable<ProfessionGrant> {
    if (environment.demoMode) {
      const grant = { profession };
      this.demoGrants.set(pcId, [...(this.demoGrants.get(pcId) ?? []).filter(g => g.profession !== profession), grant]);
      return of(grant).pipe(delay(50));
    }
    return this.http.post<ProfessionGrant>(this.url(pcId), { profession });
  }
  revoke(pcId: number, profession: ProfessionKey): Observable<void> {
    if (environment.demoMode) {
      this.demoGrants.set(pcId, (this.demoGrants.get(pcId) ?? []).filter(g => g.profession !== profession));
      return of(undefined).pipe(delay(50));
    }
    return this.http.delete<void>(`${this.url(pcId)}/${profession}`);
  }
}
