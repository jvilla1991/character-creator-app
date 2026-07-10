import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, throwError, timer } from 'rxjs';
import { catchError, filter, map, switchMap, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ParticipantView,
  SessionRollGroup,
  SessionRollView,
  SessionState,
  XpAwardEntry,
  XpAwardResult,
} from '../models/session';
import { PC, PcItem, PcSurvival } from '../models/pc';
import { CampaignGameTime, CampaignLocation, LocationType, LOCATION_TYPES, TimeOfDay } from '../models/campaign';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';
import {
  advanceGameTime,
  applyLongRestToPc,
  applySegmentToPc,
  initialGameTime,
  normalizeGameTime,
  setGameTime,
} from '../utils/survival';
import { applyCastToPc } from '../utils/spellcasting';

const POLL_INTERVAL_MS = 2000;

/** localStorage key for the per-device sound mute (player preference, not synced). */
const SOUND_MUTE_KEY = 'tm-session-sound-muted';

/**
 * Turn-cue presets synthesized with WebAudio — no bundled assets. The key is
 * what the DM stores on the session (`turnSound`).
 */
export const TURN_SOUNDS: { key: string; label: string }[] = [
  { key: 'chime', label: 'Chime' },
  { key: 'bell', label: 'Bell' },
  { key: 'drum', label: 'Drum' },
];

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

  /**
   * The active-participant id of the last snapshot seen, for the turn-cue
   * trigger. `undefined` means "no snapshot yet" — the first snapshot after
   * opening (or rejoining) initializes silently, so a reconnect never replays a
   * stale cue; poll catch-up over several turns plays at most the current one.
   */
  private lastActiveId: number | null | undefined;

  private audioCtx?: AudioContext;

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
        tap(state => this.pushState(state)),
      );
    }
    return this.http.post<unknown>(`${this.campaignBase}/${campaignId}/session`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
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
      tap(state => this.pushState(state)),
    );
  }

  /**
   * Begin polling the snapshot every 2s, paused while the tab is hidden to save
   * requests. Sends `sinceVersion` (the version of the snapshot we already
   * hold) so an unchanged session answers 204 with no payload; a null body is
   * simply skipped. No-op in demo mode (the single in-memory state is already
   * live).
   */
  startPolling(sessionId: number | string): void {
    this.stopPolling();
    if (environment.demoMode) return;
    this.pollSub = timer(0, POLL_INTERVAL_MS).pipe(
      filter(() => !document.hidden),
      switchMap(() => {
        const current = this.stateSubject.getValue();
        const since = current != null ? `?sinceVersion=${current.version}` : '';
        return this.http.get<unknown>(`${this.sessionBase}/${sessionId}/state${since}`);
      }),
    ).subscribe({
      next: raw => {
        if (raw != null) this.pushState(this.deserialize(raw));
      },
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
    this.pushState(null);
  }

  /**
   * The single funnel every snapshot goes through before components see it —
   * this is where the turn cue fires. Sound plays only on an observed CHANGE of
   * the active-participant id to a non-null value, which encodes the whole rule
   * set: no cue on first load or rejoin (`lastActiveId` still undefined), no cue
   * while a hidden enemy acts (the server nulls the id for players), one cue —
   * not several — when a poll catches up over multiple turns, and a cue when a
   * hidden enemy's turn ends and a visible combatant comes up (null → id).
   */
  private pushState(state: SessionState | null): void {
    if (state == null) {
      this.lastActiveId = undefined;
    } else {
      const previous = this.lastActiveId;
      const current = state.activeParticipantId;
      if (previous !== undefined && current != null && current !== previous && state.turnSound) {
        this.playCue(state.turnSound);
      }
      this.lastActiveId = current;
    }
    this.stateSubject.next(state);
  }

  // --- turn-cue sound ---------------------------------------------------------

  /** Per-device mute (localStorage) — the DM's chosen cue still syncs to everyone. */
  isMuted(): boolean {
    try {
      return localStorage.getItem(SOUND_MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  setMuted(muted: boolean): void {
    try {
      if (muted) localStorage.setItem(SOUND_MUTE_KEY, '1');
      else localStorage.removeItem(SOUND_MUTE_KEY);
    } catch {
      // storage unavailable — sounds just stay on
    }
  }

  /**
   * Synthesize the cue with WebAudio (no audio assets to ship). Public so the
   * DM's sound picker can preview a cue on selection. Failures are swallowed —
   * a blocked AudioContext must never break the tracker.
   */
  playCue(key: string): void {
    if (this.isMuted()) return;
    try {
      const ctx = this.audioCtx ?? (this.audioCtx = new AudioContext());
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      // frequency (Hz), oscillator shape, decay (s) per preset.
      const presets: { [k: string]: { freq: number; type: OscillatorType; decay: number } } = {
        chime: { freq: 880, type: 'sine', decay: 0.6 },
        bell: { freq: 660, type: 'triangle', decay: 0.9 },
        drum: { freq: 130, type: 'sine', decay: 0.25 },
      };
      const preset = presets[key];
      if (!preset) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset.type;
      osc.frequency.value = preset.freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + preset.decay);
    } catch {
      // audio unavailable (autoplay policy, no device) — stay silent
    }
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
      tap(state => this.pushState(state)),
    );
  }

  /** Remove a participant — a player leaving their own PC, or the DM removing one. */
  leave(sessionId: number | string, participantId: number): Observable<SessionState> {
    if (environment.demoMode) return this.getState(sessionId).pipe(take(1));
    return this.http.delete<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}`,
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM ends the session (HP/conditions are already persisted on the PCs). */
  end(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) {
      const current = this.stateSubject.getValue();
      const ended: SessionState = current
        ? { ...current, status: 'ENDED' }
        : { ...this.emptyState(sessionId), status: 'ENDED' };
      this.pushState(ended);
      return of(ended);
    }
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/end`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM starts the encounter: LOBBY → ACTIVE, turn points at the top of the order. */
  start(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoStart());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/start`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * DM ends the encounter (not the session): back to the lobby, turn tracking
   * stops, initiative clears so the next encounter rolls fresh. HP/XP changes
   * already made stand — nothing is undone.
   */
  endEncounter(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoEndEncounter());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/encounter/end`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * Advance the turn — the DM's Next, or a player ending their own turn. Sends
   * the participant id this client believes is active; the server 409s a stale
   * one (a racing advance already moved the turn), in which case we quietly
   * refetch so the UI snaps to the truth instead of surfacing an error.
   */
  advance(sessionId: number | string, expectedActiveParticipantId: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoAdvance());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/advance`, {
      expectedActiveParticipantId,
    }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
      catchError(err => {
        if (err?.status === 409) return this.getState(sessionId).pipe(take(1));
        throw err;
      }),
    );
  }

  /** DM adds an enemy (DM-calculated DEX modifier, optional HP); it parks at the bottom. */
  addEnemy(sessionId: number | string, name: string, dexModifier: number,
           hpMax: number | null): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoAddEnemy(name, dexModifier, hpMax));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/enemies`, {
      name, dexModifier, hpMax,
    }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * DM loads a curated encounter: every creature becomes an enemy combatant,
   * appended to the current order with no initiative (the DM rolls). Quantity is
   * expanded server-side into numbered rows.
   */
  loadEncounter(sessionId: number | string, encounterId: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoLoadEncounter());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/encounter/load`, {
      encounterId,
    }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM toggles whether players can see enemy combatants at all. */
  setVisibility(sessionId: number | string, enemiesHidden: boolean): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoPatch({ enemiesHidden }));
    return this.http.put<unknown>(`${this.sessionBase}/${sessionId}/visibility`, { enemiesHidden }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * DM advances the campaign clock one segment. Real mode is server-
   * authoritative (member survival bumps happen there and arrive on the
   * snapshot); demo mirrors the same rules locally, including the
   * initialize-without-bumps first click.
   */
  advanceTime(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return this.demoAdvanceTime();
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/time/advance`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => { this.pushState(state); this.mirrorGameTime(state); }),
    );
  }

  /**
   * DM sets the campaign clock directly — no condition bumps. Sends the free
   * text date labels + weekday; the server owns the week-counter logic (the
   * demo branch mirrors it via the shared setGameTime). `week` applies only to
   * campaigns with a defined week — omit it otherwise.
   */
  setTime(sessionId: number | string,
          time: { year: string; month: string; day: string; timeOfDay: TimeOfDay;
                  weekday: string | null; week?: number | null },
  ): Observable<SessionState> {
    if (environment.demoMode) return this.demoSetTime(time);
    return this.http.put<unknown>(`${this.sessionBase}/${sessionId}/time`, time).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => { this.pushState(state); this.mirrorGameTime(state); }),
    );
  }

  /**
   * DM long rest for the seated party: restores every PC's spell slots and, in
   * a survival campaign, sheds fatigue (3 undisturbed / 1 disturbed). Server-
   * authoritative and version-bumped so every sheet updates via the poll.
   */
  longRest(sessionId: number | string, undisturbed: boolean): Observable<SessionState> {
    if (environment.demoMode) return this.demoLongRest(undisturbed);
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/long-rest`, { undisturbed }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * A player casts one of their own seated PC's spells. Server-authoritative
   * (the slot spend and component consumption happen there and bump the poll
   * version so the DM sees it live); the result patches the local PC store so an
   * open sheet updates without a refetch, and a non-null `warning` (missing
   * costly component in a lenient campaign) is surfaced to the caller.
   */
  castSpell(sessionId: number | string, pcId: number, spellName: string, atLevel: number):
      Observable<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }> {
    if (environment.demoMode) return this.demoCast(pcId, spellName, atLevel);
    return this.http.post<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }>(
      `${this.sessionBase}/${sessionId}/spell/cast`, { pcId, spellName, atLevel },
    ).pipe(
      tap(result => this.pcService.patchLocalPC(pcId, {
        spellSlots: result.spellSlots,
        inventory: result.inventory ?? [],
      })),
    );
  }

  /**
   * Log a roll made during this live session (from the in-sheet dice modal or
   * the Session Mode Roll button). Fire-and-forget from the caller's
   * perspective — errors are handled by the caller, not here, so a failed log
   * never blocks the dice animation the player already saw.
   */
  logRoll(sessionId: number | string, participantId: number,
          groups: { sides: number; rolls: number[] }[]): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoLogRoll(participantId, groups));
    return this.http.post<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/rolls`, { groups },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** Demo mirror of the roll log: synthesize a row and push it onto the in-memory state. */
  private demoLogRoll(participantId: number, groups: { sides: number; rolls: number[] }[]): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const p = state.participants.find(x => x.participantId === participantId);
    const rollGroups: SessionRollGroup[] = groups.map(g => ({
      sides: g.sides,
      rolls: g.rolls,
      subtotal: g.rolls.reduce((a, b) => a + b, 0),
    }));
    const roll: SessionRollView = {
      rollId: Date.now(),
      participantId,
      rollerName: p?.name ?? 'Unknown',
      mine: true,
      groups: rollGroups,
      grandTotal: rollGroups.reduce((a, g) => a + g.subtotal, 0),
      createdAt: new Date().toISOString(),
    };
    const rolls = [roll, ...state.rolls];
    return this.demoPatch({ rolls });
  }

  /** Keep the campaign list's copy of the clock fresh after a session change. */
  private mirrorGameTime(state: SessionState): void {
    if (state.gameTime) {
      this.campaignService.setLocalGameTime(state.campaignId, state.gameTime);
    }
  }

  /**
   * DM sets the party's current location. Party-wide (stored on the campaign,
   * like the clock); server-authoritative and version-bumped so every seated
   * sheet updates via the poll. Mirrors the change onto the local campaign so a
   * standing sheet picks it up too.
   */
  setLocation(sessionId: number | string,
              location: { name: string; type: LocationType }): Observable<SessionState> {
    if (environment.demoMode) return this.demoSetLocation(location);
    return this.http.put<unknown>(`${this.sessionBase}/${sessionId}/location`, location).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => { this.pushState(state); this.mirrorLocation(state); }),
    );
  }

  /** Keep the campaign list's copy of the location fresh after a session change. */
  private mirrorLocation(state: SessionState): void {
    this.campaignService.setLocalLocation(state.campaignId, state.location);
  }

  /** Demo mirror of the server's set-location. */
  private demoSetLocation(location: { name: string; type: LocationType }): Observable<SessionState> {
    const loc: CampaignLocation = { name: (location.name ?? '').trim(), type: location.type };
    const state = this.demoPatch({ location: loc });
    this.campaignService.setLocalLocation(state.campaignId, loc);
    return of(state);
  }

  /** DM sets (or clears) the encounter turn-cue sound, pushed to every client. */
  setSound(sessionId: number | string, turnSound: string | null): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoPatch({ turnSound }));
    return this.http.put<unknown>(`${this.sessionBase}/${sessionId}/sound`, { turnSound }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM enters a combatant's initiative; the server (or demo) re-sorts the order. */
  setInitiative(sessionId: number | string, participantId: number, value: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoSetInitiative(participantId, value));
    return this.http.put<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/initiative`, { value },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM damages (positive) or heals (negative) a combatant; PC HP writes through. */
  applyDamage(sessionId: number | string, participantId: number, amount: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoDamage(participantId, amount));
    return this.http.post<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/damage`, { amount },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
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

  /**
   * Demo: set a participant's initiative and re-sort the order locally, using
   * the backend's comparator (initiative desc, unset last → DEX modifier desc →
   * stable id). The pointer is an id, so it survives the re-sort untouched —
   * same late-entry semantics as the real server.
   */
  private demoSetInitiative(participantId: number, value: number): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = this.demoSort(state.participants.map(p =>
      p.participantId === participantId ? { ...p, initiative: value, initRolled: true } : p,
    ));
    const next = this.demoWithPointers({ ...state, participants, version: state.version + 1 });
    this.pushState(next);
    return next;
  }

  /** The backend's turn-order comparator, mirrored for demo mode. */
  private demoSort(participants: ParticipantView[]): ParticipantView[] {
    const sorted = [...participants].sort((a, b) =>
      ((b.initiative ?? -999) - (a.initiative ?? -999))
      || ((b.dexModifier ?? -999) - (a.dexModifier ?? -999))
      || (a.participantId - b.participantId),
    );
    sorted.forEach((p, i) => (p.orderIndex = i));
    return sorted;
  }

  /**
   * Demo: recompute the glow targets from the pointer. The demo viewer is the
   * DM, so everything is visible — on-deck is simply the next in order (null
   * with a single combatant, mirroring the server).
   */
  private demoWithPointers(state: SessionState): SessionState {
    if (state.status !== 'ACTIVE' || state.activeParticipantId == null) {
      return { ...state, onDeckParticipantId: null };
    }
    const order = state.participants;
    const idx = order.findIndex(p => p.participantId === state.activeParticipantId);
    if (idx < 0) return { ...state, onDeckParticipantId: null };
    const next = order[(idx + 1) % order.length];
    const onDeck = next.participantId === state.activeParticipantId ? null : next.participantId;
    const participants = order.map(p =>
      ({ ...p, currentTurn: p.participantId === state.activeParticipantId }));
    return { ...state, participants, onDeckParticipantId: onDeck };
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
    this.pushState(next);
    return next;
  }

  /** Demo: start the encounter — pointer at the top of the current order. */
  private demoStart(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = this.demoSort(state.participants);
    const first = participants.length ? participants[0].participantId : null;
    const next = this.demoWithPointers({
      ...state, participants, status: 'ACTIVE', round: 1,
      activeParticipantId: first, version: state.version + 1,
    });
    this.pushState(next);
    return next;
  }

  /** Demo: end the encounter — lobby, pointer cleared, initiative reset. */
  private demoEndEncounter(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = state.participants.map(p =>
      ({ ...p, initiative: null, initRolled: false, currentTurn: false }));
    const next: SessionState = {
      ...state, participants, status: 'LOBBY', round: 1,
      activeParticipantId: null, onDeckParticipantId: null,
      version: state.version + 1,
    };
    this.pushState(next);
    return next;
  }

  /** Demo: advance to the next combatant, wrapping to the top and bumping the round. */
  private demoAdvance(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const order = state.participants;
    const idx = order.findIndex(p => p.participantId === state.activeParticipantId);
    if (idx < 0 || !order.length) return state;
    const nextIdx = (idx + 1) % order.length;
    const next = this.demoWithPointers({
      ...state,
      activeParticipantId: order[nextIdx].participantId,
      round: nextIdx === 0 ? state.round + 1 : state.round,
      version: state.version + 1,
    });
    this.pushState(next);
    return next;
  }

  /** Demo: add an enemy with no initiative — it parks at the bottom of the order. */
  private demoAddEnemy(name: string, dexModifier: number, hpMax: number | null): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const enemy: ParticipantView = {
      participantId: Date.now(), pcId: null, npc: true, ownedByMe: false, currentTurn: false,
      name, clazz: null, level: null, portraitTint: null, portraitInitials: null,
      initiative: null, initRolled: false, dexModifier, orderIndex: state.participants.length,
      hpMax, hpCurrent: hpMax, hpTemp: null, ac: null, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
    };
    const participants = this.demoSort([...state.participants, enemy]);
    const next = this.demoWithPointers({ ...state, participants, version: state.version + 1 });
    this.pushState(next);
    return next;
  }

  /** Demo: spawn the canned "Goblin Ambush" encounter as three enemy rows. */
  private demoLoadEncounter(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const base = Date.now();
    const goblins: ParticipantView[] = [1, 2, 3].map((n, i) => ({
      participantId: base + i, pcId: null, npc: true, ownedByMe: false, currentTurn: false,
      name: `Goblin ${n}`, clazz: null, level: null, portraitTint: null, portraitInitials: null,
      initiative: null, initRolled: false, dexModifier: 2, orderIndex: state.participants.length + i,
      hpMax: 7, hpCurrent: 7, hpTemp: null, ac: null, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
    }));
    const participants = this.demoSort([...state.participants, ...goblins]);
    const next = this.demoWithPointers({ ...state, participants, version: state.version + 1 });
    this.pushState(next);
    return next;
  }

  /** Demo: apply a session-settings patch (visibility, sound) locally. */
  private demoPatch(patch: Partial<SessionState>): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const next = { ...state, ...patch, version: state.version + 1 };
    this.pushState(next);
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
    if (state) this.pushState({ ...state, version: state.version + 1 });
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
      this.pushState({ ...state, version: state.version + 1 });
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

  /** Demo mirror of the server's advance-time (clock + member bumps). */
  private demoAdvanceTime(): Observable<SessionState> {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const campaign = this.campaignService.getLocalCampaign(state.campaignId);
    const current = state.gameTime ?? campaign?.gameTime ?? null;
    const next = current ? advanceGameTime(current, campaign?.weekDays) : initialGameTime();
    // First click establishes the clock — no bumps. Every segment bumps under
    // the three-segment mapping (morning +H/T, noon +F, night +all).
    const bumps = current != null && !!campaign?.variantRules?.survivalConditions;

    let participants = state.participants;
    if (bumps) {
      participants = state.participants.map(p => {
        if (p.pcId == null) return p;
        const pc = this.pcService.getPCById(p.pcId);
        if (!pc) return p;
        // Auto-eat/drink supplies as time passes (mirror of the server).
        const updated = applySegmentToPc(pc, next.timeOfDay);
        this.pcService.patchLocalPC(p.pcId, { survival: updated.survival, inventory: updated.inventory ?? [] });
        return { ...p, survival: updated.survival ?? null };
      });
    }
    this.campaignService.setLocalGameTime(state.campaignId, next);
    return of(this.demoPatch({ gameTime: next, participants }));
  }

  /** Demo mirror of the DM long rest (restore slots + shed fatigue for the party). */
  private demoLongRest(undisturbed: boolean): Observable<SessionState> {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const survivalOn = !!this.campaignService.getLocalCampaign(state.campaignId)?.variantRules?.survivalConditions;
    const participants = state.participants.map(p => {
      if (p.pcId == null) return p;
      const pc = this.pcService.getPCById(p.pcId);
      if (!pc) return p;
      const updated = applyLongRestToPc(pc, undisturbed, survivalOn);
      this.pcService.patchLocalPC(p.pcId, { spellSlots: updated.spellSlots, survival: updated.survival });
      return { ...p, survival: updated.survival ?? p.survival };
    });
    return of(this.demoPatch({ participants }));
  }

  private demoSetTime(
    time: { year: string; month: string; day: string; timeOfDay: TimeOfDay;
            weekday: string | null; week?: number | null },
  ): Observable<SessionState> {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const campaign = this.campaignService.getLocalCampaign(state.campaignId);
    const current = state.gameTime ?? campaign?.gameTime ?? initialGameTime();
    // Mirror the server via the shared reducer: with a defined week the weekday
    // is canonicalized and only an explicit week moves the counter; without one
    // the weekday history drives it (unchanged-weekday corrections guarded).
    const next = setGameTime(current, time, campaign?.weekDays);
    this.campaignService.setLocalGameTime(state.campaignId, next);
    return of(this.demoPatch({ gameTime: next }));
  }


  /** Demo mirror of the cast endpoint (shared reducer, local persistence + version bump). */
  private demoCast(pcId: number, spellName: string, atLevel: number):
      Observable<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }> {
    const pc = this.pcService.getPCById(pcId);
    if (!pc) return throwError(() => new Error('Character not found'));
    const updated = applyCastToPc(pc, spellName, atLevel);
    this.pcService.patchLocalPC(pcId, { spellSlots: updated.spellSlots, inventory: updated.inventory ?? [] });

    const state = this.stateSubject.getValue();
    if (state) {
      const participants = state.participants.map(p =>
        p.pcId === pcId ? { ...p, spellSlots: updated.spellSlots ?? null } : p);
      this.demoPatch({ participants });
    }
    return of({ pcId, spellSlots: updated.spellSlots, inventory: updated.inventory ?? [], warning: null });
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
      activeParticipantId: null,
      onDeckParticipantId: null,
      version: 0,
      dm: true,
      enemiesHidden: true,
      turnSound: null,
      shopOpen: false,
      shopForMe: false,
      shopCategory: null,
      lootStatus: null,
      lootName: null,
      myXp: null,
      gameTime: this.campaignService.getLocalCampaign(campaignId)?.gameTime ?? null,
      location: this.campaignService.getLocalCampaign(campaignId)?.location ?? null,
      weekDays: this.campaignService.getLocalCampaign(campaignId)?.weekDays ?? null,
      participants,
      rolls: [],
    };
  }

  private emptyState(sessionId: number | string): SessionState {
    return {
      sessionId, campaignId: '', status: 'LOBBY', round: 1,
      activeParticipantId: null, onDeckParticipantId: null, version: 0, dm: true,
      enemiesHidden: true, turnSound: null,
      shopOpen: false, shopForMe: false, shopCategory: null,
      lootStatus: null, lootName: null, myXp: null,
      gameTime: null, location: null, weekDays: null, participants: [], rolls: [],
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
      dexModifier: null,
      orderIndex: index,
      hpMax: pc.hp?.max ?? null,
      hpCurrent: pc.hp?.cur ?? null,
      hpTemp: pc.hp?.temp ?? null,
      ac: pc.ac ?? null,
      conditions: pc.conditions ?? [],
      survival: pc.survival ?? null,
      spellSlots: pc.spellSlots ?? null,
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
      activeParticipantId: raw.activeParticipantId ?? null,
      onDeckParticipantId: raw.onDeckParticipantId ?? null,
      version: raw.version,
      dm: !!raw.dm,
      enemiesHidden: !!raw.enemiesHidden,
      turnSound: raw.turnSound ?? null,
      shopOpen: !!raw.shopOpen,
      shopForMe: !!raw.shopForMe,
      shopCategory: raw.shopCategory ?? null,
      lootStatus: raw.lootStatus ?? null,
      lootName: raw.lootName ?? null,
      myXp: raw.myXp ?? null,
      gameTime: normalizeGameTime(this.parseJsonObject<CampaignGameTime>(raw.gameTime)),
      location: this.parseLocation(this.parseJsonObject<CampaignLocation>(raw.location)),
      weekDays: Array.isArray(raw.weekDays) && raw.weekDays.length ? raw.weekDays : null,
      participants: (raw.participants ?? []).map((p: any) => this.deserializeParticipant(p)),
      rolls: (raw.rolls ?? []).map((r: any) => this.deserializeRoll(r)),
    };
  }

  private deserializeRoll(r: any): SessionRollView {
    return {
      rollId: r.rollId,
      participantId: r.participantId,
      rollerName: r.rollerName,
      mine: !!r.mine,
      groups: (r.groups ?? []).map((g: any) => ({
        sides: g.sides,
        rolls: g.rolls ?? [],
        subtotal: g.subtotal ?? (g.rolls ?? []).reduce((a: number, b: number) => a + b, 0),
      })),
      grandTotal: r.grandTotal,
      createdAt: r.createdAt,
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
      dexModifier: p.dexModifier ?? null,
      orderIndex: p.orderIndex ?? 0,
      hpMax: p.hpMax ?? null,
      hpCurrent: p.hpCurrent ?? null,
      hpTemp: p.hpTemp ?? null,
      ac: p.ac ?? null,
      conditions: this.parseConditions(p.conditions),
      survival: this.parseJsonObject<PcSurvival>(p.survival),
      spellSlots: this.parseJsonObject<PC['spellSlots']>(p.spellSlots),
      deathSaveSuccesses: p.deathSaveSuccesses ?? 0,
      deathSaveFailures: p.deathSaveFailures ?? 0,
    };
  }

  /** Validate a parsed location map; null when unset or the type isn't one of
   *  the three recognized kinds. */
  private parseLocation(obj: CampaignLocation | null): CampaignLocation | null {
    if (!obj || typeof obj !== 'object') return null;
    if (!LOCATION_TYPES.includes(obj.type)) return null;
    return { name: typeof obj.name === 'string' ? obj.name : '', type: obj.type };
  }

  /** Tolerates an object, a JSON-string TEXT column, or null (→ null). */
  private parseJsonObject<T>(raw: any): T | null {
    if (raw && typeof raw === 'object') return raw as T;
    if (typeof raw === 'string' && raw.trim()) {
      try { return (JSON.parse(raw) ?? null) as T | null; } catch { return null; }
    }
    return null;
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
