import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ParticipantView, SessionState } from '../models/session';
import { PC } from '../models/pc';
import { CampaignService } from './campaign.service';

const POLL_INTERVAL_MS = 2000;

/**
 * Live session client. Mirrors the demo/real split every other service uses:
 * in real mode it talks to the cloud character-manager-service (the same service
 * that owns PCs, so HP edits stay consistent) and short-polls the snapshot; in
 * demo mode it builds a single in-memory session from the campaign's members so
 * the screen is previewable with no backend.
 *
 * State is server-authoritative — `state$` always holds the latest snapshot and
 * components render it directly.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private stateSubject = new BehaviorSubject<SessionState | null>(null);
  state$ = this.stateSubject.asObservable();

  private readonly sessionBase = `${environment.characterApiUrl}/api/v1/session`;
  private readonly campaignBase = `${environment.characterApiUrl}/api/v1/campaign`;

  private pollSub?: Subscription;

  constructor(private http: HttpClient, private campaignService: CampaignService) {}

  /** DM opens a lobby for a campaign; stores and returns the initial snapshot. */
  createSession(campaignId: string): Observable<SessionState> {
    if (environment.demoMode) {
      return this.campaignService.getMembers(campaignId).pipe(
        take(1),
        map(members => this.demoState(campaignId, members)),
        tap(state => this.stateSubject.next(state)),
      );
    }
    return this.http.post<unknown>(`${this.campaignBase}/${campaignId}/session`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /** Fetch the current snapshot once. */
  getState(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) {
      const current = this.stateSubject.getValue();
      return current ? of(current) : of(this.emptyState(sessionId));
    }
    return this.http.get<unknown>(`${this.sessionBase}/${sessionId}/state`).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /**
   * Begin polling the snapshot every 2s, paused while the tab is hidden to save
   * requests. No-op in demo mode (the single in-memory state is already live).
   */
  startPolling(sessionId: number | string): void {
    this.stopPolling();
    if (environment.demoMode) return;
    this.pollSub = timer(0, POLL_INTERVAL_MS).pipe(
      filter(() => !document.hidden),
      switchMap(() => this.http.get<unknown>(`${this.sessionBase}/${sessionId}/state`)),
      map(raw => this.deserialize(raw)),
    ).subscribe({
      next: state => this.stateSubject.next(state),
      error: err => console.error('Session poll failed', err),
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  /** Stop polling and clear local state — used when leaving the session screen. */
  clear(): void {
    this.stopPolling();
    this.stateSubject.next(null);
  }

  // --- demo helpers ---------------------------------------------------------

  private demoState(campaignId: string, members: PC[]): SessionState {
    const participants = members
      .map((pc, i) => this.pcToParticipant(pc, i))
      .sort((a, b) => (b.initiative ?? -99) - (a.initiative ?? -99));
    participants.forEach((p, i) => (p.orderIndex = i));
    return {
      sessionId: 'demo-session',
      campaignId,
      status: 'LOBBY',
      round: 1,
      currentTurnIndex: 0,
      version: 0,
      dm: true,
      participants,
    };
  }

  private emptyState(sessionId: number | string): SessionState {
    return {
      sessionId, campaignId: '', status: 'LOBBY', round: 1,
      currentTurnIndex: 0, version: 0, dm: true, participants: [],
    };
  }

  private pcToParticipant(pc: PC, index: number): ParticipantView {
    return {
      participantId: pc.id,
      pcId: pc.id,
      npc: false,
      ownedByMe: true,
      currentTurn: false,
      name: pc.name,
      clazz: pc.clazz ?? null,
      level: pc.level ?? null,
      portraitTint: pc.portraitTint ?? null,
      portraitInitials: pc.portraitInitials ?? null,
      initiative: pc.init ?? null,
      initRolled: pc.init != null,
      orderIndex: index,
      hpMax: pc.hp?.max ?? null,
      hpCurrent: pc.hp?.cur ?? null,
      hpTemp: pc.hp?.temp ?? null,
      ac: pc.ac ?? null,
      conditions: pc.conditions ?? [],
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
    };
  }

  // --- serialize / deserialize seam ----------------------------------------

  private deserialize(raw: any): SessionState {
    return {
      sessionId: raw.sessionId,
      campaignId: raw.campaignId,
      status: raw.status,
      round: raw.round,
      currentTurnIndex: raw.currentTurnIndex,
      version: raw.version,
      dm: !!raw.dm,
      participants: (raw.participants ?? []).map((p: any) => this.deserializeParticipant(p)),
    };
  }

  private deserializeParticipant(p: any): ParticipantView {
    return {
      participantId: p.participantId,
      pcId: p.pcId ?? null,
      npc: !!p.npc,
      ownedByMe: !!p.ownedByMe,
      currentTurn: !!p.currentTurn,
      name: p.name,
      clazz: p.clazz ?? null,
      level: p.level ?? null,
      portraitTint: p.portraitTint ?? null,
      portraitInitials: p.portraitInitials ?? null,
      initiative: p.initiative ?? null,
      initRolled: !!p.initRolled,
      orderIndex: p.orderIndex ?? 0,
      hpMax: p.hpMax ?? null,
      hpCurrent: p.hpCurrent ?? null,
      hpTemp: p.hpTemp ?? null,
      ac: p.ac ?? null,
      conditions: this.parseConditions(p.conditions),
      deathSaveSuccesses: p.deathSaveSuccesses ?? 0,
      deathSaveFailures: p.deathSaveFailures ?? 0,
    };
  }

  /** Backend sends conditions as a JSON string (PC.conditions); normalize to an array. */
  private parseConditions(raw: any): string[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
