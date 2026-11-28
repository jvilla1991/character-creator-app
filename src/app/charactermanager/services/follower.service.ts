import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  COMPANION_NOT_DISMISSED, Follower, FollowerKind, FollowerStatBlock, MAX_FOLLOWERS, followerKind, mayDismiss,
} from '../models/follower';
import { companionEdit, isCompanion } from '../models/companion';
import { PC } from '../models/pc';
import { syncVestigeCompanion } from '../models/vestige-companion';

/** A demo-mode refusal shaped like the server's, so callers read one error shape. */
const refuse = (status: number, message: string) =>
  throwError(() => new HttpErrorResponse({ status, error: { message } }));

/**
 * A character's followers — companions the campaign's DM grants and creatures
 * the player's own spells make, each with its own stat block. Followers live in
 * their own backend table (not on the PC row), so nothing here touches
 * PCService's store: a sheet save can never clobber a follower, and a follower
 * edit never re-saves the character.
 *
 * Authority is enforced server-side and depends on the follower's kind: only
 * the campaign's DM grants or dismisses a DM grant; the owning player (or that
 * DM) adds and dismisses a summon or a familiar; the owning player and the DM
 * read the list and update any follower. A companion (a Vestige Patron's
 * vestige) is the server's own: nothing here creates one, nobody dismisses
 * one, and an update changes only its name, its Hit Points and its
 * conditions. Demo mode keeps an in-memory list per character and applies the
 * same rules.
 *
 * Every view that lists followers (the Followers tab, an open follower sheet,
 * the Party Vitals Board) keeps its own copy, so `changes$` says when a
 * character's followers changed: a grant, an edit or a dismissal made here,
 * or one the live session's snapshot revealed (SessionService). Listeners
 * re-list that character.
 */
@Injectable({
  providedIn: 'root',
})
export class FollowerService {
  constructor(private http: HttpClient) {}

  private demoFollowers: { [pcId: number]: Follower[] } = {};
  /** The last demo follower id handed out; two made in one millisecond still differ. */
  private lastDemoId = 0;

  private readonly changed = new Subject<{ pcId: number }>();
  /** A character's followers changed; re-list them to see how. */
  readonly changes$ = this.changed.asObservable();

  /** Announce that `pcId`'s followers changed somewhere this service did not see. */
  notifyChanged(pcId: number): void {
    this.changed.next({ pcId });
  }

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

  /** Demo mode only: the character's followers right now, without the fake
   *  network delay — the demo session snapshot seats them synchronously. */
  demoList(pcId: number): Follower[] {
    return [...(this.demoFollowers[pcId] ?? [])];
  }

  /** DM grants a follower to a campaign member's character. */
  grant(pcId: number, name: string, statBlock: FollowerStatBlock): Observable<Follower> {
    if (environment.demoMode) return this.demoCreate(pcId, name, statBlock, 'DM_GRANT');
    return this.http.post<Follower>(this.url(pcId), { name, statBlock })
      .pipe(tap(() => this.notifyChanged(pcId)));
  }

  /**
   * The owning player (or the campaign's DM) adds a follower one of the
   * character's own spells made: a SUMMON, or a FAMILIAR. A character has one
   * familiar, so a new one replaces the current one.
   */
  summon(pcId: number, name: string, statBlock: FollowerStatBlock,
         kind: 'SUMMON' | 'FAMILIAR'): Observable<Follower> {
    if (environment.demoMode) return this.demoCreate(pcId, name, statBlock, kind);
    return this.http.post<Follower>(this.url(pcId), { name, statBlock, kind })
      .pipe(tap(() => this.notifyChanged(pcId)));
  }

  /** Demo mode's create, with the server's rules: a new familiar replaces the
   *  old one first, then the cap of twenty counts every kind. */
  private demoCreate(pcId: number, name: string, statBlock: FollowerStatBlock,
                     kind: FollowerKind): Observable<Follower> {
    const kept = (this.demoFollowers[pcId] ?? [])
      .filter(f => kind !== 'FAMILIAR' || followerKind(f) !== 'FAMILIAR');
    if (kept.length >= MAX_FOLLOWERS) {
      return refuse(409, `A character can have at most ${MAX_FOLLOWERS} followers`);
    }
    this.lastDemoId = Math.max(Date.now(), this.lastDemoId + 1);
    const follower: Follower = {
      id: this.lastDemoId, pcId, name: name.trim(), statBlock, createdAt: new Date().toISOString(), kind,
    };
    this.demoFollowers[pcId] = [...kept, follower];
    return of(follower).pipe(delay(50), tap(() => this.notifyChanged(pcId)));
  }

  /** Save a follower's sheet (and name) — the owning player or the campaign's DM. */
  update(pcId: number, followerId: number, name: string, statBlock: FollowerStatBlock): Observable<Follower> {
    if (environment.demoMode) {
      const existing = (this.demoFollowers[pcId] ?? []).find(f => f.id === followerId);
      if (!existing) return throwError(() => new Error('Follower not found'));
      // Of a companion only the Hit Points and the conditions are taken, as on the server.
      const updated: Follower = {
        ...existing, name, statBlock: isCompanion(existing) ? companionEdit(existing.statBlock, statBlock) : statBlock,
      };
      this.demoFollowers[pcId] = this.demoFollowers[pcId].map(f => f.id === followerId ? updated : f);
      return of(updated).pipe(delay(50), tap(() => this.notifyChanged(pcId)));
    }
    return this.http.put<Follower>(`${this.url(pcId)}/${followerId}`, { name, statBlock })
      .pipe(tap(() => this.notifyChanged(pcId)));
  }

  /**
   * Permanently remove a follower. The campaign's DM may dismiss any of them
   * but a companion; the owning player only their own summon or familiar. The
   * server decides who the caller is; `asDm` tells demo mode, which has no
   * server to ask.
   */
  dismiss(pcId: number, followerId: number, asDm = false): Observable<void> {
    if (environment.demoMode) {
      const follower = (this.demoFollowers[pcId] ?? []).find(f => f.id === followerId);
      if (!follower) return refuse(404, 'Follower not found');
      if (isCompanion(follower)) return refuse(403, COMPANION_NOT_DISMISSED);
      if (!mayDismiss(follower, asDm)) return refuse(403, 'Access denied');
      this.demoFollowers[pcId] = (this.demoFollowers[pcId] ?? []).filter(f => f.id !== followerId);
      return of(undefined).pipe(delay(50), tap(() => this.notifyChanged(pcId)));
    }
    return this.http.delete<void>(`${this.url(pcId)}/${followerId}`)
      .pipe(tap(() => this.notifyChanged(pcId)));
  }

  /**
   * Demo mode only: the server's companion step. After a character changed
   * (a level-up, a sheet save, a change of its Vestige type) its vestige is
   * created, rebuilt or removed to match, and listeners are told when it was.
   * Every other follower, and every other character, is left as it is.
   */
  demoSyncVestige(pc: PC): void {
    if (!environment.demoMode) return;
    const current = this.demoFollowers[pc.id] ?? [];
    const next = syncVestigeCompanion(current, pc, () => {
      this.lastDemoId = Math.max(Date.now(), this.lastDemoId + 1);
      return this.lastDemoId;
    });
    if (next === current) return;
    this.demoFollowers[pc.id] = [...next];
    this.notifyChanged(pc.id);
  }
}
