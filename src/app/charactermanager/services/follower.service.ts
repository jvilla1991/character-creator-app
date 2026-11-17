import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Follower, FollowerStatBlock } from '../models/follower';

/**
 * A character's followers — companions the campaign's DM grants, each with its
 * own stat block. Followers live in their own backend table (not on the PC
 * row), so nothing here touches PCService's store: a sheet save can never
 * clobber a follower, and a follower edit never re-saves the character.
 *
 * Authority is enforced server-side: only the campaign's DM grants or
 * dismisses; the owning player and that DM read the list and update a follower.
 * Demo mode keeps an in-memory list per character.
 */
@Injectable({
  providedIn: 'root',
})
export class FollowerService {
  constructor(private http: HttpClient) {}

  private demoFollowers: { [pcId: number]: Follower[] } = {};

  private url(pcId: number): string {
    return `${environment.characterApiUrl}/api/v1/pc/${pcId}/followers`;
  }

  /** The character's followers, oldest grant first. */
  list(pcId: number): Observable<Follower[]> {
    if (environment.demoMode) {
      return of([...(this.demoFollowers[pcId] ?? [])]).pipe(delay(50));
    }
    return this.http.get<Follower[]>(this.url(pcId));
  }

  /** DM grants a follower to a campaign member's character. */
  grant(pcId: number, name: string, statBlock: FollowerStatBlock): Observable<Follower> {
    if (environment.demoMode) {
      const follower: Follower = {
        id: Date.now(), pcId, name: name.trim(), statBlock, createdAt: new Date().toISOString(),
      };
      this.demoFollowers[pcId] = [...(this.demoFollowers[pcId] ?? []), follower];
      return of(follower).pipe(delay(50));
    }
    return this.http.post<Follower>(this.url(pcId), { name, statBlock });
  }

  /** Save a follower's sheet (and name) — the owning player or the campaign's DM. */
  update(pcId: number, followerId: number, name: string, statBlock: FollowerStatBlock): Observable<Follower> {
    if (environment.demoMode) {
      const existing = (this.demoFollowers[pcId] ?? []).find(f => f.id === followerId);
      if (!existing) return throwError(() => new Error('Follower not found'));
      const updated: Follower = { ...existing, name, statBlock };
      this.demoFollowers[pcId] = this.demoFollowers[pcId].map(f => f.id === followerId ? updated : f);
      return of(updated).pipe(delay(50));
    }
    return this.http.put<Follower>(`${this.url(pcId)}/${followerId}`, { name, statBlock });
  }

  /** DM permanently removes a follower. */
  dismiss(pcId: number, followerId: number): Observable<void> {
    if (environment.demoMode) {
      this.demoFollowers[pcId] = (this.demoFollowers[pcId] ?? []).filter(f => f.id !== followerId);
      return of(undefined).pipe(delay(50));
    }
    return this.http.delete<void>(`${this.url(pcId)}/${followerId}`);
  }
}
