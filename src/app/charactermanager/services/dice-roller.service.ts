import { Injectable, signal } from '@angular/core';
import { take } from 'rxjs/operators';
import { PC } from '../models/pc';
import { SessionState } from '../models/session';
import { PCService } from './pc.service';
import { SessionService } from './session.service';
import { UiStateService } from './ui-state.service';

/**
 * The single entry point for the app-wide dice roller.
 *
 * The roller used to be mounted twice — once inside the character sheet and
 * once inside Session Mode — so it was only reachable from those two screens,
 * and only players (never the DM) ever saw a button for it. Now one copy lives
 * in the app shell and every trigger (the floating launcher, the sheet's dice
 * icon, Session Mode's Roll button, the "r" shortcut) calls `open()` here.
 *
 * Open/close state lives in UiStateService alongside the other non-route
 * overlays, which is what gets the browser Back button to close the roller for
 * free. This service adds the part the overlays don't have: working out, at the
 * moment of opening, whether the roll should be logged to a live session's
 * Roll Log, and for which seat.
 */
@Injectable()
export class DiceRollerService {
  /** Mirrors the shell overlay flag so callers only ever touch this service. */
  readonly isOpen = this.uiState.diceOpen;

  /** Only personalises the modal's title; null is fine (e.g. for the DM). */
  private readonly _pc = signal<PC | null>(null);
  readonly pc = this._pc.asReadonly();

  // Both ids are needed before the modal logs anything; either one null means
  // "this roll goes nowhere but the player's own screen".
  private readonly _sessionId = signal<number | string | null>(null);
  readonly sessionId = this._sessionId.asReadonly();
  private readonly _participantId = signal<number | null>(null);
  readonly participantId = this._participantId.asReadonly();

  /** Invalidates an in-flight lookup if the roller is reopened before it lands. */
  private resolveToken = 0;

  constructor(
    private uiState: UiStateService,
    private pcService: PCService,
    private sessionService: SessionService,
  ) {}

  /**
   * Open the roller from anywhere.
   *
   * The modal appears immediately and the session context is filled in behind
   * it. That is safe — and deliberately lazy — because the modal only reads
   * sessionId/participantId when a *settled* roll is logged, which is over a
   * second after the dice are thrown. Resolving on every open also fixes the
   * old sheet-side gap, where a session started while the sheet was already
   * open went unnoticed until the player switched characters.
   */
  open(): void {
    this.resolveContext();
    this.uiState.openDice();
  }

  close(): void {
    this.uiState.closeDice();
  }

  // ── Session context ────────────────────────────────────────────────────────

  private resolveContext(): void {
    const token = ++this.resolveToken;
    this._pc.set(null);
    this._sessionId.set(null);
    this._participantId.set(null);

    // state$ is BehaviorSubject-backed, so this emits synchronously: Session
    // Mode already polls an authoritative snapshot, and when it is open that
    // snapshot is the answer. Otherwise fall back to asking the backend.
    this.sessionService.state$.pipe(take(1)).subscribe(live => {
      if (live && live.status !== 'ENDED') this.applyLiveSeat(live);
      else this.resolveFromCampaign(token);
    });
  }

  /** Session Mode is open — read the viewer's seat straight off the snapshot. */
  private applyLiveSeat(state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe);
    // A DM holds no seat of their own, so their rolls stay private — exactly
    // what the modal already does when either id is missing.
    if (!mine) return;
    this._sessionId.set(state.sessionId);
    this._participantId.set(mine.participantId);
    this._pc.set((mine.pcId != null ? this.pcService.getPCById(mine.pcId) : null) ?? null);
  }

  /**
   * No Session Mode on screen (the sheet, the campaign dashboard, a shop…):
   * ask whether the active character's campaign has a session running that the
   * player is already seated in. No session, no campaign, or an unseated PC all
   * leave the ids null and the roll private.
   */
  private resolveFromCampaign(token: number): void {
    this.pcService.getActivePC().pipe(take(1)).subscribe(pc => {
      this._pc.set(pc);
      if (!pc || pc.campaignId == null) return;
      const pcId = pc.id;
      this.sessionService.getActiveForCampaign(String(pc.campaignId)).subscribe(state => {
        if (token !== this.resolveToken || !state) return; // reopened meanwhile, or none live
        const mine = state.participants.find(p => p.pcId === pcId && p.ownedByMe);
        if (!mine) return;
        this._sessionId.set(state.sessionId);
        this._participantId.set(mine.participantId);
      });
    });
  }
}
