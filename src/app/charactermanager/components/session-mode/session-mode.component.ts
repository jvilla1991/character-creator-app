import { Component, DestroyRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RestType, SessionState } from '../../models/session';
import { PC } from '../../models/pc';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { PCService } from '../../services/pc.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmService } from '../modal/confirm.service';
import { CampaignService } from '../../services/campaign.service';
import { ShopService } from '../../services/shop.service';
import { LevelUpPromptService } from '../../services/level-up-prompt.service';
import { formatCp, SellRequest } from '../../models/shop';
import { LocationType, LOCATION_TYPES, TimeOfDay } from '../../models/campaign';
import { SurvivalAction, advanceGameTime, describeGameTime } from '../../utils/survival';
import { CastRequest } from '../character-sheet/panels/spellbook-panel/spellbook-panel.component';
import { SlotNotice, slotCastNotice } from '../../utils/spell-slots';
import { withRecomputedAc } from '../../utils/armor-math';
import { ParticipantView } from '../../models/session';
import { SpellCarouselComponent } from './spell-carousel/spell-carousel.component';
import { FormsModule } from '@angular/forms';
import { InitiativePanelComponent } from './initiative-panel/initiative-panel.component';
import { RollLogPanelComponent } from './roll-log-panel/roll-log-panel.component';
import { CombatLogPanelComponent } from './combat-log-panel/combat-log-panel.component';
import { EncounterLoaderComponent } from './encounter-loader/encounter-loader.component';
import { ShopPanelComponent } from './shop-panel/shop-panel.component';
import { LootPanelComponent } from './loot-panel/loot-panel.component';
import { CharacterSheetComponent } from '../character-sheet/character-sheet.component';
import { RestVoteModalComponent } from './rest-vote-modal/rest-vote-modal.component';
import { RestChooserComponent } from './rest-chooser/rest-chooser.component';
import { LongRestModalComponent } from './long-rest-modal/long-rest-modal.component';
import { LongRestPanelComponent } from './long-rest-panel/long-rest-panel.component';
import { LongRestChoicesComponent } from './long-rest-choices/long-rest-choices.component';
import { dmLongRestWaitHint } from '../../utils/long-rest-limit';
import {
  LongRestDraft, draftBlockedReason, draftChoices, draftTempHp, hasLongRestChoices, startLongRestDraft,
} from '../../utils/long-rest-choices';
import { AsyncPipe, TitleCasePipe } from '@angular/common';
import { ContextHelpComponent } from '../context-help/context-help.component';

/**
 * Session Mode screen — a full-width overlay (chosen in the sidenav over the
 * Player/DM views via the UiState.activeSessionId signal) showing the live initiative
 * order. Subscribes to the server-authoritative snapshot and polls while open.
 *
 * This feature renders the read-only order; DM controls (initiative entry,
 * damage) arrive in a later feature.
 */
@Component({
    selector: 'app-session-mode',
    templateUrl: './session-mode.component.html',
    styleUrls: ['./session-mode.component.scss'],
    imports: [SpellCarouselComponent, FormsModule, InitiativePanelComponent, RollLogPanelComponent, CombatLogPanelComponent, EncounterLoaderComponent, ShopPanelComponent, LootPanelComponent, CharacterSheetComponent, RestVoteModalComponent, RestChooserComponent, LongRestModalComponent, LongRestPanelComponent, LongRestChoicesComponent, AsyncPipe, TitleCasePipe, ContextHelpComponent]
})
export class SessionModeComponent implements OnInit, OnDestroy {
  readonly sessionId = input.required<string>();

  state$ = this.sessionService.state$;

  // In-session DM note composer — writes to the campaign's note log.
  noteDraft = '';
  savingNote = false;
  noteSaved = false;

  /** True when this session's campaign uses the slot-based inventory variant. */
  slotInventory = false;
  /** True when this session's campaign uses the survival-conditions variant. */
  survivalConditions = false;
  /** True when this session's campaign uses the strict material-components variant. */
  strictComponents = false;

