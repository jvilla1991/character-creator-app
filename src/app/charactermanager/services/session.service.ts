import { Injectable, inject } from '@angular/core';
import { LootResultView } from '../models/loot';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, throwError, timer } from 'rxjs';
import { catchError, filter, map, switchMap, take, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  LongRestChoices,
  LongRestResultView,
  LongRestView,
  LongRestWaitView,
  FollowerCombatant,
  ParticipantView,
  RestType,
  RestVoteView,
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
import { FollowerService } from './follower.service';
import {
  SurvivalAction,
  advanceGameTime,
  applyConsumeToPc,
  applyLongRestToPc,
  applySegmentToPc,
  initialGameTime,
  normalizeGameTime,
  setGameTime,
} from '../utils/survival';
import { applyCastToPc } from '../utils/spellcasting';
import { applyShortRestToPc } from '../utils/class-resources';
import {
  LastLongRest, longRestFinishedAt, longRestWaitFor, segmentsForward, tickLongRest,
} from '../utils/long-rest-limit';
import { hitDieFor, modFromScore } from '../utils/character-math';

const POLL_INTERVAL_MS = 2000;

/** localStorage key for the per-device sound mute (player preference, not synced). */
const SOUND_MUTE_KEY = 'tm-session-sound-muted';

/** The per-device uploaded cue, stored as a data URL (player preference, not synced). */
const SOUND_CUSTOM_KEY = 'tm-session-sound-custom';

/** The per-device cue volume, 0–1 as a string (player preference, not synced). */
const SOUND_VOLUME_KEY = 'tm-session-sound-volume';

/**
 * The largest custom cue we will keep. localStorage holds roughly 5 MB per
 * origin and base64 inflates a file by about a third, so 1 MB of audio is the
 * safe ceiling — a turn cue is a half-second sound, not a song.
 */
export const MAX_CUE_BYTES = 1_000_000;

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

  // Read only in demo mode, to seat each demo PC's followers on the snapshot.
  private readonly followerService = inject(FollowerService);

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

  /**
   * Force-refetch the current session snapshot outside the poll cadence. Used
   * after actions that change PC-derived participant fields WITHOUT bumping the
   * session version (e.g. spending Heroic Inspiration via the PC endpoint) —
   * the poll's sinceVersion short-circuit would otherwise 204 forever and the
   * stale value would stick. No-op with no active session or in demo mode.
   */
  refresh(): void {
    const current = this.stateSubject.getValue();
    if (!current || environment.demoMode) return;
    this.getState(current.sessionId).pipe(take(1)).subscribe({
      error: () => { /* next poll will catch up */ },
    });
  }

  /**
   * A seated character's spell slots changed and the server has already said
   * what they are now (a slot spent or restored on the sheet). Written onto the
   * snapshot at once: the sheet embedded in the session reads its slots from
   * the snapshot, and would otherwise show the old count until the next poll
   * (which brings the same slots, since the change bumped the version). Does
   * nothing when no session is loaded or the character is not seated in it.
   */
  applySpellSlots(pcId: number, spellSlots: PC['spellSlots']): void {
    const state = this.stateSubject.getValue();
    if (!state || !state.participants.some(p => p.pcId === pcId)) return;
    const participants = state.participants.map(p =>
      p.pcId === pcId ? { ...p, spellSlots: spellSlots ?? null } : p);
    if (environment.demoMode) this.demoPatch({ participants });
    else this.pushState({ ...state, participants });
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
    this.announceFollowerChanges(state);
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

  // What each seated PC's followers looked like on the last snapshot, keyed by
  // PC id (the rows serialized: ids, names, HP, AC, conditions).
  private followerPrints = new Map<number, string>();

  /**
   * The snapshot is the one place a client learns that someone else touched a
   * follower: the DM granted or dismissed one, or damaged one from the
   * initiative order. When a PC's follower rows differ from the last snapshot,
   * say so through FollowerService, so the views holding their own copy (the
   * Followers tab, an open follower sheet) re-list. A PC's first appearance is
   * only a baseline; nothing has changed yet.
   */
  private announceFollowerChanges(state: SessionState | null): void {
    if (state == null) {
      this.followerPrints.clear();
      return;
    }
    const prints = new Map<number, string>();
    for (const p of state.participants) {
      if (p.pcId == null) continue;
      const print = JSON.stringify(p.followers ?? []);
      prints.set(p.pcId, print);
      const before = this.followerPrints.get(p.pcId);
      if (before !== undefined && before !== print) this.followerService.notifyChanged(p.pcId);
    }
    this.followerPrints = prints;
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
   * The per-device uploaded cue as a data URL, or null when none is set. Like
   * the mute, this is a local override: it replaces whichever preset the DM
   * chose, and the DM's choice still syncs to everyone else untouched.
   */
  customCue(): string | null {
    try {
      return localStorage.getItem(SOUND_CUSTOM_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Store an uploaded cue (a data URL), or clear it with null. Returns false
   * when storage refuses the write — almost always the quota, which the caller
   * must surface rather than leaving the upload silently forgotten.
   */
  setCustomCue(dataUrl: string | null): boolean {
    try {
      if (dataUrl) localStorage.setItem(SOUND_CUSTOM_KEY, dataUrl);
      else localStorage.removeItem(SOUND_CUSTOM_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /** Cue volume, 0–1. Defaults to 1 — the level the presets were tuned at. */
  cueVolume(): number {
    try {
      const raw = localStorage.getItem(SOUND_VOLUME_KEY);
      if (raw == null) return 1;
      const value = Number(raw);
      // A corrupt or out-of-range entry falls back to full volume rather than
      // leaving the tracker mysteriously silent.
      if (!isFinite(value) || value < 0 || value > 1) return 1;
      return value;
    } catch {
      return 1;
    }
  }

  setCueVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, isFinite(volume) ? volume : 1));
    try {
      localStorage.setItem(SOUND_VOLUME_KEY, String(clamped));
    } catch {
      // storage unavailable — the cue just plays at its default level
    }
  }

  /**
   * Play the turn cue — the per-device uploaded sound when there is one, else
   * the named preset synthesized with WebAudio (no audio assets to ship).
   * Public so the DM's sound picker can preview a cue on selection. Failures
   * are swallowed — a blocked AudioContext must never break the tracker.
   */
  playCue(key: string): void {
    if (this.isMuted()) return;
    const volume = this.cueVolume();
    if (volume <= 0) return;           // slider at zero is a mute by another name
    const custom = this.customCue();
    if (custom) {
      this.playUploadedCue(custom, volume);
      return;
    }
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
      gain.gain.setValueAtTime(0.25 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.decay);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + preset.decay);
    } catch {
      // audio unavailable (autoplay policy, no device) — stay silent
    }
  }

  /**
   * Play an uploaded cue from its data URL. A plain HTMLAudioElement rather
   * than the WebAudio graph: the file is already encoded audio, and decoding it
   * into a buffer would buy nothing for a one-shot sound. Failures stay silent
   * for the same reason the synthesized path does.
   */
  private playUploadedCue(dataUrl: string, volume: number): void {
    try {
      const el = new Audio(dataUrl);
      el.volume = volume;
      void el.play().catch(() => {
        // autoplay policy or an unsupported codec — stay silent
      });
    } catch {
      // no audio element available — stay silent
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

  /** DM adds an enemy (optional AC — reference info — and optional HP); it parks at the bottom. */
  addEnemy(sessionId: number | string, name: string, armorClass: number | null,
           hpMax: number | null): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoAddEnemy(name, armorClass, hpMax));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/enemies`, {
      name, armorClass, hpMax,
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

  /**
   * DM sets enemy visibility: hidden entirely, visible, or visible with health
   * hidden. `enemyHpHidden` rides along on every call so the two flags stay in
   * one request (the server treats a null as "leave unchanged" for old clients).
   */
  setVisibility(sessionId: number | string, enemiesHidden: boolean,
                enemyHpHidden = false): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoPatch({ enemiesHidden, enemyHpHidden }));
    return this.http.put<unknown>(
      `${this.sessionBase}/${sessionId}/visibility`, { enemiesHidden, enemyHpHidden },
    ).pipe(
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
   * DM opens a long rest phase for the seated party, with no vote. Nothing is
   * recovered yet: the phase arrives on the snapshot (`longRest`), players mark
   * Ready, and recovery lands on finishLongRest or the last Ready.
   */
  openLongRest(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoOpenLongRest());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/long-rest`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * A player marks their own seated hero ready (or not) for the open long
   * rest. A Ready carries the hero's choices (prepared spells, rune weapon);
   * the server checks them now and applies them when the rest finishes.
   * Taking Ready back discards them.
   */
  setLongRestReady(
    sessionId: number | string, pcId: number, ready: boolean, choices: LongRestChoices = {},
  ): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoSetLongRestReady(pcId, ready, choices));
    const body = ready ? { pcId, ready, ...choices } : { pcId, ready };
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/long-rest/ready`, body).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * DM sets the open long rest's options. Send only what changed:
   * `advanceClock` (move the clock to the next morning on finish) and
   * `undisturbed` (survival fatigue relief of 3, or 1 when false).
   */
  setLongRestOptions(
    sessionId: number | string,
    options: { advanceClock?: boolean; undisturbed?: boolean },
  ): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoSetLongRestOptions(options));
    return this.http.put<unknown>(`${this.sessionBase}/${sessionId}/long-rest/options`, options).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => { this.pushState(state); }),
    );
  }

  /** DM finishes the open long rest now: every seated hero recovers. */
  finishLongRest(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoFinishLongRest());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/long-rest/finish`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => { this.pushState(state); this.mirrorGameTime(state); }),
    );
  }

  /** DM interrupts the open long rest: the phase closes and nobody recovers. */
  interruptLongRest(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoInterruptLongRest());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/long-rest/interrupt`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * DM announces (or calls off) a short rest — toggles the session's
   * shortRestOpen window, during which seated players may spend hit dice.
   * Server-authoritative and version-bumped so every sheet sees the window.
   */
  shortRest(sessionId: number | string): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoShortRest());
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/short-rest`, {}).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** Demo mirror: flip the short-rest window on the in-memory state. */
  private demoShortRest(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (state.shortRestOpen) return this.demoPatch({ shortRestOpen: false });
    return this.demoPatch({ shortRestOpen: true, participants: this.demoShortRestRecovery(state) });
  }

  /**
   * Demo mirror of what opening a short rest gives every seated hero: the
   * class resources that return on one, and a Warlock's Pact Magic slots.
   * Returns the participants with their slots brought up to date.
   */
  private demoShortRestRecovery(state: SessionState): ParticipantView[] {
    return state.participants.map(p => {
      if (p.pcId == null) return p;
      const pc = this.pcService.getPCById(p.pcId);
      if (!pc) return p;
      const rested = applyShortRestToPc(pc);
      if (rested === pc) return p;
      this.pcService.patchLocalPC(p.pcId, { classResources: rested.classResources, spellSlots: rested.spellSlots });
      return { ...p, spellSlots: rested.spellSlots ?? p.spellSlots };
    });
  }

  /**
   * A seated player calls a rest: opens a 60-second unanimous vote among
   * every seated PC (the caller's ballot is pre-set to yes). A passed SHORT
   * vote opens the same shortRestOpen window as the DM's toggle; a passed LONG
   * vote opens the long rest phase. The vote itself arrives on the snapshot
   * (`restVote`) via the poll.
   */
  initiateRestVote(sessionId: number | string, restType: RestType = 'SHORT'): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoInitiateRestVote(restType));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/rest-vote`, { restType }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** Answer the active rest vote with this player's ballot (true = yes). */
  castRestVote(sessionId: number | string, vote: boolean): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoCastRestVote(vote));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/rest-vote/cast`, { vote }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** DM override on the active vote: true ends it passed now, false ends it failed. */
  overrideRestVote(sessionId: number | string, vote: boolean): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoOverrideRestVote(vote));
    return this.http.post<unknown>(`${this.sessionBase}/${sessionId}/rest-vote/override`, { vote }).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /**
   * Demo mirror: a solo table is unanimity of one, so the vote passes on the
   * spot — the rest window (SHORT) or the long rest phase (LONG) opens with no
   * fake 60-second wait.
   */
  private demoInitiateRestVote(restType: RestType = 'SHORT'): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (restType === 'LONG' && state.longRestWait) return state; // inside the 24-hour wait
    const me = state.participants.find(p => p.pcId != null);
    const restVote: RestVoteView = {
      voteId: Date.now(),
      status: 'PASSED',
      restType,
      initiatorParticipantId: me?.participantId ?? null,
      initiatorName: me?.name ?? 'You',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      votes: me ? [{ participantId: me.participantId, displayName: me.name, vote: true }] : [],
    };
    return this.demoPatch({ restVote, ...this.demoRestPassed(state, restType) });
  }

  /** Demo mirror: settle the (already terminal) vote per the ballot cast. */
  private demoCastRestVote(vote: boolean): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (!state.restVote) return state;
    return this.demoPatch({
      restVote: { ...state.restVote, status: vote ? 'PASSED' : 'FAILED' },
      ...(vote ? this.demoRestPassed(state, state.restVote.restType)
        : { shortRestOpen: false, longRest: null }),
    });
  }

  /** Demo mirror of the DM override: pass now or fail now. */
  private demoOverrideRestVote(vote: boolean): SessionState {
    return this.demoCastRestVote(vote);
  }

  /** Demo: what a passed vote opens — the hit-dice window or the long rest phase. */
  private demoRestPassed(state: SessionState, restType: RestType): Partial<SessionState> {
    return restType === 'LONG'
      ? { shortRestOpen: false, longRest: this.demoLongRestView(state) }
      : { shortRestOpen: true, participants: this.demoShortRestRecovery(state) };
  }

  /** Demo: a fresh phase for the seated heroes — nobody ready, default options. */
  private demoLongRestView(state: SessionState): LongRestView {
    const readiness = state.participants.filter(p => p.pcId != null).map(p => {
      const pc = this.pcService.getPCById(p.pcId!);
      return {
        participantId: p.participantId,
        pcId: p.pcId,
        displayName: p.name,
        ready: false,
        cannotRest: p.hpCurrent != null && p.hpCurrent <= 0,
        clazz: pc?.clazz ?? p.clazz,
        subclass: pc?.subclass ?? null,
        specialization: pc?.specialization ?? null,
        level: pc?.level ?? p.level,
      };
    });
    return {
      advanceClock: true,
      undisturbed: true,
      readyCount: 0,
      ableCount: readiness.filter(r => !r.cannotRest).length,
      readiness,
      myChoices: null,
    };
  }

  /** Demo: the last finished long rest (the server keeps this on the campaign). */
  private demoLastLongRest: LastLongRest | null = null;

  /** Demo: each ready hero's pending long rest choices, by PC id (the server keeps these on the seat). */
  private demoLongRestChoices = new Map<number, LongRestChoices>();

  /** Demo mirror: the DM opens the phase without a vote. */
  private demoOpenLongRest(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (state.longRest || state.longRestWait) return state; // already open, or inside the 24-hour wait
    this.demoLongRestChoices.clear();
    return this.demoPatch({ shortRestOpen: false, longRest: this.demoLongRestView(state) });
  }

  /** Demo mirror: mark one hero ready; the last Ready finishes the rest. */
  private demoSetLongRestReady(pcId: number, ready: boolean, choices: LongRestChoices = {}): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (!state.longRest) return state;
    const chose = ready && (choices.preparedSpells != null || !!choices.runeWeapon);
    if (chose) this.demoLongRestChoices.set(pcId, choices);
    else this.demoLongRestChoices.delete(pcId);
    const readiness = state.longRest.readiness.map(r =>
      r.pcId === pcId && !r.cannotRest ? { ...r, ready } : r);
    const readyCount = readiness.filter(r => r.ready).length;
    const longRest = { ...state.longRest, readiness, readyCount, myChoices: chose ? choices : null };
    this.demoPatch({ longRest });
    const settled = longRest.ableCount > 0 && readyCount === longRest.ableCount;
    return settled ? this.demoFinishLongRest() : this.stateSubject.getValue()!;
  }

  /** Demo mirror of the DM's phase options. */
  private demoSetLongRestOptions(options: { advanceClock?: boolean; undisturbed?: boolean }): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (!state.longRest) return state;
    return this.demoPatch({ longRest: { ...state.longRest, ...options } });
  }

  /**
   * Demo mirror of the finish: the clock walks to the next morning first (a
   * segment at a time, so survival bumps apply), then every seated hero above
   * 0 Hit Points recovers.
   */
  private demoFinishLongRest(): SessionState {
    const before = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const phase = before.longRest;
    if (!phase) return before;
    const skipped = phase.readiness.filter(r => r.cannotRest).map(r => r.displayName);
    const skippedIds = new Set(phase.readiness.filter(r => r.cannotRest).map(r => r.pcId));

    if (phase.advanceClock) {
      if (before.gameTime == null) {
        this.demoAdvanceTime(); // establishes day 1 morning, no bumps
      } else {
        for (let step = 0; step < 3; step++) {
          this.demoAdvanceTime();
          if (this.stateSubject.getValue()?.gameTime?.timeOfDay === 'morning') break;
        }
      }
    }

    const state = this.stateSubject.getValue() ?? before;
    // Remember when the rest finished — unless nobody ever set the clock.
    if (state.gameTime) this.demoLastLongRest = longRestFinishedAt(state.gameTime.timeOfDay);
    const survivalOn = !!this.campaignService.getLocalCampaign(state.campaignId)?.variantRules?.survivalConditions;
    const participants = state.participants.map(p => {
      if (p.pcId == null || skippedIds.has(p.pcId)) return p;
      const pc = this.pcService.getPCById(p.pcId);
      if (!pc) return p;
      // Only a hero who readied has their choices applied; the others keep
      // their spells and rune weapon as they were.
      const isReady = phase.readiness.some(r => r.pcId === p.pcId && r.ready);
      const updated = applyLongRestToPc(pc, phase.undisturbed, survivalOn,
        isReady ? this.demoLongRestChoices.get(p.pcId) : undefined);
      this.pcService.patchLocalPC(p.pcId, {
        spellSlots: updated.spellSlots, survival: updated.survival, hp: updated.hp,
        hitDiceUsed: updated.hitDiceUsed, exhaustion: updated.exhaustion,
        spells: updated.spells, runeWeapon: updated.runeWeapon, classResources: updated.classResources,
      });
      return {
        ...p,
        survival: updated.survival ?? p.survival,
        spellSlots: updated.spellSlots ?? p.spellSlots,
        hpCurrent: updated.hp?.cur ?? p.hpCurrent,
        hpTemp: updated.hp?.temp ?? p.hpTemp,
        hitDiceUsed: updated.hitDiceUsed ?? p.hitDiceUsed,
      };
    });
    this.demoLongRestChoices.clear();
    return this.demoPatch({
      participants,
      longRest: null,
      longRestResult: this.demoLongRestResult('FINISHED', skipped, phase.advanceClock),
    });
  }

  /** Demo mirror of the interrupt: the phase closes, nobody recovers. */
  private demoInterruptLongRest(): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    if (!state.longRest) return state;
    this.demoLongRestChoices.clear();
    return this.demoPatch({
      longRest: null,
      longRestResult: this.demoLongRestResult('INTERRUPTED', [], false),
    });
  }

  private demoLongRestResult(
    outcome: LongRestResultView['outcome'], skipped: string[], clockAdvanced: boolean,
  ): LongRestResultView {
    return { id: Date.now(), outcome, skipped, clockAdvanced, createdAt: new Date().toISOString() };
  }

  /**
   * A player spends one of their own seated PC's hit dice while the DM's
   * short-rest window is open. The server rolls 1d[hitDie] + CON mod (healing
   * floored at 1, capped at max HP), increments the spent count (max = level),
   * and bumps the version. The result patches the local PC store so the open
   * sheet updates without a refetch (same pattern as cast/consume).
   */
  spendHitDie(sessionId: number | string, pcId: number):
      Observable<{ roll: number; healed: number; hpCurrent: number; hitDiceUsed: number }> {
    if (environment.demoMode) return this.demoSpendHitDie(pcId);
    return this.http.post<{ roll: number; healed: number; hpCurrent: number; hitDiceUsed: number }>(
      `${this.sessionBase}/${sessionId}/hit-dice/spend`, { pcId },
    ).pipe(
      tap(result => {
        const pc = this.pcService.getPCById(pcId);
        this.pcService.patchLocalPC(pcId, {
          hitDiceUsed: result.hitDiceUsed,
          ...(pc?.hp ? { hp: { ...pc.hp, cur: result.hpCurrent } } : {}),
        });
      }),
    );
  }

  /** Demo mirror of the hit-die spend: same rules, rolled locally. */
  private demoSpendHitDie(pcId: number):
      Observable<{ roll: number; healed: number; hpCurrent: number; hitDiceUsed: number }> {
    const state = this.stateSubject.getValue();
    if (!state?.shortRestOpen) return throwError(() => new Error('No short rest is in progress'));
    const pc = this.pcService.getPCById(pcId);
    if (!pc) return throwError(() => new Error('Character not found'));
    const level = pc.level ?? 1;
    const used = pc.hitDiceUsed ?? 0;
    if (used >= level) return throwError(() => new Error('No hit dice remaining'));

    const hitDie = hitDieFor(pc.clazz);
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const heal = Math.max(1, roll + modFromScore(pc.stats?.CON ?? 10));
    const cur = pc.hp?.cur ?? 0;
    const max = pc.hp?.max ?? cur + heal;
    const hpCurrent = Math.min(cur + heal, max);
    const healed = hpCurrent - cur;
    const hitDiceUsed = used + 1;

    this.pcService.patchLocalPC(pcId, {
      hitDiceUsed,
      hp: { cur: hpCurrent, max: pc.hp?.max ?? hpCurrent, temp: pc.hp?.temp ?? 0 },
    });
    const participants = state.participants.map(p =>
      p.pcId === pcId ? { ...p, hpCurrent, hitDiceUsed } : p);
    this.demoPatch({ participants });
    return of({ roll, healed, hpCurrent, hitDiceUsed });
  }

  /**
   * DM sets a seated PC's inspiration meter by clicking a pip in the tracker —
   * raising or lowering it. Filling the meter converts into Heroic Inspiration
   * server-side (meter empties, badge lights). The refreshed snapshot carries
   * the new meter for every viewer.
   */
  setInspiration(sessionId: number | string, participantId: number, pips: number):
      Observable<SessionState> {
    if (environment.demoMode) return of(this.demoSetInspiration(participantId, pips));
    return this.http.put<unknown>(
      `${this.sessionBase}/${sessionId}/participants/${participantId}/inspiration`, { pips },
    ).pipe(
      map(raw => this.deserialize(raw)),
      tap(state => this.pushState(state)),
    );
  }

  /** Demo mirror: store the clicked value; a full meter converts to Heroic Inspiration. */
  private demoSetInspiration(participantId: number, pips: number): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const value = Math.max(0, Math.min(5, pips));
    const participants = state.participants.map(p => {
      if (p.participantId !== participantId || p.pcId == null) return p;
      const patch = value >= 5
        ? { inspirationPips: 0, heroicInspiration: true }
        : { inspirationPips: value };
      this.pcService.patchLocalPC(p.pcId, patch);
      return { ...p, ...patch };
    });
    return this.demoPatch({ participants });
  }

  /**
   * A player casts one of their own seated PC's spells. Server-authoritative
   * (the slot spend and component consumption happen there and bump the poll
   * version so the DM sees it live); the result patches the local PC store so an
   * open sheet updates without a refetch, and a non-null `warning` (missing
   * costly component in a lenient campaign) is surfaced to the caller.
   *
   * `ritual` casts the spell as a ritual: no slot is spent and `atLevel` is not
   * used. The server refuses it (409) unless the spell is leveled and marked as
   * a ritual. The flag is only sent when set, so an ordinary cast is the same
   * request it always was.
   */
  castSpell(sessionId: number | string, pcId: number, spellName: string, atLevel: number, ritual = false):
      Observable<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }> {
    if (environment.demoMode) return this.demoCast(pcId, spellName, atLevel, ritual);
    return this.http.post<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }>(
      `${this.sessionBase}/${sessionId}/spell/cast`,
      ritual ? { pcId, spellName, atLevel, ritual: true } : { pcId, spellName, atLevel },
    ).pipe(
      tap(result => {
        this.pcService.patchLocalPC(pcId, {
          spellSlots: result.spellSlots,
          inventory: result.inventory ?? [],
        });
        // The embedded sheet reads its slots from the snapshot: show the spend now, not on the next poll.
        this.applySpellSlots(pcId, result.spellSlots);
      }),
    );
  }

  /**
   * A player improves their own seated PC's survival condition (Eat/Drink).
   * Server-authoritative: the supply charge is spent on the canonical pc row
   * and the version bump shows every viewer the new stages. The result patches
   * the local PC store so the open sheet updates without a refetch (same
   * pattern as the sell/cast flows). Demo mirrors it locally.
   */
  consumeSurvival(sessionId: number | string, pcId: number, action: SurvivalAction):
      Observable<{ pcId: number; survival: PcSurvival; inventory: PcItem[] }> {
    if (environment.demoMode) return this.demoConsumeSurvival(pcId, action);
    return this.http.post<{ pcId: number; survival: PcSurvival; inventory: PcItem[] }>(
      `${this.sessionBase}/${sessionId}/survival/consume`, { pcId, action },
    ).pipe(
      tap(result => this.pcService.patchLocalPC(pcId, {
        survival: result.survival,
        inventory: result.inventory ?? [],
      })),
    );
  }

  /** Demo mirror of the consume endpoint (shared reducer, local persistence + version bump). */
  private demoConsumeSurvival(pcId: number, action: SurvivalAction):
      Observable<{ pcId: number; survival: PcSurvival; inventory: PcItem[] }> {
    const pc = this.pcService.getPCById(pcId);
    if (!pc) return throwError(() => new Error('Character not found'));
    const updated = applyConsumeToPc(pc, action);
    this.pcService.patchLocalPC(pcId, { survival: updated.survival, inventory: updated.inventory ?? [] });

    const state = this.stateSubject.getValue();
    if (state) {
      const participants = state.participants.map(p =>
        p.pcId === pcId ? { ...p, survival: updated.survival ?? null } : p);
      this.demoPatch({ participants });
    }
    return of({ pcId, survival: updated.survival!, inventory: updated.inventory ?? [] });
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
   * DM damages (positive) or heals (negative) a seated PC's follower. Same
   * body and same snapshot reply as {@link applyDamage}; the follower's own
   * stat block takes the change.
   */
  damageFollower(sessionId: number | string, followerId: number, amount: number): Observable<SessionState> {
    if (environment.demoMode) return of(this.demoDamageFollower(followerId, amount));
    return this.http.post<unknown>(
      `${this.sessionBase}/${sessionId}/followers/${followerId}/damage`, { amount },
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
   * the backend's comparator (initiative desc, unset last → stable id). The
   * pointer is an id, so it survives the re-sort untouched — same late-entry
   * semantics as the real server.
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

  /** The backend's turn-order comparator, mirrored for demo mode: initiative
   *  desc (unset last), then insertion (id) order — no DEX tie-break layer. */
  private demoSort(participants: ParticipantView[]): ParticipantView[] {
    const sorted = [...participants].sort((a, b) =>
      ((b.initiative ?? -999) - (a.initiative ?? -999))
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

  /** Demo: the follower's row on the snapshot takes the damage/heal, by the
   *  same rules as {@link demoDamage} (temp HP first, healing capped at max). */
  private demoDamageFollower(followerId: number, amount: number): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const participants = state.participants.map(p => {
      if (!p.followers.some(f => f.followerId === followerId)) return p;
      const followers = p.followers.map(f => {
        if (f.followerId !== followerId) return f;
        let cur = f.hpCurrent ?? 0;
        let temp = f.hpTemp ?? 0;
        if (amount > 0) {
          const absorbed = Math.min(temp, amount);
          temp -= absorbed;
          cur = Math.max(0, cur - (amount - absorbed));
        } else if (amount < 0) {
          cur += -amount;
          if (f.hpMax != null) cur = Math.min(cur, f.hpMax);
        }
        return { ...f, hpCurrent: cur, hpTemp: temp };
      });
      return { ...p, followers };
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
  private demoAddEnemy(name: string, armorClass: number | null, hpMax: number | null): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const enemy: ParticipantView = {
      participantId: Date.now(), pcId: null, npc: true, ownedByMe: false, currentTurn: false,
      name, clazz: null, level: null, portraitTint: null, portraitInitials: null,
      initiative: null, initRolled: false, orderIndex: state.participants.length,
      hpMax, hpCurrent: hpMax, hpTemp: null, ac: armorClass, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      hitDiceUsed: null, inspirationPips: null, heroicInspiration: null, followers: [],
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
      initiative: null, initRolled: false, orderIndex: state.participants.length + i,
      hpMax: 7, hpCurrent: 7, hpTemp: null, ac: 15, conditions: [], survival: null, spellSlots: null,
      deathSaveSuccesses: 0, deathSaveFailures: 0,
      hitDiceUsed: null, inspirationPips: null, heroicInspiration: null, followers: [],
    }));
    const participants = this.demoSort([...state.participants, ...goblins]);
    const next = this.demoWithPointers({ ...state, participants, version: state.version + 1 });
    this.pushState(next);
    return next;
  }

  /** Demo: apply a session-settings patch (visibility, sound) locally. */
  private demoPatch(patch: Partial<SessionState>): SessionState {
    const state = this.stateSubject.getValue() ?? this.emptyState('demo-session');
    const merged = { ...state, ...patch, version: state.version + 1 };
    // One long rest every 24 hours: restated from the record on every change,
    // since the clock, a finished rest and a hand-set time all move it.
    const longRestWait = longRestWaitFor(this.demoLastLongRest, merged.gameTime?.timeOfDay);
    const next = { ...merged, longRestWait, longRestAvailable: longRestWait == null };
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
    if (current) this.demoLastLongRest = tickLongRest(this.demoLastLongRest);
    return of(this.demoPatch({ gameTime: next, participants }));
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
    // A hand-set time of day still passes segments; a new date alone does not.
    this.demoLastLongRest = tickLongRest(
      this.demoLastLongRest, segmentsForward(current.timeOfDay, next.timeOfDay));
    return of(this.demoPatch({ gameTime: next }));
  }


  /**
   * Demo mirror of the cast endpoint (shared reducer, local persistence + version bump).
   * A cast the server would refuse (no free slot, or a ritual cast of a spell that is
   * not a ritual) fails the same way: a 409 carrying the reason.
   */
  private demoCast(pcId: number, spellName: string, atLevel: number, ritual = false):
      Observable<{ pcId: number; spellSlots: PC['spellSlots']; inventory: PcItem[]; warning: string | null }> {
    const pc = this.pcService.getPCById(pcId);
    if (!pc) return throwError(() => new Error('Character not found'));
    let updated: PC;
    try {
      updated = applyCastToPc(pc, spellName, atLevel, ritual);
    } catch (refused) {
      return throwError(() => ({ status: 409, error: { message: (refused as Error).message } }));
    }
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
      enemyHpHidden: false,
      shortRestOpen: false,
      turnSound: null,
      shopOpen: false,
      shopForMe: false,
      shopCategory: null,
      lootStatus: null,
      lootName: null,
      myXp: null,
      myLevelGrant: null,
      gameTime: this.campaignService.getLocalCampaign(campaignId)?.gameTime ?? null,
      location: this.campaignService.getLocalCampaign(campaignId)?.location ?? null,
      weekDays: this.campaignService.getLocalCampaign(campaignId)?.weekDays ?? null,
      participants,
      rolls: [],
      restVote: null,
      lootResult: null,
      longRest: null,
      longRestResult: null,
      longRestAvailable: true,
      longRestWait: null,
    };
  }

  private emptyState(sessionId: number | string): SessionState {
    return {
      sessionId, campaignId: '', status: 'LOBBY', round: 1,
      activeParticipantId: null, onDeckParticipantId: null, version: 0, dm: true,
      enemiesHidden: true, enemyHpHidden: false, shortRestOpen: false, turnSound: null,
      lootStatus: null, lootName: null, myXp: null, myLevelGrant: null,
      shopOpen: false, shopForMe: false, shopCategory: null,
      gameTime: null, location: null, weekDays: null, participants: [], rolls: [],
      restVote: null, lootResult: null, longRest: null, longRestResult: null,
      longRestAvailable: true, longRestWait: null,
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
      survival: pc.survival ?? null,
      spellSlots: pc.spellSlots ?? null,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      hitDiceUsed: pc.hitDiceUsed ?? null,
      inspirationPips: pc.inspirationPips ?? null,
      heroicInspiration: pc.heroicInspiration ?? null,
      followers: this.followerService.demoList(pc.id).map(f => ({
        followerId: f.id,
        pcId: pc.id,
        name: f.name,
        clazz: f.statBlock.clazz ?? null,
        level: f.statBlock.level ?? null,
        portraitTint: f.statBlock.portraitTint ?? null,
        portraitInitials: f.statBlock.portraitInitials ?? null,
        hpMax: f.statBlock.hp?.max ?? null,
        hpCurrent: f.statBlock.hp?.cur ?? null,
        hpTemp: f.statBlock.hp?.temp ?? null,
        ac: f.statBlock.ac ?? null,
        conditions: f.statBlock.conditions ?? [],
      })),
    };
  }

  // --- serialize / deserialize seam ----------------------------------------

  private deserialize(raw: unknown): SessionState {
    const dto = raw as SessionStateDto;
    return {
      sessionId: dto.sessionId,
      campaignId: dto.campaignId,
      status: dto.status,
      round: dto.round,
      activeParticipantId: dto.activeParticipantId ?? null,
      onDeckParticipantId: dto.onDeckParticipantId ?? null,
      version: dto.version,
      dm: !!dto.dm,
      enemiesHidden: !!dto.enemiesHidden,
      enemyHpHidden: !!dto.enemyHpHidden,
      shortRestOpen: !!dto.shortRestOpen,
      turnSound: dto.turnSound ?? null,
      shopOpen: !!dto.shopOpen,
      shopForMe: !!dto.shopForMe,
      shopCategory: dto.shopCategory ?? null,
      lootStatus: dto.lootStatus ?? null,
      lootName: dto.lootName ?? null,
      myXp: dto.myXp ?? null,
      myLevelGrant: dto.myLevelGrant ?? null,
      gameTime: normalizeGameTime(this.parseJsonObject<CampaignGameTime>(dto.gameTime)),
      location: this.parseLocation(this.parseJsonObject<CampaignLocation>(dto.location)),
      weekDays: Array.isArray(dto.weekDays) && dto.weekDays.length ? dto.weekDays : null,
      participants: (dto.participants ?? []).map(p => this.deserializeParticipant(p)),
      rolls: (dto.rolls ?? []).map(r => this.deserializeRoll(r)),
      restVote: dto.restVote ? this.deserializeRestVote(dto.restVote) : null,
      lootResult: dto.lootResult
        ? { ...dto.lootResult, pvpCallers: dto.lootResult.pvpCallers ?? [] }
        : null,
      longRest: dto.longRest ? this.deserializeLongRest(dto.longRest) : null,
      longRestResult: dto.longRestResult
        ? {
            id: dto.longRestResult.id,
            outcome: dto.longRestResult.outcome,
            skipped: dto.longRestResult.skipped ?? [],
            clockAdvanced: !!dto.longRestResult.clockAdvanced,
            createdAt: dto.longRestResult.createdAt ?? null,
          }
        : null,
      // A backend that predates the 24-hour rule sends neither: no wait.
      longRestWait: dto.longRestWait ?? null,
      longRestAvailable: dto.longRestWait == null && dto.longRestAvailable !== false,
    };
  }

  private deserializeLongRest(v: LongRestDto): LongRestView {
    const readiness = (v.readiness ?? []).map(r => ({
      participantId: r.participantId,
      pcId: r.pcId ?? null,
      displayName: r.displayName,
      ready: !!r.ready,
      cannotRest: !!r.cannotRest,
      clazz: r.clazz ?? null,
      subclass: r.subclass ?? null,
      specialization: r.specialization ?? null,
      level: r.level ?? null,
    }));
    return {
      // Both options default to on, like the server's.
      advanceClock: v.advanceClock !== false,
      undisturbed: v.undisturbed !== false,
      readyCount: v.readyCount ?? readiness.filter(r => r.ready).length,
      ableCount: v.ableCount ?? readiness.filter(r => !r.cannotRest).length,
      readiness,
      myChoices: v.myChoices
        ? {
            ...(v.myChoices.preparedSpells ? { preparedSpells: v.myChoices.preparedSpells } : {}),
            ...(v.myChoices.runeWeapon ? { runeWeapon: v.myChoices.runeWeapon } : {}),
          }
        : null,
    };
  }

  private deserializeRestVote(v: RestVoteDto): RestVoteView {
    return {
      voteId: v.voteId,
      status: v.status,
      restType: v.restType === 'LONG' ? 'LONG' : 'SHORT',
      initiatorParticipantId: v.initiatorParticipantId ?? null,
      initiatorName: v.initiatorName,
      expiresAt: v.expiresAt,
      votes: (v.votes ?? []).map(b => ({
        participantId: b.participantId,
        displayName: b.displayName,
        vote: b.vote ?? null,
      })),
    };
  }

  private deserializeRoll(r: SessionRollDto): SessionRollView {
    return {
      rollId: r.rollId,
      participantId: r.participantId,
      rollerName: r.rollerName,
      mine: !!r.mine,
      groups: (r.groups ?? []).map(g => ({
        sides: g.sides,
        rolls: g.rolls ?? [],
        subtotal: g.subtotal ?? (g.rolls ?? []).reduce((a, b) => a + b, 0),
      })),
      grandTotal: r.grandTotal,
      createdAt: r.createdAt,
    };
  }

  private deserializeParticipant(p: ParticipantDto): ParticipantView {
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
      survival: this.parseJsonObject<PcSurvival>(p.survival),
      spellSlots: this.parseJsonObject<PC['spellSlots']>(p.spellSlots),
      deathSaveSuccesses: p.deathSaveSuccesses ?? 0,
      deathSaveFailures: p.deathSaveFailures ?? 0,
      hitDiceUsed: p.hitDiceUsed ?? null,
      inspirationPips: p.inspirationPips ?? null,
      heroicInspiration: p.heroicInspiration ?? null,
      followers: Array.isArray(p.followers) ? p.followers.map(f => this.deserializeFollower(f)) : [],
    };
  }

  private deserializeFollower(f: FollowerCombatantDto): FollowerCombatant {
    return {
      followerId: f.followerId,
      pcId: f.pcId,
      name: f.name,
      clazz: f.clazz ?? null,
      level: f.level ?? null,
      portraitTint: f.portraitTint ?? null,
      portraitInitials: f.portraitInitials ?? null,
      hpMax: f.hpMax ?? null,
      hpCurrent: f.hpCurrent ?? null,
      hpTemp: f.hpTemp ?? null,
      ac: f.ac ?? null,
      conditions: this.parseConditions(f.conditions),
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
  private parseJsonObject<T>(raw: unknown): T | null {
    if (raw && typeof raw === 'object') return raw as T;
    if (typeof raw === 'string' && raw.trim()) {
      try { return (JSON.parse(raw) ?? null) as T | null; } catch { return null; }
    }
    return null;
  }

  /** Backend sends conditions as a JSON string (PC.conditions); normalize to an array. */
  private parseConditions(raw: unknown): string[] {
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

// --- wire DTOs --------------------------------------------------------------
// Raw shapes of the backend SessionStateView / ParticipantView / roll payloads
// BEFORE the deserializer runs: JSON-string TEXT columns (gameTime, location,
// conditions, survival, spellSlots) are still unparsed, and most fields may be
// absent — the deserializer supplies the defaults.

interface SessionStateDto {
  sessionId: SessionState['sessionId'];
  campaignId: SessionState['campaignId'];
  status: SessionState['status'];
  round: number;
  activeParticipantId?: number | null;
  onDeckParticipantId?: number | null;
  version: number;
  dm?: boolean;
  enemiesHidden?: boolean;
  enemyHpHidden?: boolean;
  shortRestOpen?: boolean;
  turnSound?: string | null;
  shopOpen?: boolean;
  shopForMe?: boolean;
  shopCategory?: string | null;
  lootStatus?: SessionState['lootStatus'];
  lootName?: string | null;
  myXp?: number | null;
  myLevelGrant?: boolean | null;
  gameTime?: unknown;
  location?: unknown;
  weekDays?: string[] | null;
  participants?: ParticipantDto[];
  rolls?: SessionRollDto[];
  restVote?: RestVoteDto | null;
  lootResult?: LootResultView | null;
  longRest?: LongRestDto | null;
  longRestAvailable?: boolean;
  longRestWait?: LongRestWaitView | null;
  longRestResult?: {
    id: number;
    outcome: LongRestResultView['outcome'];
    skipped?: string[] | null;
    clockAdvanced?: boolean;
    createdAt?: string | null;
  } | null;
}

interface LongRestDto {
  advanceClock?: boolean;
  undisturbed?: boolean;
  readyCount?: number;
  ableCount?: number;
  readiness?: Array<{
    participantId: number; pcId?: number | null; displayName: string;
    ready?: boolean; cannotRest?: boolean;
    clazz?: string | null; subclass?: string | null; specialization?: string | null; level?: number | null;
  }>;
  myChoices?: { preparedSpells?: string[] | null; runeWeapon?: string | null } | null;
}

interface RestVoteDto {
  voteId: number;
  status: RestVoteView['status'];
  restType?: string | null;
  initiatorParticipantId?: number | null;
  initiatorName: string;
  expiresAt: string;
  votes?: Array<{ participantId: number; displayName: string; vote?: boolean | null }>;
}

interface ParticipantDto {
  participantId: number;
  pcId?: number | null;
  npc?: boolean;
  ownedByMe?: boolean;
  currentTurn?: boolean;
  name: string;
  clazz?: string | null;
  level?: number | null;
  portraitTint?: string | null;
  portraitInitials?: string | null;
  initiative?: number | null;
  initRolled?: boolean;
  orderIndex?: number | null;
  hpMax?: number | null;
  hpCurrent?: number | null;
  hpTemp?: number | null;
  ac?: number | null;
  conditions?: unknown;
  survival?: unknown;
  spellSlots?: unknown;
  deathSaveSuccesses?: number | null;
  deathSaveFailures?: number | null;
  hitDiceUsed?: number | null;
  inspirationPips?: number | null;
  heroicInspiration?: boolean | null;
  followers?: FollowerCombatantDto[] | null;
}

interface FollowerCombatantDto {
  followerId: number;
  pcId: number;
  name: string;
  clazz?: string | null;
  level?: number | null;
  portraitTint?: string | null;
  portraitInitials?: string | null;
  hpMax?: number | null;
  hpCurrent?: number | null;
  hpTemp?: number | null;
  ac?: number | null;
  conditions?: unknown;
}

interface SessionRollDto {
  rollId: number;
  participantId: number;
  rollerName: string;
  mine?: boolean;
  groups?: Array<{ sides: number; rolls?: number[]; subtotal?: number }>;
  grandTotal: number;
  createdAt: string;
}
