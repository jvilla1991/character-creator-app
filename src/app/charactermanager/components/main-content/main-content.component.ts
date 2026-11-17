import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PC } from '../../models/pc';
import { CampaignLocation } from '../../models/campaign';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { CampaignService } from '../../services/campaign.service';
import { JoinModalService } from '../../services/join-modal.service';
import { DiceRollerService } from '../../services/dice-roller.service';
import { LevelUpPromptService } from '../../services/level-up-prompt.service';
import { RouterOutlet } from '@angular/router';
import { CharacterSheetComponent } from '../character-sheet/character-sheet.component';
import { EmptyStateComponent } from '../character-sheet/empty-state/empty-state.component';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
    selector: 'app-main-content',
    templateUrl: './main-content.component.html',
    styleUrls: ['./main-content.component.scss'],
    imports: [RouterOutlet, CharacterSheetComponent, EmptyStateComponent, DeleteConfirmationModalComponent]
})
export class MainContentComponent implements OnInit, OnDestroy {
  pc: PC | null = null;
  /** True while a DM is viewing a campaign member's sheet → numbers are editable. */
  readonly editable = this.uiState.dmReturn;
  /** True when the active PC's campaign uses the slot-based inventory variant. */
  slotInventory = false;
  /** True when the active PC's campaign uses the survival-conditions variant. */
  survivalConditions = false;
  /** True when the active PC's campaign uses the strict material-components variant. */
  strictComponents = false;
  /** The active PC's campaign's current party location (null when none). */
  location: CampaignLocation | null = null;
  isDeleteModalOpen = false;

  private readonly levelUpPrompt = inject(LevelUpPromptService);

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private sessionService: SessionService,
    private uiState: UiStateService,
    private notifications: NotificationService,
    private campaignService: CampaignService,
    private joinModal: JoinModalService,
    private dice: DiceRollerService,
    private destroyRef: DestroyRef,
  ) {}

  /** Sheet's Join Campaign button — open the join modal with this PC preselected. */
  openJoinModal(): void {
    this.joinModal.open(this.pc?.id);
  }

  // ── Session connect ────────────────────────────────────────────────────────
  // Join this character's campaign session if the DM has one live, then open the
  // session screen. No-op when the PC isn't in a campaign; tells the player when
  // no session is live yet or the join itself fails.

  connectToSession(): void {
    if (!this.pc || this.pc.campaignId == null) return;
    const campaignId = String(this.pc.campaignId);
    const pcId = this.pc.id;
    this.sessionService.getActiveForCampaign(campaignId).subscribe(session => {
      if (!session) {
        this.notifications.notify("Your DM hasn't started a session yet.");
        return;
      }
      this.sessionService.joinSession(session.sessionId, pcId).subscribe({
        next: joined => this.uiState.openSession(String(joined.sessionId)),
        error: () => this.notifications.notify('Could not connect to the session. Try again.'),
      });
    });
  }

  ngOnInit(): void {
    this.pcService.getActivePC()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(pc => {
        this.pc = pc;
        this.resolveVariants(pc);
        this.refetchOnActivation(pc);
        this.promptIfReady(pc);
      });
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisible);
    // A DM's level-up of a member belongs to this sheet: leaving it (e.g. Back
    // to the campaign) closes the modal. A player's own modal stays put.
    if (this.levelUpPrompt.levelUp()?.asDm) this.levelUpPrompt.closeLevelUp();
  }

  // ── Level-up prompt ────────────────────────────────────────────────────────
  // Every emission of the active PC — selection, the activation/refocus
  // refetch below, a local patch — is a chance to notice it can now level (a
  // DM grant or an XP threshold) and offer the gold-glow prompt. Only for the
  // player's own character: never in DM cross-link view (so the DM's own
  // Grant Level-Up click can't prompt the DM), and only for a PC in the
  // signed-in user's roster.

  private promptIfReady(pc: PC | null): void {
    if (!pc || this.editable()) return;
    if (!this.pcService.getPCById(pc.id)) return;
    this.levelUpPrompt.evaluate(pc);
  }

  // ── Cross-client freshness ─────────────────────────────────────────────────
  // The local PC store is loaded once at app start, so changes made from
  // another client — e.g. the DM granting a pending level-up — never reach
  // this sheet on their own (the Level Up button stayed dead until a full page
  // reload). Refetch the PC when it lands on the sheet (also covers returning
  // from a session, where this component is recreated) and when the tab
  // regains visibility — the same refetch-on-refocus valve the campaign
  // sidebar/dashboard use. No background polling. Skipped in DM cross-link
  // view: that PC was just fetched via the DM path, and the owner-scoped
  // find endpoint isn't authorized for it anyway.

  /** Guards the activation refetch: the refreshed push re-emits the same id. */
  private lastRefetchedPcId: number | null = null;

  private refetchOnActivation(pc: PC | null): void {
    if (!pc || this.editable()) {
      this.lastRefetchedPcId = null;
      return;
    }
    if (pc.id === this.lastRefetchedPcId) return;
    this.lastRefetchedPcId = pc.id;
    this.pcService.refreshPC(pc.id);
  }

  private readonly onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    if (!this.pc || this.editable()) return;
    this.pcService.refreshPC(this.pc.id);
  };

  /** Look up the PC's campaign variant rules (all false when unknown). */
  private resolveVariants(pc: PC | null): void {
    this.slotInventory = false;
    this.survivalConditions = false;
    this.strictComponents = false;
    this.location = null;
    if (!pc || pc.campaignId == null) return;
    const pcId = pc.id;
    this.campaignService.getSummary(pc.campaignId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: summary => {
          // Guard against a stale response after switching characters.
          if (this.pc?.id === pcId) {
            this.slotInventory = !!summary.variantRules?.slotInventory;
            this.survivalConditions = !!summary.variantRules?.survivalConditions;
            this.strictComponents = !!summary.variantRules?.strictComponents;
            this.location = summary.location ?? null;
          }
        },
        error: () => { /* not a member / offline — keep the standard view */ },
      });
  }

  // ── Create modal ─────────────────────────────────────────────────────────

  openCreateModal(): void { this.characterModal.openCreateModal(); }

  // ── Delete modal ─────────────────────────────────────────────────────────

  openDeleteModal(): void  { this.isDeleteModalOpen = true;  }
  closeDeleteModal(): void { this.isDeleteModalOpen = false; }

  // ── Dice roller ────────────────────────────────────────────────────────────
  // The sheet's dice icon is one of several triggers for the shell-level
  // roller; the service works out whether the roll logs to a live session.

  openRollModal(): void { this.dice.open(); }

  // ── Level-up modal ─────────────────────────────────────────────────────────
  // The modal owns the preview→confirm→commit flow; PCService pushes the updated PC
  // into activePC$, so the sheet refreshes itself. The modal itself is hosted
  // once at the shell (it also opens from the level-up prompt, including over a
  // live session); this only asks for it. In DM cross-link view it uses the
  // DM-authorized endpoints.

  openLevelUpModal(): void {
    if (this.pc) this.levelUpPrompt.openLevelUp(this.pc, this.editable());
  }

  onDeleteConfirm(): void {
    if (!this.pc) return;
    this.pcService.deletePC(this.pc.id).subscribe({
      complete: () => {
        this.closeDeleteModal();
        this.pcService.clearActivePC();
        this.pcService.refreshPCs();
      },
      error: err => console.error('Error deleting character:', err)
    });
  }
}