  // DM's set-the-date form (collapsed by default under the clock bar; opens
  // automatically when night rolls into a new morning). Free-text labels;
  // with a defined week the weekday becomes a select and a week number field
  // appears (the counter never moves on its own from this form).
  editingTime = false;
  timeYear = '';
  timeMonth = '';
  timeDay = '';
  timeWeekday = '';
  timeWeek: number | null = null;
  timeSegment: TimeOfDay = 'morning';
  readonly timeSegments: TimeOfDay[] = ['morning', 'noon', 'night'];

  // Week-tick toast + rollover detection, driven by snapshot transitions.
  private lastSeenWeek: number | null = null;
  private lastSeenSegment: TimeOfDay | null = null;

  private handledEnd = false;
  private variantsResolvedFor: string | null = null;

  private readonly levelUpPrompt = inject(LevelUpPromptService);
  private readonly confirmations = inject(ConfirmService);

  constructor(
    private sessionService: SessionService,
    private uiState: UiStateService,
    private pcService: PCService,
    private notifications: NotificationService,
    private campaignService: CampaignService,
    private shopService: ShopService,
    private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.sessionService.startPolling(this.sessionId());
    // The DM may end the session from another device; a poll then reports ENDED.
    this.sessionService.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        if (state && state.status === 'ENDED') this.onSessionEnded(state);
        if (state) {
          this.resolveVariants(state);
          this.trackClock(state);
          this.trackRestVote(state);
          this.trackLongRest(state);
          this.trackLongRestDraft(state);
          this.trackShortRest(state);
          this.trackLevelUp(state);
        }
      });
  }

  ngOnDestroy(): void {
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
        this.strictComponents = !!summary.variantRules?.strictComponents;
      },
      error: () => { /* keep the standard view */ },
    });
  }

  // ── Campaign clock (DM controls; read-only chip for players) ───────────────

  describeTime(state: SessionState): string {
    return describeGameTime(state.gameTime);
  }

  /** Label for the DM's advance button: the segment it advances INTO. */
  /** Player's Rest button: what it does, or why it is unavailable. The
   *  button's tooltip and the tap-reachable "?" beside it share this text. */
  restHint(state: SessionState): string {
    return this.restBlockedReason(state)
      ?? 'Calls for a short or a long rest. The party votes, and a unanimous yes opens the rest.';
  }

  /** DM only: what the clock buttons do, including what Advance costs the
   *  party in a survival campaign. */
  get clockHelp(): string {
    return 'The first button starts the in-world clock, then moves it on to the next time of day.'
      + (this.survivalConditions
        ? ' Time passes: the party eats its supplies, and hunger, thirst and fatigue shift.'
        : '')
      + ' Long Rest starts a long rest: the party readies up, and finishing it restores'
      + ' Hit Points, Hit Dice and spell slots'
      + (this.survivalConditions ? ' and sheds fatigue' : '')
      + '. Short Rest lets players spend Hit Dice to heal until you end it.';
  }

  advanceTimeLabel(state: SessionState): string {
    if (!state.gameTime) return 'Start the clock';
    const next = advanceGameTime(state.gameTime);
    const segment = next.timeOfDay.charAt(0).toUpperCase() + next.timeOfDay.slice(1);
    return next.timeOfDay === 'morning' ? `Advance to ${segment} (new day)` : `Advance to ${segment}`;
  }

  advanceTime(state: SessionState): void {
    this.sessionService.advanceTime(state.sessionId).subscribe({
      error: () => this.notifications.notify('Could not advance the clock. Try again.'),
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
    this.timeWeek = state.weekDays?.length ? t?.week ?? 1 : null;
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
      // The week field applies only with a defined week — the server ignores
      // it otherwise, so don't send one.
      ...(state.weekDays?.length ? { week: this.timeWeek } : {}),
    }).subscribe({
      next: () => { this.editingTime = false; },
      error: () => this.notifications.notify('Could not set the date. Try again.'),
    });
  }

  // ── Party location (DM controls; read-only chip for players) ───────────────

  editingLocation = false;
  locationName = '';
  locationType: LocationType = 'Settlement';
  readonly locationTypes = LOCATION_TYPES;

  /** "Neverwinter · Settlement" (type only when unnamed); "No location set" when unset. */
  describeLocation(state: SessionState): string {
    const loc = state.location;
    if (!loc) return 'No location set';
    return loc.name ? `${loc.name} · ${loc.type}` : loc.type;
  }

  toggleLocationEdit(state: SessionState): void {
    if (this.editingLocation) { this.editingLocation = false; return; }
    this.locationName = state.location?.name ?? '';
    this.locationType = state.location?.type ?? 'Settlement';
    this.editingLocation = true;
  }

  commitLocation(state: SessionState): void {
    this.sessionService.setLocation(state.sessionId, {
      name: this.locationName.trim(),
      type: this.locationType,
    }).subscribe({
      next: () => { this.editingLocation = false; },
      error: () => this.notifications.notify('Could not set the location. Try again.'),
    });
  }

  // ── Long rest phase ────────────────────────────────────────────────────────
  // Opened by a passed LONG vote or by the DM's Long Rest button. While it is
  // open nothing has been recovered: players mark Ready on a blocking screen,
  // the DM watches the readiness panel, and recovery lands for everyone when
  // the DM finishes it or the last able hero readies up.

  /** undefined until the first snapshot, so a stale outcome is not announced on (re)join. */
  private lastLongRestResultId: number | null | undefined = undefined;

  /** Why the DM cannot start a long rest right now, or null when they can. */
  dmLongRestBlockedReason(state: SessionState): string | null {
    if (state.longRest) return 'A long rest is already underway.';
    if (state.restVote?.status === 'ACTIVE') return 'A rest vote is being tallied. Allow or deny it first.';
    if (state.status !== 'LOBBY') return 'No resting mid-encounter. End the encounter first.';
    // One long rest every 24 hours on the campaign clock — and the clock is the DM's to move.
    if (state.longRestWait) return dmLongRestWaitHint(state.longRestWait);
    return null;
  }

  /** DM's Long Rest button: what it does, or why it is unavailable. The
   *  button's tooltip and the tap-reachable "?" beside it share this text. */
  dmLongRestHint(state: SessionState): string {
    return this.dmLongRestBlockedReason(state)
      ?? 'Starts a long rest. The party readies up, then you finish it.';
  }

  /** DM starts the long rest phase directly, with no vote. */
  openLongRest(state: SessionState): void {
    this.sessionService.openLongRest(state.sessionId).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not start the long rest. Try again.')),
    });
  }

  /** DM changes a phase option (the clock, or how a survival rest went). */
  setLongRestOptions(options: { advanceClock?: boolean; undisturbed?: boolean }, state: SessionState): void {
    this.sessionService.setLongRestOptions(state.sessionId, options).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not change that. Try again.')),
    });
  }

  finishLongRest(state: SessionState): void {
    this.sessionService.finishLongRest(state.sessionId).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not finish the long rest. Try again.')),
    });
  }

  interruptLongRest(state: SessionState): void {
    this.sessionService.interruptLongRest(state.sessionId).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not interrupt the long rest. Try again.')),
    });
  }

  /**
   * The player's long rest choices in progress (prepared spells, rune weapon),
   * or null when there is no open rest or their hero has nothing to choose.
   * Held here, not in the dialog, so the poll redrawing the dialog every two
   * seconds never resets a half-made choice.
   */
  longRestDraft: LongRestDraft | null = null;

  /** Start the draft when a rest opens for this player's hero; drop it when the rest closes. */
  private trackLongRestDraft(state: SessionState): void {
    if (!state.longRest || state.dm) { this.longRestDraft = null; return; }
    const pc = this.myPc(state);
    if (!pc) { this.longRestDraft = null; return; }
    if (this.longRestDraft?.pcId === pc.id) return;
    this.longRestDraft = hasLongRestChoices(pc) ? startLongRestDraft(pc, state.longRest.myChoices) : null;
  }

  /** Why Ready is not available yet (a choice still to make), or null. */
  longRestReadyBlocked(pc: PC): string | null {
    return draftBlockedReason(pc, this.longRestDraft);
  }

  /** Temporary Hit Points the rest will leave the hero with, given their rune choice. */
  longRestTempHp(pc: PC): number {
    return draftTempHp(pc, this.longRestDraft);
  }

  /** True once this player's hero is marked ready (their choices are then read-only). */
  isLongRestReady(state: SessionState): boolean {
    const id = this.myParticipantId(state);
    return !!state.longRest?.readiness.some(r => r.participantId === id && r.ready);
  }

  /** The player marks their own hero ready — sending their choices — or takes it back. */
  setLongRestReady(ready: boolean, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    const choices = ready ? draftChoices(this.longRestDraft) : {};
    this.sessionService.setLongRestReady(state.sessionId, mine.pcId, ready, choices).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not mark you ready. Try again.')),
    });
  }

  /** The hero the player's long rest screen is about; undefined for the DM or a spectator. */
  longRestPc(state: SessionState): PC | undefined {
    return state.dm ? undefined : this.myPc(state);
  }

  /**
   * Announce each long rest outcome once (keyed on the result id, like the
   * loot split's), and pull the player's fresh character after a finished
   * rest — Exhaustion is not on the poll snapshot.
   */
  private trackLongRest(state: SessionState): void {
    const result = state.longRestResult;
    const id = result?.id ?? null;
    const firstLook = this.lastLongRestResultId === undefined;
    if (id === this.lastLongRestResultId) return;
    this.lastLongRestResultId = id;
    if (!result || firstLook) return;

    const mine = state.dm ? undefined : state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (result.outcome === 'INTERRUPTED') {
      this.notifications.notify('The long rest was interrupted. Nobody recovered.');
      return;
    }
    if (mine?.pcId != null) this.pcService.refreshPC(mine.pcId);
    this.notifications.notify(this.longRestFinishedMessage(result.skipped, mine?.name ?? null));
  }

  private longRestFinishedMessage(skipped: string[], myHero: string | null): string {
    if (myHero != null) {
      return skipped.includes(myHero)
        ? `The long rest is over. ${myHero} was at 0 Hit Points and did not recover.`
        : `The long rest is over. ${myHero} is restored.`;
    }
    return skipped.length
      ? `The long rest is over. At 0 Hit Points, not recovered: ${skipped.join(', ')}.`
      : 'The long rest is over.';
  }

  // ── Short rest (DM window + player hit-die spends) ─────────────────────────

  /** DM announces (or calls off) a short rest — toggles the spend window. */
  shortRest(state: SessionState): void {
    this.sessionService.shortRest(state.sessionId).subscribe({
      next: next => this.notifications.notify(next.shortRestOpen
        ? 'Short rest — the party may spend hit dice.'
        : 'The short rest ends.'),
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not toggle the short rest.')),
    });
  }

  /** undefined until the first snapshot, so joining mid-rest does not look like one opening. */
  private lastShortRestOpen: boolean | undefined = undefined;

  /**
   * When a short rest opens the server gives every seated hero back what
   * their class features regain on one. Those counters live on the character,
   * not on the poll snapshot, so the player's hero is refetched.
   */
  private trackShortRest(state: SessionState): void {
    const opened = this.lastShortRestOpen === false && state.shortRestOpen;
    this.lastShortRestOpen = state.shortRestOpen;
    if (!opened || state.dm) return;
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId != null) this.pcService.refreshPC(mine.pcId);
  }

  // ── Rest vote (player-initiated, unanimous, 60s window) ────────────────────

  /** Snapshot transition tracker: announce a vote's outcome exactly once. */
  private lastVoteSeen: { voteId: number; status: string } | null = null;

  /** The player's Rest dialog (short or long) is open. */
  restChooserOpen = false;

  /** Why a player cannot call a rest right now, or null when they can. */
  restBlockedReason(state: SessionState): string | null {
    if (state.longRest) return 'A long rest is already underway.';
    if (state.shortRestOpen) return 'A short rest is already underway.';
    if (state.restVote?.status === 'ACTIVE') return 'A rest vote is already being tallied.';
    if (state.status !== 'LOBBY') return 'No resting mid-encounter. Wait until the encounter ends.';
    return null;
  }

  openRestChooser(): void { this.restChooserOpen = true; }

  /** The player picked a rest in the dialog — close it and call the vote. */
  callRest(restType: RestType, state: SessionState): void {
    this.restChooserOpen = false;
    this.initiateRestVote(state, restType);
  }

  /** A player calls a rest — every seated PC gets a ballot. */
  initiateRestVote(state: SessionState, restType: RestType = 'SHORT'): void {
    this.sessionService.initiateRestVote(state.sessionId, restType).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        restType === 'LONG' ? 'Could not call a long rest.' : 'Could not call a short rest.')),
    });
  }

  /** The player's ballot (bubbled from the blocking modal). */
  castRestVote(vote: boolean, state: SessionState): void {
    this.sessionService.castRestVote(state.sessionId, vote).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not record your vote.')),
    });
  }

  /** The DM's override: true ends the vote passed now, false failed. */
  overrideRestVote(vote: boolean, state: SessionState): void {
    this.sessionService.overrideRestVote(state.sessionId, vote).subscribe({
      error: err => this.notifications.notify(this.restVoteError(err,
        'Could not settle the vote.')),
    });
  }

  /**
   * Toast the outcome when a vote the viewer watched resolves — driven by the
   * ACTIVE → terminal transition across poll snapshots (same pattern as the
   * clock's week-tick toast), so it fires once per vote on every device.
   */
  private trackRestVote(state: SessionState): void {
    const vote = state.restVote;
    if (!vote) { this.lastVoteSeen = null; return; }
    const prev = this.lastVoteSeen;
    if (prev?.voteId === vote.voteId && prev.status === 'ACTIVE' && vote.status !== 'ACTIVE') {
      const long = vote.restType === 'LONG';
      const message =
        vote.status === 'PASSED'
          ? (long ? 'The vote passed — the long rest begins.'
                  : 'The party rests — spend hit dice while the window is open.')
        : vote.status === 'FAILED'
          ? (long ? 'No long rest — the vote failed.' : 'No rest — the vote failed.')
        : 'The rest vote was called off.';
      this.notifications.notify(message);
    }
    this.lastVoteSeen = { voteId: vote.voteId, status: vote.status };
  }

  /** Prefer the server's message (e.g. "A rest vote is already in progress"). */
  private restVoteError(err: unknown, fallback: string): string {
    const serverMessage = (err as { error?: { message?: string } })?.error?.message;
    return serverMessage || fallback;
  }

  /**
   * The player spends one hit die (bubbled up from their embedded sheet's
   * vitals strip). Server-rolled 1d[hitDie] + CON; the toast reports the roll
   * and the healing actually applied.
   */
  onSpendHitDie(state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    this.sessionService.spendHitDie(state.sessionId, mine.pcId).subscribe({
      next: r => this.notifications.notify(
        `Rolled ${r.roll} — healed ${r.healed} HP (${r.hitDiceUsed} of your dice spent).`),
      error: err => this.notifications.notify(this.spendHitDieError(err)),
    });
  }

  /** Prefer the server's message (e.g. "No hit dice remaining"), else a generic hint. */
  private spendHitDieError(err: unknown): string {
    const serverMessage = (err as { error?: { message?: string } })?.error?.message;
    if (serverMessage) return serverMessage;
    return 'Could not spend a hit die. Try again.';
  }

  /**
   * The player eats/drinks from the embedded sheet — server-authoritative so
   * the supply charge is spent on the canonical row and every viewer sees the
   * new stages via the version bump. The result patches the local PC (same
   * pattern as the sell/cast flows).
   */
  onSurvivalAction(action: SurvivalAction, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    this.sessionService.consumeSurvival(state.sessionId, mine.pcId, action).subscribe({
      error: () => this.notifications.notify(action === 'EAT'
        ? 'Could not eat a ration. Try again.'
        : action === 'DRINK'
          ? 'Could not drink. Try again.'
          : 'Could not record the rest. Try again.'),
    });
  }

  /**
   * What the last cast spent, for the slot strip on the player's sheet: "Misty
   * Step cast with a 2nd-level slot." Only a cast that spent a slot says
   * anything; a cantrip and a ritual spend none.
   */
  readonly castNotice = signal<SlotNotice | null>(null);

  /** The player casts one of their spells — server-authoritative so the DM sees the slot spend. */
  onCast(ev: CastRequest, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    const ritual = ev.ritual === true;
    this.sessionService.castSpell(state.sessionId, mine.pcId, ev.spellName, ev.atLevel, ritual).subscribe({
      next: result => {
        if (!ritual && ev.atLevel > 0) this.castNotice.set(slotCastNotice(ev.spellName, ev.atLevel));
        if (result.warning) this.notifications.notify(result.warning);
      },
      error: err => {
        this.notifications.notify(this.castErrorMessage(err));
        // A refused cast means the sheet was behind (the slot went elsewhere): catch up now.
        this.sessionService.refresh();
      },
    });
  }

  /** Prefer the server's message (e.g. a strict-component block), else a generic hint. */
  private castErrorMessage(err: unknown): string {
    const serverMessage = (err as { error?: { message?: string } })?.error?.message;
    if (serverMessage) return serverMessage;
    if ((err as { status?: number })?.status === 409) {
      return 'That cast was blocked. Check your slots and components.';
    }
    return 'Could not cast that spell. Try again.';
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

  /**
   * DM clicked a PC row in the initiative panel — open that character's full
   * sheet, editable, while the session keeps running underneath (mirrors
   * CampaignDashboardComponent.openHero). For the DM's own characters the full
   * PC is already in the local store; other players' members need the
   * DM-authorized fetch, since the session snapshot only carries the
   * privacy-limited projection. The session isn't torn down — sidenav's render
   * precedence just swaps in the sheet until the DM returns.
   */
  openPcSheet(p: ParticipantView): void {
    if (p.pcId == null) return;
    const owned = this.pcService.getPCById(p.pcId);
    if (owned) {
      this.pcService.setActivePC(owned);
      this.uiState.viewHeroAsDm();
      return;
    }
    this.pcService.getPCByIdAsDm(p.pcId).subscribe({
      next: full => {
        if (!full?.id) {
          this.notifications.notify('Could not open that character sheet. Try again.');
          return;
        }
        this.pcService.setActivePC(full);
        this.uiState.viewHeroAsDm();
      },
      error: err => this.notifications.error('Could not open that character sheet. Try again.', err),
    });
  }

  // ── Level-up prompt (rides the existing poll) ──────────────────────────────

  /**
   * Feed the caller's own seated PC to the level-up prompt on every snapshot.
   * The poll already carries what it needs: the level on the participant row,
   * XP as the caller-scoped `myXp`, and the DM grant as `myLevelGrant` (null
   * from a backend that predates it → the local store's flag). The DM is never
   * prompted here — they have no seated PC (`myXp`/`myLevelGrant` null) and the
   * snapshot says `dm`.
   *
   * Snapshot values that differ from the local PC store are mirrored into it,
   * so the sheet's badges and the level-up modal's gating agree with what the
   * prompt offered. A snapshot behind the store on level (a poll that left
   * before a level-up committed here) is ignored until the refetch lands.
   */
  private trackLevelUp(state: SessionState): void {
    if (state.dm || state.status === 'ENDED') return;
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    const local = mine?.pcId != null ? this.pcService.getPCById(mine.pcId) : undefined;
    if (!mine || !local) return;
    if (mine.level != null && local.level != null && mine.level < local.level) return;

    const patch: Partial<PC> = {};
    if (state.myXp != null && state.myXp !== local.xp) patch.xp = state.myXp;
    if (state.myLevelGrant != null && state.myLevelGrant !== (local.pendingLevelGrant === true)) {
      patch.pendingLevelGrant = state.myLevelGrant;
    }
    if (Object.keys(patch).length) this.pcService.patchLocalPC(local.id, patch);

    this.levelUpPrompt.evaluate({ ...local, ...patch, level: mine.level ?? local.level });
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
      // AC is driven by the player's own equipment (equipping recomputes and
      // persists pc.ac immediately), not by DM combat actions — so trust the
      // local store first and fall back to the poll snapshot. Preferring the
      // snapshot froze AC at the join-time value until the next poll.
      ac: pc.ac ?? mine.ac ?? undefined,
      conditions: mine.conditions ?? pc.conditions,
      conditionImmunities: mine.conditionImmunities ?? pc.conditionImmunities,
      survival: mine.survival ?? pc.survival,
      spellSlots: mine.spellSlots ?? pc.spellSlots,
      xp: state.myXp ?? pc.xp,
      pendingLevelGrant: state.myLevelGrant ?? pc.pendingLevelGrant,
      // Short-rest / inspiration state rides the snapshot (spends and DM pip
      // awards bump the version), so the embedded sheet stays live like slots.
      hitDiceUsed: mine.hitDiceUsed ?? pc.hitDiceUsed,
      inspirationPips: mine.inspirationPips ?? pc.inspirationPips,
      heroicInspiration: mine.heroicInspiration ?? pc.heroicInspiration,
    };
  }

  /**
   * The player sells `qty` units of the inventory line at `index` (bubbled up
   * from the character sheet's inventory panel) back to the open shop.
   */
  sell({ index, qty }: SellRequest, state: SessionState): void {
    const mine = state.participants.find(p => p.ownedByMe && p.pcId != null);
    if (mine?.pcId == null) return;
    const pcId = mine.pcId;
    this.shopService.sell(state.sessionId, pcId, index, qty).subscribe({
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
              error: err => this.notifications.error(
                `Sold — but your AC could not be updated to ${recomputed.ac}. Reopen your sheet to fix it.`, err),
            });
          }
        }
        this.notifications.notify(result.totalGainCp > 0
          ? `Sold for ${formatCp(result.totalGainCp)}.`
          : 'Sold — the shop paid nothing for it.');
      },
      error: () => this.notifications.notify('Could not sell that item. Try again.'),
    });
  }

  /** DM starts the encounter — initiative locks for players, turn one begins. */
  startEncounter(state: SessionState): void {
    this.sessionService.start(state.sessionId).subscribe({
      error: err => this.notifications.error('Could not start the encounter. Try again.', err),
    });
  }

  /**
   * DM ends the encounter (back to the lobby — the session stays open).
   * Confirmed first: it clears the turn order and everyone's initiative, so a
   * mis-click mid-combat would be painful to reconstruct.
   */
  endEncounter(state: SessionState): void {
    this.confirmations.confirm({
      title: 'End the Encounter',
      message: 'The turn order and everyone’s initiative are cleared and the table returns to the lobby. '
        + 'The session stays open.',
      confirmLabel: 'End Encounter',
      cancelLabel: 'Keep Fighting',
    }).subscribe(() => this.reallyEndEncounter(state));
  }

  private reallyEndEncounter(state: SessionState): void {
    this.sessionService.endEncounter(state.sessionId).subscribe({
      error: err => this.notifications.error('Could not end the encounter. Try again.', err),
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
      error: err => this.notifications.error('Could not pass the turn. Try again.', err),
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

  /**
   * The DM ends the session for everyone, then exits the screen. A failure
   * keeps the DM here: leaving would look like the session ended while the
   * players are still in it. A session that is already gone (404 / 409) has
   * nothing left to end, so that still exits.
   */
  endSession(state: SessionState): void {
    // Asked first: it is one tap beside Next Turn, and it ends play for everyone.
    this.confirmations.confirm({
      title: 'End the Session',
      message: 'The session closes for everyone at the table and players return to their sheets. '
        + 'You can start a new one from the campaign dashboard.',
      confirmLabel: 'End Session',
      cancelLabel: 'Keep Playing',
    }).subscribe(() => this.reallyEndSession(state));
  }

  private reallyEndSession(state: SessionState): void {
    this.sessionService.end(state.sessionId).subscribe({
      next: () => this.close(),
      error: err => {
        if (isAlreadyGone(err)) { this.close(); return; }
        this.notifications.error('Could not end the session. It is still running — try again.', err);
      },
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
        this.notifications.error('Could not save the note. Your text is still here — try again.', err);
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
      // Same rule as endSession: only leave the screen once the server agrees.
      error: err => {
        if (isAlreadyGone(err)) { this.close(); return; }
        this.notifications.error('Could not leave the session. You are still in it — try again.', err);
      },
    });
  }
}

/** The session or seat no longer exists, so there is nothing left to end or leave. */
function isAlreadyGone(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 404 || status === 409;
}
