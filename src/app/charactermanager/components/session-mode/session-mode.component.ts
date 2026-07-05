import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionState } from '../../models/session';
import { PC } from '../../models/pc';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { PCService } from '../../services/pc.service';
import { NotificationService } from '../../services/notification.service';
import { CampaignService } from '../../services/campaign.service';
import { ShopService } from '../../services/shop.service';
import { formatCp } from '../../models/shop';
import { TimeOfDay } from '../../models/campaign';
import { SurvivalAction, advanceGameTime, describeGameTime } from '../../utils/survival';
import { withRecomputedAc } from '../../utils/armor-math';

/**
 * Session Mode screen — a full-width overlay (chosen in the sidenav over the
 * Player/DM views via UiState.activeSessionId$) showing the live initiative
 * order. Subscribes to the server-authoritative snapshot and polls while open.
 *
 * This feature renders the read-only order; DM controls (initiative entry,
 * damage) arrive in a later feature.
 */
@Component({
  selector: 'app-session-mode',
  templateUrl: './session-mode.component.html',
  styleUrls: ['./session-mode.component.scss'],
})
export class SessionModeComponent implements OnInit, OnDestroy {
  @Input() sessionId!: string;

  state$ = this.sessionService.state$;

  // In-session DM note composer — writes to the campaign's note log.
  noteDraft = '';
  savingNote = false;
  noteSaved = false;

  /** True when this session's campaign uses the slot-based inventory variant. */
  slotInventory = false;
  /** True when this session's campaign uses the survival-conditions variant. */
  survivalConditions = false;

  // DM's set-the-date form (collapsed by default under the clock bar; opens
  // automatically when night rolls into a new morning). Free-text labels.
  editingTime = false;
  timeYear = '';
  timeMonth = '';
  timeDay = '';
  timeWeekday = '';
  timeSegment: TimeOfDay = 'morning';
  readonly timeSegments: TimeOfDay[] = ['morning', 'noon', 'night'];

  // Week-tick toast + rollover detection, driven by snapshot transitions.
  private lastSeenWeek: number | null = null;
  private lastSeenSegment: TimeOfDay | null = null;

  private stateSub?: Subscription;
  private handledEnd = false;
  private variantsResolvedFor: string | null = null;

  constructor(
    private sessionService: SessionService,
    private uiState: UiStateService,
    private pcService: PCService,
    private notifications: NotificationService,
    private campaignService: CampaignService,
    private shopService: ShopService,
  ) {}

  ngOnInit(): void {
    this.sessionService.startPolling(this.sessionId);
    // The DM may end the session from another device; a poll then reports ENDED.
    this.stateSub = this.sessionService.state$.subscribe(state => {
      if (state && state.status === 'ENDED') this.onSessionEnded(state);
      if (state) {
        this.resolveVariants(state);
        this.trackClock(state);
      }
    });
  }

  ngOnDestroy(): void {
    this.stateSub?.unsubscribe();
    // clear() (not just stopPolling) so closing via browser Back tears the
    // session down exactly like the in-app Close button does.
    this.sessionService.clear();
  }

  /**
   * The session ended. Players are told and routed back to their own character
   * sheet; the DM (who ended it) just exits. Guarded so it runs once.
   */
  private onSessionEnded(state: SessionState): void {
    if (this.handledEnd) return;
    this.handledEnd = true;

    if (!state.dm) {
      const mine = state.participants.find(p => p.ownedByMe);
      if (mine?.pcId != null) {
        const pc = this.pcService.getPCById(mine.pcId);
        if (pc) this.pcService.setActivePC(pc);
      }
      this.notifications.notify('The DM ended the session.');
    }
    this.close();
  }

  /** One-time lookup of the campaign's variant flags (immutable per campaign). */
  private resolveVariants(state: SessionState): void {
    const campaignId = state.campaignId != null ? String(state.campaignId) : null;
    if (!campaignId || this.variantsResolvedFor === campaignId) return;
    this.variantsResolvedFor = campaignId;
    this.campaignService.getSummary(campaignId).subscribe({
      next: summary => {
        this.slotInventory = !!summary.variantRules?.slotInventory;
        this.survivalConditions = !!summary.variantRules?.survivalConditions;
      },
      error: () => { /* keep the standard view */ },
    });
  }

  // ── Campaign clock (DM controls; read-only chip for players) ───────────────

