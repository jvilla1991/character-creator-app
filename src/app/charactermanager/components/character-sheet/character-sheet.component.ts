import { RenownPanelComponent } from './panels/renown-panel/renown-panel.component';
import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { PC, PcSpell, PcItem } from '../../models/pc';
import { SellRequest } from '../../models/shop';
import { CampaignLocation } from '../../models/campaign';
import { Follower, followerToPc, pcToStatBlock } from '../../models/follower';
import { PCService } from '../../services/pc.service';
import { GrantService } from '../../services/grant.service';
import { SessionService } from '../../services/session.service';
import { FollowerService } from '../../services/follower.service';
import { UiStateService } from '../../services/ui-state.service';
import { tintFor } from '../../utils/character-math';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { SurvivalAction, applyConsumeToPc } from '../../utils/survival';
// NOTE: the type import is kept separate from the component import — sharing
// one import statement counts as an eager reference to SpellbookPanelComponent
// and blocks the @defer chunk-split of the spells tab.
import type { CastRequest } from './panels/spellbook-panel/spellbook-panel.component';
import { SpellbookPanelComponent } from './panels/spellbook-panel/spellbook-panel.component';
import { SkillProfChange, SkillsListComponent } from './panels/skills-list/skills-list.component';
import { isReadyToLevel, xpForNextLevel, xpProgressPct } from '../../models/xp-thresholds';
import { DmEditRequest } from './dm-edit-modal/dm-edit-request';
import { ContextHelpComponent } from '../context-help/context-help.component';
import { DmEditConfirm, DmEditModalComponent } from './dm-edit-modal/dm-edit-modal.component';
import { FormsModule } from '@angular/forms';
import { EditableNumberComponent } from './editable-number/editable-number.component';
import { VitalsStripComponent } from './vitals-strip/vitals-strip.component';
import { AbilityScoresComponent } from './panels/ability-scores/ability-scores.component';
import { ConditionsPanelComponent } from './panels/conditions-panel/conditions-panel.component';
import { SurvivalPanelComponent } from './panels/survival-panel/survival-panel.component';
import { FeaturesListComponent } from './panels/features-list/features-list.component';
import { OtherFeaturesComponent } from './panels/other-features/other-features.component';
import { CoinPurseComponent } from './panels/coin-purse/coin-purse.component';
import { BackgroundStoryComponent } from './panels/background-story/background-story.component';
import { SuppliesPanelComponent } from './panels/supplies-panel/supplies-panel.component';
import { InventoryPanelComponent } from './panels/inventory-panel/inventory-panel.component';
import { PcNotesComponent } from './panels/pc-notes/pc-notes.component';
import { PcLogComponent } from './panels/pc-log/pc-log.component';
import { ProfessionsPanelComponent } from './panels/professions-panel/professions-panel.component';
import { FollowersPanelComponent } from './panels/followers-panel/followers-panel.component';
import { ClassDisplayPipe } from '../../pipes/class-display.pipe';
import { SpeciesDisplayPipe } from '../../pipes/species-display.pipe';
import { HeroClassPanelComponent, isHeroClass } from './panels/hero-class-panel/hero-class-panel.component';
import { SpeciesSpellsComponent } from './panels/species-spells/species-spells.component';
import { heroClassFor, specializationTitle } from '../../models/hero-class';
import { NotificationService } from '../../services/notification.service';
import { AdjustableStat, slotStat } from '../../models/stat-adjustment';
import {
  SlotNotice, SpellSlots, allSlotsRestoredNotice, ordinal, restoreAllSlots, restoreSlot, slotMaxOf,
  slotRestoredNotice, slotSpentNotice, spendSlot, withSlotMax,
} from '../../utils/spell-slots';
import { StatBreakdown, applyAdjustments, breakdownOf, describeAdjustmentChange } from '../../utils/stat-breakdown';
import { StatBreakdownModalComponent, StatBreakdownSave } from './stat-breakdown-modal/stat-breakdown-modal.component';

