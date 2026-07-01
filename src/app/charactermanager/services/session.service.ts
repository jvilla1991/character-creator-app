import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ParticipantView, SessionState, XpAwardEntry, XpAwardResult } from '../models/session';
import { PC } from '../models/pc';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';

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

  constructor(
    private http: HttpClient,
    private campaignService: CampaignService,
    private pcService: PCService,
  ) {}

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

  /**
   * The campaign's current live session, or null if none — used to show players a
   * "session live — join" prompt. Demo mode has no multi-client discovery, so it
   * returns null (the screen is reachable from the DM's Roll Initiative instead).
   */
  getActiveForCampaign(campaignId: string): Observable<SessionState | null> {
    if (environment.demoMode) return of(null);
    return this.http.get<unknown>(`${this.campaignBase}/${campaignId}/session`).pipe(
      map(raw => (raw ? this.deserialize(raw) : null)),
      catchError(() => of(null)),
    );
  }

  /** Seat one of the player's PCs in a live session; stores the resulting state. */
  joinSession(sessionId: number | string, pcId: number): Observable<SessionState> {
    if (environment.demoMode) return this.getState(sessionId).pipe(take(1));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/join`, { pcId }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /** Remove a participant — a player leaving their own PC, or the DM removing one. */
  leave(sessionId: number | string, participantId: number): Observable<SessionState> {
    if (environment.demoMode) return this.getState(sessionId).pipe(take(1));
    return this.http.delete<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}`,
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /** DM ends the session (HP/conditions are already persisted on the PCs). */
  end(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) {
      const current = this.stateSubject.getValue();
      const ended: SessionState = current
        ? { ...current, status: 'ENDED' }
        : { ...this.emptyState(sessionId), status: 'ENDED' };
      this.stateSubject.next(ended);
      return of(ended);
    }
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/end`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /** DM enters a combatant's initiative; the server (or demo) re-sorts the order. */
  setInitiative(sessionId: number | string, participantId: number, value: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoSetInitiative(participantId, value));
    return this.http.put<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/initiative`, { value },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /** DM damages (positive) or heals (negative) a combatant; PC HP writes through. */
  applyDamage(sessionId: number | string, participantId: number, amount: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoDamage(participantId, amount));
    return this.http.post<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/damage`, { amount },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.stateSubject.next(state)),
    );
  }

  /**
   * DM awards XP to a single seated PC. The backend writes it through to the
   * character (floored at 0) and bumps the session version; XP isn't on the
   * snapshot, so the result carries the new total for a confirmation toast. The
   * awarded total is mirrored into the local PC store so an open sheet updates
   * without a refetch (same pattern as a shop purchase).
   */
  awardXp(sessionId: number | string, participantId: number, amount: number): Observable<XpAwardResult> {
    if (environment.demoMode) return of(this.demoAwardXp(participantId, amount));
    return this.http.post<XpAwardResult>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/xp`, { amount },
    ).pipe(tap(result => this.patchXp(result)));
  }

  /** DM awards the same XP amount to every seated PC in the session. */
  awardXpToAll(sessionId: number | string, amount: number): Observable<XpAwardResult> {
    if (environment.demoMode) return of(this.demoAwardXpToAll(amount));
    return this.http.post<XpAwardResult>(
      `${this.sessionBase}/${sessionId}/xp`, { amount },
    ).pipe(tap(result => this.patchXp(result)));
  }

  /** Mirror awarded totals into the local PC store (no-op for PCs not loaded). */
  private patchXp(result: XpAwardResult): void {
    result.awarded.forEach(e => this.pcService.patchLocalPC(e.pcId, { xp: e.xp }));
  }

  // --- demo helpers ---------------------------------------------------------

  /** Demo: set a participant's initiative and re-sort the order locally. */
  private demoSetInitiative(participantId: number, value: number): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = state.participants
      .map(p => (p.participantId === participantId ? { ...p, initiative: value, initRolled: true } : p))
      .sort((a, b) => (b.initiative ?? -99) - (a.initiative ?? -99));
    participants.forEach((p, i) => (p.orderIndex = i));
    const next = { ...state, participants, version: state.version + 1 };
    this.stateSubject.next(next);
    return next;
  }

  /** Demo: apply an HP delta to a participant locally (temp absorbs, floor 0, heal caps at max). */
  private demoDamage(participantId: number, amount: number): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = state.participants.map(p => {
      if (p.participantId !== participantId) return p;
      let cur = p.hpCurrent ?? 0;
      let temp = p.hpTemp ?? 0;
      if (amount > 0) {
        const absorbed = Math.min(temp, amount);
        temp -= absorbed;
        cur = Math.max(0, cur - (amount - absorbed));
      } else if (amount < 0) {
        cur += -amount;
        if (p.hpMax != null) cur = Math.min(cur, p.hpMax);
      }
      return { ...p, hpCurrent: cur, hpTemp: temp };
    });
    const next = { ...state, participants, version: state.version + 1 };
    this.stateSubject.next(next);
    return next;
  }

  /** Demo: award XP to one seated PC's in-memory character, floored at 0. */
  private demoAwardXp(participantId: number, amount: number): XpAwardResult {
    const state = this.stateSubject.getValue();
    const p = state?.participants.find(x => x.participantId === participantId);
    const awarded: XpAwardEntry[] = [];
    if (p && p.pcId != null && !p.npc) {
      awarded.push(this.demoApplyXp(p.pcId, p.name, amount));
    }
    if (state) this.stateSubject.next({ ...state, version: state.version + 1 });
    return { awarded };
  }

  /** Demo: award the same XP to every seated PC (NPCs skipped). */
  private demoAwardXpToAll(amount: number): XpAwardResult {
    const state = this.stateSubject.getValue();
    const awarded: XpAwardEntry[] = [];
    if (state) {
      state.participants.forEach(p => {
        if (p.pcId != null && !p.npc) awarded.push(this.demoApplyXp(p.pcId, p.name, amount));
      });
      this.stateSubject.next({ ...state, version: state.version + 1 });
    }
    return { awarded };
  }

  /** Demo: apply an XP delta to the in-memory PC (floored at 0) and patch the store. */
  private demoApplyXp(pcId: number, name: string, amount: number): XpAwardEntry {
    const current = this.pcService.getPCById(pcId)?.xp ?? 0;
    const updated = Math.max(0, current + amount);
    this.pcService.patchLocalPC(pcId, { xp: updated });
    return { pcId, name, xp: updated, delta: updated - current };
  }

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
      shopOpen: false,
      shopForMe: false,
      shopCategory: null,
      participants,
    };
  }

  private emptyState(sessionId: number | string): SessionState {
    return {
      sessionId, campaignId: '', status: 'LOBBY', round: 1,
      currentTurnIndex: 0, version: 0, dm: true,
      shopOpen: false, shopForMe: false, shopCategory: null, participants: [],
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
      shopOpen: !!raw.shopOpen,
      shopForMe: !!raw.shopForMe,
      shopCategory: raw.shopCategory ?? null,
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