  describeTime(state: SessionState): string {
    return describeGameTime(state.gameTime);
  }

  /** Label for the DM's advance button: the segment it advances INTO. */
  advanceTimeLabel(state: SessionState): string {
    if (!state.gameTime) return 'Start the clock';
    const next = advanceGameTime(state.gameTime);
    const segment = next.timeOfDay.charAt(0).toUpperCase() + next.timeOfDay.slice(1);
    return next.timeOfDay === 'morning' ? `Advance to ${segment} (new day)` : `Advance to ${segment}`;
  }

  advanceTime(state: SessionState): void {
    this.sessionService.advanceTime(state.sessionId).subscribe({
      error: () => this.notifications.notify('Could not advance the clock.'),
    });
  }

  /**
   * Snapshot transitions drive two clock behaviors: a toast when the week
   * counter ticks (any viewer), and auto-opening the DM's set-date form when
   * night rolls into a new morning — the date is free text, so updating it
   * (and the weekday) is the DM's move.
   */
  private trackClock(state: SessionState): void {
    const week = state.gameTime?.week ?? null;
    const segment = state.gameTime?.timeOfDay ?? null;

    if (this.lastSeenWeek != null && week != null && week > this.lastSeenWeek) {
      this.notifications.notify(`A full week has passed — Week ${week} begins.`);
    }
    if (state.dm && this.lastSeenSegment === 'night' && segment === 'morning' && !this.editingTime) {
      this.openTimeEdit(state);
      this.notifications.notify('A new day dawns — set the date and weekday.');
    }

    this.lastSeenWeek = week;
    this.lastSeenSegment = segment;
  }

  toggleTimeEdit(state: SessionState): void {
    if (this.editingTime) {
      this.editingTime = false;
      return;
    }
    this.openTimeEdit(state);
  }

  private openTimeEdit(state: SessionState): void {
    const t = state.gameTime;
    this.timeYear = t?.year ?? '';
    this.timeMonth = t?.month ?? '';
    this.timeDay = t?.day ?? '';
    this.timeWeekday = t?.weekday ?? '';
    this.timeSegment = t?.timeOfDay ?? 'morning';
    this.editingTime = true;
  }

  commitTime(state: SessionState): void {
    this.sessionService.setTime(state.sessionId, {
      year: this.timeYear.trim(),
      month: this.timeMonth.trim(),
      day: this.timeDay.trim(),
      timeOfDay: this.timeSegment,
      weekday: this.timeWeekday.trim() || null,
    }).subscribe({
      next: () => { this.editingTime = false; },
      error: () => this.notifications.notify('Could not set the date.'),
    });
  }

  /** The player eats/drinks/sleeps — server-authoritative so everyone sees it. */
  onSurvivalAction(action: SurvivalAction, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    this.sessionService.consumeSurvival(state.sessionId, mine.pcId, action).subscribe({
      error: () => this.notifications.notify('Could not update your condition. Try again.'),
    });
  }

  /**
   * Players see the initiative tracker only while an encounter is running;
   * the DM always sees it (their setup controls live there). Players enter
   * their rolls after Start Encounter — the server sorts late entries.
   */
  showInitiative(state: SessionState): boolean {
    return state.dm || state.status === 'ACTIVE';
  }

  /** Leave the session screen (does not end the session server-side). */
  close(): void {
    this.sessionService.clear();
    this.uiState.closeSession();
  }

  /** The requesting player's own participant id in this session, if any. */
  myParticipantId(state: SessionState): number | null {
    const mine = state.participants.find(p => p.ownedByMe);
    return mine ? mine.participantId : null;
  }

  /**
   * The requesting player's own seated character, for the read-only sheet shown
   * at the bottom of the session so they can reference it while they play.
   * Starts from the local PC store (same source the end-of-session handler uses)
   * but overlays the live values the poll already carries — HP/AC/conditions from
   * this participant's ParticipantView, XP from the caller-scoped `myXp` — so the
   * sheet reflects DM actions (damage, conditions, XP awards) without a refresh.
   */
  myPc(state: SessionState): PC | undefined {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    const pc = mine?.pcId != null ? this.pcService.getPCById(mine.pcId) : undefined;
    if (!pc || !mine) return pc;
    return {
      ...pc,
      hp: {
        cur: mine.hpCurrent ?? pc.hp?.cur ?? 0,
        max: mine.hpMax ?? pc.hp?.max ?? 0,
        temp: mine.hpTemp ?? pc.hp?.temp ?? 0,
      },
      ac: mine.ac ?? pc.ac,
      conditions: mine.conditions ?? pc.conditions,
      survival: mine.survival ?? pc.survival,
      xp: state.myXp ?? pc.xp,
    };
  }