@Component({
    selector: 'app-character-sheet',
    templateUrl: './character-sheet.component.html',
    styleUrls: ['./character-sheet.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RenownPanelComponent, FormsModule, EditableNumberComponent, VitalsStripComponent, AbilityScoresComponent, SkillsListComponent, ConditionsPanelComponent, SurvivalPanelComponent, FeaturesListComponent, OtherFeaturesComponent, CoinPurseComponent, BackgroundStoryComponent, SpellbookPanelComponent, SuppliesPanelComponent, InventoryPanelComponent, PcNotesComponent, PcLogComponent, FollowersPanelComponent, ProfessionsPanelComponent, DmEditModalComponent, StatBreakdownModalComponent, ClassDisplayPipe, SpeciesDisplayPipe, HeroClassPanelComponent, SpeciesSpellsComponent, ContextHelpComponent]
})
export class CharacterSheetComponent implements OnChanges, OnInit, OnDestroy {
  onInventoryTransferred(result: { inventory: PcItem[]; ac?: number }): void {
    // The transfer endpoint already saved both inventories. Never PUT a stale sheet here.
    this.pc = { ...this.pc, ...result };
  }
  @Input() pc!: PC;
  /**
   * When true, the sheet's numbers become click-to-edit and changes persist via
   * the DM-authorized path. Driven by the UiState.dmReturn signal — i.e. a DM viewing one
   * of their campaign members (cross-linked from the dashboard).
   */
  @Input() editable = false;
  /** Hide the header action buttons (Connect/Roll/Long Rest/Level Up/Delete) when
   *  the sheet is embedded read-only, e.g. inside Session Mode. */
  @Input() showActions = true;
  /** Keep the inventory panel interactive even when showActions is false — used by
   *  Session Mode, where the header actions stay hidden but players still need to
   *  manage their inventory mid-session. */
  @Input() inventoryEditable = false;
  /** True while a shop is open and this PC is targeted — passed through to the
   *  inventory panel to reveal its Sell button. */
  @Input() shopOpenForMe = false;
  /** True when this PC's campaign runs the Darker Dungeons slot-based inventory
   *  variant — switches the inventory panel to slots/bulk (a converted PC's
   *  legacy weapons/gear were consolidated into its inventory on join). */
  @Input() slotInventory = false;
  /** True when this PC's campaign runs the Darker Dungeons survival-conditions
   *  variant — reveals the hunger/thirst/fatigue tracker panel. */
  @Input() survivalConditions = false;
  /** True when this PC's campaign runs the strict material-components variant —
   *  a missing costly component blocks the cast instead of warning. */
  @Input() strictComponents = false;
  /** True when the sheet is embedded in a live session — enables the in-session
   *  spellbook Cast buttons and tags new character notes with the session. */
  @Input() sessionLive = false;
  /** The live session id (session embeds only) — tags new character notes. */
  @Input() noteSessionId: number | string | null = null;
  /** True while the DM's short-rest window is open (session embeds only) —
   *  reveals the vitals strip's Spend Hit Die button on the player's sheet. */
  @Input() shortRestOpen = false;
  /** The party's current location (campaign-level), shown at the top of the
   *  sheet. Set by the DM in Session Mode; null until then. */
  @Input() location: CampaignLocation | null = null;
  /** True when this sheet shows a FOLLOWER rather than a character: only the
   *  Sheet/Spells/Inventory tabs exist, the header offers "Back to Character"
   *  in place of the character actions, and every save is emitted through
   *  `followerChanged` (the owning character's sheet persists it) instead of
   *  going to the PC endpoints — a follower is not a PC row. */
  @Input() followerMode = false;
  /** Session embeds only: what the last cast spent ("Misty Step cast with a
   *  2nd-level slot."), for the slot strip to say. Set by the host once the
   *  server has confirmed the cast. */
  @Input() set castNotice(notice: SlotNotice | null) {
    if (notice) this.slotNotice.set(notice);
  }
  /** Follower mode only: the name of the character this follower belongs to. */
  @Input() followerOwnerName = '';
  /** Follower mode only: whether that character is in a campaign, and so has a DM
   *  (a follower's own stat block carries no campaign). */
  @Input() followerOwnerInCampaign = false;
  readonly deleteRequested = output<void>();
  readonly rollRequested = output<void>();
  readonly levelUpRequested = output<void>();
  /** Player asks to connect to their campaign's live session. */
  readonly connectRequested = output<void>();
  /** Character has no campaign — player asks to join one (opens the join modal). */
  readonly joinCampaignRequested = output<void>();
  /** Player sells some of an inventory line; bubbled from the inventory panel. */
  readonly sellRequested = output<SellRequest>();
  /** In-session survival action (eat/drink); bubbled from the survival panel so
   *  the host can call the server-authoritative consume endpoint. */
  readonly survivalActionRequested = output<SurvivalAction>();
  /** In-session spell cast (resolved to a slot level); bubbled from the spellbook panel. */
  readonly castRequested = output<CastRequest>();
  /** In-session hit-die spend (short rest); bubbled from the vitals strip so the
   *  host can call the server-authoritative spend endpoint. */
  readonly spendHitDieRequested = output<void>();
  /** Follower mode only: the follower's sheet changed; carries the full updated sheet. */
  readonly followerChanged = output<PC>();
  /** Follower mode only: "Back to Character" was clicked. */
  readonly backRequested = output<void>();

  /** Whether this PC belongs to a campaign (gates the Connect button). */
  get inCampaign(): boolean {
    return this.pc?.campaignId != null;
  }

  // ── XP (display only) ────────────────────────────────────────────────────
  // XP accumulates via DM awards in Session Mode; leveling stays the explicit
  // flow below. These getters drive the header's XP total and a "ready to level
  // up" badge — they never advance a level on their own.

  /** Total XP required to reach the next level, or null at max level. */
  get xpForNextLevel(): number | null {
    return xpForNextLevel(this.pc?.level ?? 1);
  }

  /** True once total XP has crossed the next 2024 PHB threshold. */
  get readyToLevel(): boolean {
    return isReadyToLevel(this.pc?.level ?? 1, this.pc?.xp ?? 0);
  }

  /** The DM granted a level-up this character hasn't spent yet. */
  get dmGrantedLevel(): boolean {
    return this.pc?.pendingLevelGrant === true;
  }

  /** Leveling is gated: enough XP for the next level OR a DM grant. In DM
   *  cross-link mode the DM may always level the character (the DM-authorized
   *  path has no XP gate — acting is the authorization). The backend enforces
   *  the same rules (409 / as-dm); this only drives the button. */
  get canLevelUp(): boolean {
    return this.editable || this.readyToLevel || this.dmGrantedLevel;
  }

  /** Why Level Up is (un)available: the button's tooltip, and when it is
   *  disabled the text behind the "?" beside it. */
  get levelUpHint(): string {
    if (this.editable) return 'Level up this character (no XP threshold required)';
    if (this.canLevelUp) return 'Advance a level';
    return this.xpForNextLevel == null
      ? 'This character is at the maximum level.'
      : 'Not enough XP yet. Reach ' + this.xpForNextLevel + ' XP, or ask your DM to grant a level.';
  }

  /** DM cross-link: toggle the pending level-up grant for this character. */
  toggleLevelGrant(): void {
    this.pcService.grantLevelUp(this.pc.id, !this.dmGrantedLevel).subscribe({
      error: err => this.notifications.error(this.dmGrantedLevel
        ? 'Could not withdraw the level-up. Try again.'
        : 'Could not grant the level-up. Try again.', err),
    });
  }

  /** Fill % (0–100) of the XP bar — progress through the current level. */
  get xpProgressPct(): number {
    return xpProgressPct(this.pc?.level ?? 1, this.pc?.xp ?? 0);
  }

  onConnectClick(): void {
    this.connectRequested.emit();
  }

  /** Active section tab. The sheet is split so Notes (and Spells/Inventory) get
   *  their own space; on mobile the tab bar is pinned to the bottom of the screen. */
  activeTab: 'sheet' | 'spells' | 'inventory' | 'renown' | 'followers' | 'professions' | 'notes' | 'log' = 'sheet';
  setTab(tab: 'sheet' | 'spells' | 'inventory' | 'renown' | 'followers' | 'professions' | 'notes' | 'log'): void { this.activeTab = tab; }

  editingName = false;
  nameDraft = '';
  editingLevel = false;
  levelDraft: number | null = null;

  private readonly notifications = inject(NotificationService);

  constructor(
    private pcService: PCService,
    private grantService: GrantService,
    private sessionService: SessionService,
    private followerService: FollowerService,
    private uiState: UiStateService,
  ) {
    // A follower asked for from outside this sheet (see UiState.followerRequest).
    // ngOnChanges asks again when the character arrives after the request did.
    effect(() => {
      if (this.uiState.followerRequest()) untracked(() => this.openRequestedFollower());
    });
    this.followerService.changes$.pipe(takeUntilDestroyed()).subscribe(change => {
      if (!this.followerMode && change.pcId === this.pc?.id) this.refreshOpenFollower();
    });
  }

  // Saves of the open follower still on their way to the server, and a count
  // of every edit made to it, so a re-list can tell when it is out of date.
  private followerSavesInFlight = 0;
  private followerEdits = 0;

  /**
   * The open follower changed somewhere else (the DM damaged it from the
   * initiative order, or dismissed it): show the server's copy. Never while
   * one of this sheet's own saves is in flight, and a re-list that an edit
   * overtook is dropped, so a change made here always wins over a re-list
   * that started before it. A dismissed follower's sheet closes.
   */
  private refreshOpenFollower(): void {
    const open = this.openedFollower();
    if (!open || this.followerSavesInFlight > 0) return;
    const edits = this.followerEdits;
    this.followerService.list(open.pcId).subscribe({
      next: followers => {
        const current = this.openedFollower();
        if (current?.id !== open.id || this.followerEdits !== edits || this.followerSavesInFlight > 0) return;
        const fresh = followers.find(f => f.id === open.id);
        if (!fresh) {
          this.closeFollower();
          this.notifications.notify(`${open.name} is no longer with ${this.pc.name}.`);
        } else if (fresh.name !== current.name
            || JSON.stringify(fresh.statBlock) !== JSON.stringify(current.statBlock)) {
          this.openedFollower.set(fresh);
        }
      },
      error: () => {},   // keep showing what we have
    });
  }

  /** Claim a pending follower request for this character and open it, as if
   *  the follower had been clicked on the Followers tab. */
  private openRequestedFollower(): void {
    if (this.followerMode || !this.pc) return;
    const pcId = this.pc.id;
    const followerId = this.uiState.takeFollowerRequest(pcId);
    if (followerId === null) return;
    const failed = (err?: unknown) =>
      this.notifications.error('Could not open that follower. Try the Followers tab.', err);
    this.followerService.list(pcId).subscribe({
      next: followers => {
        if (this.pc?.id !== pcId) return;   // the sheet moved on while loading
        const follower = followers.find(f => f.id === followerId);
        if (follower) this.onFollowerOpened(follower);
        else failed();
      },
      error: err => failed(err),
    });
  }

  /**
   * Below 820px the section tabs are pinned to the bottom of the screen (see
   * the SCSS), which puts the Followers/Log end of the bar directly under the
   * floating dice button. The button lives in the app shell, nowhere near this
   * component in the DOM, so we flag the bar on <body>: styles.css turns that
   * flag into --bottom-bar-height, and the button lifts itself clear.
   */
  ngOnInit(): void {
    // A follower sheet is nested inside its character's sheet, which already
    // owns the flag — it must not clear it when the player goes back.
    if (!this.followerMode) document.body.classList.add('has-bottom-tab-bar');
  }

  ngOnDestroy(): void {
    if (this.followerMode) return;
    document.body.classList.remove('has-bottom-tab-bar');
    // Leaving the sheet (role switch, session close, …) abandons the follower view.
    this.closeFollower();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pc']) {
      // Reset edit state whenever a new PC is loaded
      this.editingName = false;
      this.nameDraft = this.pc?.name ?? '';
      this.editingLevel = false;
      this.levelDraft = this.pc?.level ?? 1;
      // A different character took over this sheet — its predecessor's
      // follower must not stay open on top of it. (A follower sheet's own
      // `pc` changes on every save and must NOT close anything.)
      const previous = changes['pc'].previousValue as PC | undefined;
      if (!this.followerMode && previous && previous.id !== this.pc?.id) {
        this.closeFollower();
      }
      // What was said about the last character's slots is not about this one.
      if (previous && previous.id !== this.pc?.id) this.slotNotice.set(null);
      this.openRequestedFollower();
    }
  }

  // ── Followers ──────────────────────────────────────────────────────────────
  // Clicking a follower on the Followers tab swaps this sheet for a nested copy
  // of itself in follower mode. Which follower is open is mirrored in UiState so
  // the browser Back button returns to the character; the follower's data lives
  // here, since this sheet is what saves it.

  private readonly openedFollower = signal<Follower | null>(null);

  /** The follower whose sheet is showing — null once it is closed in-app or via Back. */
  readonly openFollower = computed(() => {
    const follower = this.openedFollower();
    return follower && this.uiState.openFollowerId() === follower.id ? follower : null;
  });

  /** The open follower as a PC, for the nested follower-mode sheet. */
  readonly openFollowerPc = computed(() => {
    const follower = this.openFollower();
    return follower ? followerToPc(follower, this.pc) : null;
  });

  onFollowerOpened(follower: Follower): void {
    this.openedFollower.set(follower);
    this.uiState.openFollower(follower.id);
  }

  closeFollower(): void {
    const follower = this.openedFollower();
    if (!follower) return;
    this.openedFollower.set(null);
    // Only unwind the history entry if it is still ours (Back may have consumed it).
    if (this.uiState.openFollowerId() === follower.id) this.uiState.closeFollower();
  }

  /**
   * The nested follower sheet saved something. Applied locally at once so the
   * sheet stays responsive (its panels re-render from the new `pc`), then
   * persisted; a failed save reverts to the last server-confirmed sheet.
   */
  onFollowerChanged(updated: PC): void {
    const before = this.openedFollower();
    if (!before) return;
    const optimistic: Follower = { ...before, name: updated.name, statBlock: pcToStatBlock(updated) };
    this.openedFollower.set(optimistic);
    this.followerEdits++;
    this.followerSavesInFlight++;
    this.followerService.update(before.pcId, before.id, optimistic.name, optimistic.statBlock).pipe(
      finalize(() => this.followerSavesInFlight--),
    ).subscribe({
      error: err => {
        this.notifications.error(`Could not save ${before.name}. The change was undone — try again.`, err);
        // Revert only if no newer edit has landed on top of this one.
        if (this.openedFollower() === optimistic) this.openedFollower.set(before);
      },
    });
  }

  /**
   * Persist an updated PC. In editable (DM cross-link) mode this goes through the
   * DM-authorized path so a DM may save another player's character; otherwise it
   * uses the owner path. PCService pushes the result into activePC$, so the sheet
   * refreshes itself. `description`, when given, is a DM-authored log entry that
   * replaces the backend's automatic before/after diff — only ever passed from
   * the DM edit modal and the skills-panel proficiency toggle; every other call
   * site (name/level/conditions/pcChange) omits it and keeps the auto-diff
   * behavior unchanged.
   */
  private persist(updated: PC, description: string | null = null): void {
    if (this.followerMode) {
      // A follower has no activity log, so the DM's description has nowhere to go.
      this.followerChanged.emit(updated);
      return;
    }
    const save$ = this.editable
      ? this.pcService.updatePCAsDm(updated, description)
      : this.pcService.updatePC(updated);
    // The sheet renders from the server-confirmed pc (activePC$ only moves on
    // success), so a failed save leaves nothing optimistic behind — just say so.
    save$.subscribe({
      error: err => this.notifications.error('Could not save that change. Try again.', err),
    });
  }

  /** A child panel emitted a fully-updated PC (e.g. an ability score changed). */
  onPcChange(updated: PC): void {
    this.persist(updated);
  }

  /**
   * The hero-class panel picked (or cleared, with null) a WoW Hunter's pet family. A real
   * character saves it through the pet endpoint — the generic update ignores `petFamily` —
   * for the owner and the DM alike; a follower has no such endpoint and saves its stat block.
   */
  onPetFamilyChange(family: string | null): void {
    if (this.followerMode) {
      this.persist({ ...this.pc, petFamily: family });
      return;
    }
    this.pcService.setPetFamily(this.pc.id, family).subscribe({
      error: err => this.notifications.error('Could not change the pet family. Try again.', err),
    });
  }

  /** DM cycled a skill's proficiency marker (skills panel, cross-link mode only).
   *  The panel supplies the log line — a skills-map change has no readable
   *  auto-diff on the backend, so we pass the description through. */
  onSkillProfChange(change: SkillProfChange): void {
    this.persist(change.pc, change.description);
  }

  /**
   * Who may toggle prepared spells on the sheet: the DM (cross-link edit) at
   * any time, and the owner only while the character is in no campaign. In a
   * campaign prepared spells change during a long rest — the same split as
   * the DM-only exhaustion stepper.
   */
  get canPrepareSpells(): boolean {
    return this.editable || (this.ownSheet && this.pc?.campaignId == null);
  }

  /** Whether the viewer owns this sheet — drives the survival Eat/Drink buttons.
   *  Mirrors the pc-notes canWrite rule: interactive contexts minus DM cross-link. */
  get ownSheet(): boolean {
    return (this.showActions || this.inventoryEditable) && !this.editable;
  }

  /**
   * A survival action from the panel. In a live session the host owns it (the
   * server decrements the supply charge and bumps the poll version); on the
   * plain sheet the local reducer applies the same rules and persists.
   */
  onSurvivalAction(action: SurvivalAction): void {
    if (this.sessionLive) {
      this.survivalActionRequested.emit(action);
      return;
    }
    this.persist(applyConsumeToPc(this.pc, action));
  }

  /**
   * A cast from the spellbook panel — only reachable inside a live session (the
   * Cast buttons are hidden otherwise). The host forwards it to Session Mode,
   * which spends the slot (none for a ritual), consumes the component, and
   * bumps the poll version; `castNotice` then tells the strip what was spent.
   */
  onCastRequested(ev: CastRequest): void {
    this.castRequested.emit(ev);
  }

  // ── Spell slots ──────────────────────────────────────────────────────────
  // The strip at the top of the Spells tab. The count lives on the server:
  // a spend or restore goes to its own endpoint and the answer replaces the
  // slots on screen, so a refusal changes nothing here. A follower is not a
  // character row and has no such endpoint; its slots are plain stat-block
  // data, changed by the same rules and saved like any other follower edit.

  /** What the strip says under the selected level; a new one also selects its level. */
  readonly slotNotice = signal<SlotNotice | null>(null);
  /** A spend or restore is on its way to the server. */
  readonly slotsBusy = signal(false);

  /** Whether a DM stands over these slots: the character's campaign, or for a follower its owner's. */
  private get slotsHaveDm(): boolean {
    return this.followerMode ? this.followerOwnerInCampaign : this.pc?.campaignId != null;
  }

  /** A slot may be spent by hand at any time by the owner, or by the DM on their behalf. */
  get canSpendSlots(): boolean {
    return this.editable || this.ownSheet;
  }

  /**
   * Slots come back from the DM (or a rest). The owner may restore their own
   * only while the character is in no campaign, where there is no DM to ask.
   */
  get canRestoreSlots(): boolean {
    return this.editable || (this.ownSheet && !this.slotsHaveDm);
  }

  /**
   * "Slot maximum" in the strip's detail row. A character's opens the same
   * breakdown as Armor Class, for the same people: everyone may look, whoever
   * may adjust the character may add lines. A follower has no lines; only the
   * DM gets the button there, and it opens a plain number to type.
   */
  get slotMaximumAccess(): 'hidden' | 'view' | 'edit' {
    if (this.followerMode) return this.editable ? 'edit' : 'hidden';
    return this.canAdjustStats ? 'edit' : 'view';
  }

  onSlotSpend(level: number): void {
    if (!this.canSpendSlots) return;
    if (this.followerMode) {
      this.changeFollowerSlots(spendSlot(this.pc.spellSlots, level), slotSpentNotice(level),
        `No ${ordinal(level)}-level slot is left to spend.`);
      return;
    }
    this.requestSlotChange(() => this.pcService.spendSpellSlot(this.pc.id, level, this.editable),
      slotSpentNotice(level), 'Could not spend that slot. Try again.');
  }

  onSlotRestore(level: number): void {
    if (!this.canRestoreSlots) return;
    if (this.followerMode) {
      this.changeFollowerSlots(restoreSlot(this.pc.spellSlots, level), slotRestoredNotice(level),
        `No ${ordinal(level)}-level slot is spent.`);
      return;
    }
    this.requestSlotChange(() => this.pcService.restoreSpellSlot(this.pc.id, level, this.editable),
      slotRestoredNotice(level), 'Could not restore that slot. Try again.');
  }

  onSlotsRestoreAll(): void {
    if (!this.canRestoreSlots) return;
    if (this.followerMode) {
      this.changeFollowerSlots(restoreAllSlots(this.pc.spellSlots), allSlotsRestoredNotice(), '');
      return;
    }
    this.requestSlotChange(() => this.pcService.restoreAllSpellSlots(this.pc.id, this.editable),
      allSlotsRestoredNotice(), 'Could not restore the slots. Try again.');
  }

  /**
   * Send a spend or restore and wait for the server's slots. PCService puts
   * them on the character; here they also go onto the live session's snapshot
   * (the sheet embedded in a session reads its slots from there), and the strip
   * is told what happened. A refusal says why, and the slots are read again:
   * the server only refuses what the sheet wrongly thought possible.
   */
  private requestSlotChange(request: () => Observable<SpellSlots>, notice: SlotNotice, failed: string): void {
    // One at a time: the request is only made once the last one has answered.
    if (this.slotsBusy()) return;
    const pcId = this.pc.id;
    const asDm = this.editable;
    this.slotsBusy.set(true);
    request().subscribe({
      next: slots => {
        this.slotsBusy.set(false);
        this.sessionService.applySpellSlots(pcId, slots);
        if (this.pc?.id === pcId) this.slotNotice.set(notice);
      },
      error: err => {
        this.slotsBusy.set(false);
        this.notifications.error(failed, err);
        this.pcService.refreshSpellSlots(pcId, asDm);
        this.refreshSessionIfLive();
      },
    });
  }

  /** A follower's slots: `slots` is the outcome of the same rules, or null when they refuse. */
  private changeFollowerSlots(slots: SpellSlots | null, notice: SlotNotice, refused: string): void {
    if (!slots) {
      this.notifications.notify(refused);
      return;
    }
    this.persist({ ...this.pc, spellSlots: slots });
    this.slotNotice.set(notice);
  }

  /** "Slot maximum" was pressed for a spell level in the strip. */
  onSlotMaximumRequested(level: number): void {
    if (!this.followerMode) {
      this.onBreakdownRequested(slotStat(level));
      return;
    }
    if (!this.editable) return;
    // A follower's maximum is whatever its stat block says: the DM types it.
    this.onDmEditRequested({
      label: `${ordinal(level)}-level slot maximum`,
      value: slotMaxOf(this.pc.spellSlots, level),
      min: 1,
      max: null,
      apply: v => ({ ...this.pc, spellSlots: withSlotMax(this.pc.spellSlots, level, v) }),
    });
  }

  // ── Portrait helpers ────────────────────────────────────────────────────────

  /** CSS background value for portrait circle. Delegates to shared utility. */
  tintFor(pc: PC): string { return tintFor(pc); }

  /** Hero classes (Death Knight, Demon Hunter, …) — show the hero-class panel on the sheet tab. */
  get heroClass(): boolean { return isHeroClass(this.pc); }

  /** Header suffix for a hero-class specialization ("Frost Rune", "Havoc", "Balance"); '' otherwise. */
  get specializationTitle(): string {
    const hero = heroClassFor(this.pc);
    return hero && this.pc?.specialization ? specializationTitle(hero, this.pc.specialization) : '';
  }

  /**
   * The parenthesised part of the header after the class name: subclass and
   * specialization joined by " · " ("Oath of the Ebon Blade · Frost Rune"), or
   * just the specialization for a WoW Druid before level 3 ("Druid (Balance)").
   */
  get subtitleSuffix(): string {
    return [this.pc?.subclass, this.specializationTitle].filter(p => !!p).join(' · ');
  }

  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  // ── Name editing ─────────────────────────────────────────────────────────────

  startNameEdit(): void {
    this.nameDraft = this.pc.name;
    this.editingName = true;
  }

  commitName(): void {
    this.editingName = false;
    const trimmed = this.nameDraft.trim();
    if (trimmed && trimmed !== this.pc.name) {
      this.persist({ ...this.pc, name: trimmed });
    } else {
      this.nameDraft = this.pc.name;
    }
  }

  cancelNameEdit(): void {
    this.editingName = false;
    this.nameDraft = this.pc.name;
  }

  // ── Level editing (DM cross-link) ───────────────────────────────────────────
  // Level drives proficiency and the hit-dice pool display; editing it here keeps
  // the header as the single place a level is shown and changed.

  onLevelCommit(level: number): void {
    this.persist({ ...this.pc, level });
  }

  /** DM clicked (intercepted) the level number — request the edit modal instead
   *  of the inline editor. Label matches the backend's own diff vocabulary. */
  requestLevel(): void {
    this.onDmEditRequested({
      label: 'level',
      value: this.pc.level ?? null,
      min: 1,
      max: 20,
      apply: v => ({ ...this.pc, level: v }),
    });
  }

  // ── XP editing (DM cross-link) ──────────────────────────────────────────────
  // XP normally accumulates via session awards; this is the DM's correction
  // path on the member sheet — same intercepted-edit-modal flow as the level.

  onXpCommit(xp: number): void {
    this.persist({ ...this.pc, xp: Math.max(0, xp) });
  }

  /** DM clicked (intercepted) the XP total — request the edit modal instead of
   *  the inline editor. Label matches the backend's own diff vocabulary. */
  requestXp(): void {
    this.onDmEditRequested({
      label: 'XP',
      value: this.pc.xp ?? 0,
      min: 0,
      max: null,
      apply: v => ({ ...this.pc, xp: v }),
    });
  }

  // ── Heroic Inspiration meter ────────────────────────────────────────────────
  // Server-owned fields: the DM clicks the pips to set the meter (filling it
  // converts into Heroic Inspiration), the owner (or DM) spends the badge. In a
  // live session the snapshot carries these fields but a use doesn't bump the
  // session version, so we force one off-cadence refresh to keep viewers honest.

  // Signal: cleared from HTTP callbacks, which never mark an OnPush view on their own.
  readonly inspirationBusy = signal(false);

  /**
   * The conditions panel resolved a pip click to a new meter value (it owns the
   * click-to-set / re-click-to-lower gesture, shared with its exhaustion
   * tracker). Persisting is ours: these are server-owned fields with their own
   * endpoint, not part of a generic sheet save.
   */
  onInspirationChange(pips: number): void {
    if (this.followerMode) {
      // No server-owned meter for a follower — apply the same fill rule locally.
      const value = Math.max(0, Math.min(5, pips));
      this.persist(value >= 5
        ? { ...this.pc, inspirationPips: 0, heroicInspiration: true }
        : { ...this.pc, inspirationPips: value });
      return;
    }
    if (this.inspirationBusy()) return;
    this.inspirationBusy.set(true);
    this.pcService.setInspirationPips(this.pc.id, pips).subscribe({
      next: () => { this.inspirationBusy.set(false); this.refreshSessionIfLive(); },
      error: err => {
        this.inspirationBusy.set(false);
        this.notifications.error('Could not change the inspiration meter. Try again.', err);
      },
    });
  }

  /** Owner (or DM) spends Heroic Inspiration after using the reroll. */
  useInspiration(): void {
    if (this.followerMode) {
      this.persist({ ...this.pc, heroicInspiration: false });
      return;
    }
    if (this.inspirationBusy()) return;
    this.inspirationBusy.set(true);
    this.pcService.useInspiration(this.pc.id).subscribe({
      next: () => { this.inspirationBusy.set(false); this.refreshSessionIfLive(); },
      error: err => {
        this.inspirationBusy.set(false);
        this.notifications.error('Could not spend Heroic Inspiration. Try again.', err);
      },
    });
  }

  private refreshSessionIfLive(): void {
    if (this.sessionLive) this.sessionService.refresh();
  }

  /** In-session: the player spends a hit die (short-rest window open). */
  onSpendHitDie(): void {
    this.spendHitDieRequested.emit();
  }

  // ── DM edit modal ────────────────────────────────────────────────────────
  // Opened when any intercepted app-editable-number on this sheet (level here,
  // or one bubbled up from vitals-strip/coin-purse/ability-scores) is clicked
  // in DM cross-link mode, instead of that control's own inline editor.

  dmEdit: DmEditRequest | null = null;

  onDmEditRequested(request: DmEditRequest): void {
    this.dmEdit = request;
  }

  onDmEditConfirmed(result: DmEditConfirm): void {
    if (!this.dmEdit) return;
    this.persist(this.dmEdit.apply(result.value), result.description);
    this.dmEdit = null;
  }

  closeDmEdit(): void {
    this.dmEdit = null;
  }

  // ── Number breakdown ─────────────────────────────────────────────────────
  // Clicking a calculated number (Armor Class, or a spell level's slot maximum
  // from the strip on the Spells tab) shows the lines that make it up. Everyone
  // may look; whoever may adjust the character can add labelled lines under the
  // automatic ones ("+1 Taunka") and, for Armor Class, take an automatic line out.

  /** The breakdown on screen, read once when the dialog opened; null when closed. */
  statBreakdown: StatBreakdown | null = null;

  /**
   * Who may change adjustment lines: the DM (cross-link view), or the owner of
   * a character that is in no campaign and so has no DM. The server enforces
   * the same rule. Followers have no stored adjustments at all.
   */
  get canAdjustStats(): boolean {
    if (this.followerMode) return false;
    return this.editable || (this.ownSheet && this.pc.campaignId == null);
  }

  onBreakdownRequested(stat: AdjustableStat): void {
    this.statBreakdown = breakdownOf(this.pc, stat);
  }

  closeStatBreakdown(): void {
    this.statBreakdown = null;
  }

  /**
   * Save the lines from the breakdown dialog. A DM's save goes through the same
   * refetch-merge-save as a grant, so the lines land on a fresh copy of the
   * character (the armor a player just swapped stays swapped) and the log says
   * what was added, removed or taken out of the total. An owner's save has no
   * log and uses the sheet's own copy.
   */
  onStatAdjustmentsSaved(result: StatBreakdownSave): void {
    if (!this.statBreakdown || !this.canAdjustStats) return;
    const stat = this.statBreakdown.stat;
    this.statBreakdown = null;
    const mutate = (fresh: PC): PC => applyAdjustments(
      fresh, stat, result.lines, result.keepUnlabelled, { removed: result.removed });
    if (!this.editable) {
      this.persist(mutate(this.pc));
      return;
    }
    this.grantService.grantToPc(this.pc.id, mutate,
      (fresh, updated) => describeAdjustmentChange(stat, breakdownOf(fresh, stat), breakdownOf(updated, stat)),
    ).subscribe({ error: err => this.notifications.error('Could not save the adjustments. Try again.', err) });
  }

  // ── Conditions (wired fully in Phase 5) ─────────────────────────────────────

  onConditionToggle(condition: string): void {
    const conditions = this.pc.conditions ?? [];
    const next = conditions.includes(condition)
      ? conditions.filter(c => c !== condition)
      : [...conditions, condition];
    this.persist({ ...this.pc, conditions: next });
  }

  /** Exhaustion tracker (conditions panel, 2024 PHB levels 0–6). Clamped here
   *  and persisted exactly like a condition toggle: owner path on the player's
   *  own sheet, DM-authorized path in cross-link mode. */
  onExhaustionChange(level: number): void {
    this.persist({ ...this.pc, exhaustion: Math.max(0, Math.min(6, level)) });
  }

  // ── DM grants ────────────────────────────────────────────────────────────
  // Grants go through GrantService's refetch-merge-save rather than persist() —
  // the sheet's `pc` copy can be stale by the time the DM submits the form, and
  // PUTting it directly risks clobbering a concurrent player edit.

  /**
   * Apply a grant. A character goes through GrantService (above); a follower
   * has no PC row to refetch, so the same pure mutation runs on the sheet's
   * copy and is saved like any other follower edit.
   */
  private grant(mutate: (fresh: PC) => PC, what: string): void {
    if (this.followerMode) {
      this.followerChanged.emit(mutate(this.pc));
      return;
    }
    this.grantService.grantToPc(this.pc.id, mutate)
      .subscribe({ error: err => this.notifications.error(`Could not grant the ${what}. Try again.`, err) });
  }

  onFeatureGrant(f: { name: string; source: string; desc: string }): void {
    this.grant(fresh => ({ ...fresh, features: [...(fresh.features ?? []), f] }), 'feature');
  }

  /** Same refetch-merge-save as onFeatureGrant, but the entry lands in the
   *  Other Features panel — tagged category 'other' here (the single place the
   *  tag is stamped) so the panels can split one features array cleanly. */
  onOtherFeatureGrant(f: { name: string; source: string; desc: string }): void {
    this.grant(fresh => ({
      ...fresh,
      features: [...(fresh.features ?? []), { ...f, category: 'other' as const }],
    }), 'feature');
  }

  onSpellsGrant(granted: PcSpell[]): void {
    this.grant(fresh => {
      // Dedupe against the FRESH copy — the player may have learned one of these
      // spells (e.g. via level-up) in the moments between the picker opening and
      // the DM confirming the grant.
      const known = new Set((fresh.spells ?? []).map(s => s.name.toLowerCase()));
      const toAdd = granted.filter(s => !known.has(s.name.toLowerCase()));
      return { ...fresh, spells: [...(fresh.spells ?? []), ...toAdd] };
    }, 'spells');
  }

  onLanguageGrant(language: string): void {
    this.grant(fresh => {
      // Dedupe against the FRESH copy — the player may have gained the language
      // between the form opening and the DM confirming the grant.
      const known = new Set((fresh.languages ?? []).map(l => l.toLowerCase()));
      if (known.has(language.toLowerCase())) return fresh;
      return { ...fresh, languages: [...(fresh.languages ?? []), language] };
    }, 'language');
  }

  onItemGrant(item: PcItem): void {
    this.grant(fresh => {
      // Stack onto an existing catalog line (mirrors the backend purchase path);
      // ad-hoc items have no catalogKey and always append. Granted items arrive
      // unequipped, so there's no AC to recompute.
      const inventory = (fresh.inventory ?? []).map(i => ({ ...i }));
      const line = item.catalogKey ? inventory.find(i => i.catalogKey === item.catalogKey) : undefined;
      if (line) {
        line.qty = (line.qty ?? 0) + (item.qty ?? 1);
        // Backfill the catalog bulk/weight onto a pre-slot-variant line that
        // never got stamped — otherwise the stack keeps deriving its bulk
        // from a weight band that can disagree with the official rating.
        // Never overwrites an existing value (same rule as the conversion).
        if (line.bulk == null && item.bulk != null) line.bulk = item.bulk;
        if (line.weight == null && item.weight != null) line.weight = item.weight;
      } else {
        inventory.push(item);
      }
      return { ...fresh, inventory };
    }, 'item');
  }
}