  /**
   * The player sells the inventory item at `index` (bubbled up from the
   * character sheet's inventory panel) back to the open shop.
   */
  sell(index: number, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    const pcId = mine.pcId;
    this.shopService.sell(state.sessionId, pcId, index).subscribe({
      next: result => {
        // Capture the pre-sell inventory first — selling an equipped armor
        // piece changes AC, and the comparison needs the old equipped set.
        const before = this.pcService.getPCById(pcId);
        this.pcService.patchLocalPC(pcId, { coins: result.coins, inventory: result.inventory });
        const after = this.pcService.getPCById(pcId);
        if (before && after) {
          const recomputed = withRecomputedAc(after, before.inventory);
          if (recomputed.ac !== after.ac) {
            this.pcService.updatePC(recomputed).subscribe({
              error: err => console.error('Failed to persist recomputed AC', err),
            });
          }
        }
        this.notifications.notify(`Sold for ${formatCp(result.totalGainCp)}.`);
      },
      error: () => this.notifications.notify('Could not sell that item. Try again.'),
    });
  }

  /** DM starts the encounter — initiative locks for players, turn one begins. */
  startEncounter(state: SessionState): void {
    this.sessionService.start(state.sessionId).subscribe({
      error: err => {
        console.error('Failed to start encounter', err);
        this.notifications.notify('Could not start the encounter.');
      },
    });
  }

  /**
   * DM ends the encounter (back to the lobby — the session stays open).
   * Confirmed first: it clears the turn order and everyone's initiative, so a
   * mis-click mid-combat would be painful to reconstruct.
   */
  endEncounter(state: SessionState): void {
    if (!window.confirm('Are you sure you want to end this encounter?')) return;
    this.sessionService.endEncounter(state.sessionId).subscribe({
      error: err => {
        console.error('Failed to end encounter', err);
        this.notifications.notify('Could not end the encounter.');
      },
    });
  }

  /**
   * Advance the turn: the DM's Next Turn, or a player's End Turn (the button
   * only renders on their own turn; the server enforces it regardless). Sends
   * the active id from the snapshot being rendered — if another advance won the
   * race, the service already resolves the 409 by refetching.
   */
  advanceTurn(state: SessionState): void {
    if (state.activeParticipantId == null) return;
    this.sessionService.advance(state.sessionId, state.activeParticipantId).subscribe({
      error: err => console.error('Failed to advance turn', err),
    });
  }

  /** True when the viewer's own combatant holds the current turn. */
  isMyTurn(state: SessionState): boolean {
    const id = this.myParticipantId(state);
    return id != null && id === state.activeParticipantId;
  }

  /** True when the viewer's own combatant is next up (drives the gold vignette). */
  isMyOnDeck(state: SessionState): boolean {
    const id = this.myParticipantId(state);
    return id != null && id === state.onDeckParticipantId;
  }

  /** The DM ends the session for everyone, then exits the screen. */
  endSession(state: SessionState): void {
    this.sessionService.end(state.sessionId).subscribe({
      next: () => this.close(),
      error: () => this.close(),
    });
  }

  /**
   * The DM captures a note mid-session; it is appended to the campaign's note
   * log (the same log shown on the dashboard's Session Notes panel), tagged with
   * this session's id.
   */
  addNote(state: SessionState): void {
    const body = this.noteDraft.trim();
    if (!body || this.savingNote) return;
    this.savingNote = true;
    this.noteSaved = false;
    this.campaignService.addNote(String(state.campaignId), body, state.sessionId).subscribe({
      next: () => {
        this.noteDraft = '';
        this.savingNote = false;
        this.noteSaved = true;
      },
      error: err => {
        console.error('Failed to add session note', err);
        this.savingNote = false;
      },
    });
  }

  /** A player removes their own PC from the session, then exits the screen. */
  leave(state: SessionState): void {
    const id = this.myParticipantId(state);
    if (id == null) {
      this.close();
      return;
    }
    this.sessionService.leave(state.sessionId, id).subscribe({
      next: () => this.close(),
      error: () => this.close(),
    });
  }
}
