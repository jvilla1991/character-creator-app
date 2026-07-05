import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { NotificationService } from '../../services/notification.service';
import { CampaignService } from '../../services/campaign.service';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent implements OnInit, OnDestroy {
  pc: PC | null = null;
  /** True while a DM is viewing a campaign member's sheet → numbers are editable. */
  editable = false;
  /** True when the active PC's campaign uses the slot-based inventory variant. */
  slotInventory = false;
  /** True when the active PC's campaign uses the survival-conditions variant. */
  survivalConditions = false;
  /** True when the active PC's campaign uses the strict material-components variant. */
  strictComponents = false;
  isDeleteModalOpen = false;
  isRollModalOpen = false;
  isLevelUpModalOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private sessionService: SessionService,
    private uiState: UiStateService,
    private notifications: NotificationService,
    private campaignService: CampaignService,
  ) {}

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
      .pipe(takeUntil(this.destroy$))
      .subscribe(pc => {
        this.pc = pc;
        this.resolveVariants(pc);
      });

    this.uiState.dmReturn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isDmViewing => { this.editable = isDmViewing; });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Look up the PC's campaign variant rules (all false when unknown). */
  private resolveVariants(pc: PC | null): void {
    this.slotInventory = false;
    this.survivalConditions = false;
    this.strictComponents = false;
    if (!pc || pc.campaignId == null) return;
    const pcId = pc.id;
    this.campaignService.getSummary(pc.campaignId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: summary => {
          // Guard against a stale response after switching characters.
          if (this.pc?.id === pcId) {
            this.slotInventory = !!summary.variantRules?.slotInventory;
            this.survivalConditions = !!summary.variantRules?.survivalConditions;
            this.strictComponents = !!summary.variantRules?.strictComponents;
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

  // ── Dice roller modal ──────────────────────────────────────────────────────

  openRollModal(): void  { this.isRollModalOpen = true;  }
  closeRollModal(): void { this.isRollModalOpen = false; }

  // ── Level-up modal ─────────────────────────────────────────────────────────
  // The modal owns the preview→confirm→commit flow; PCService pushes the updated PC
  // into activePC$, so the sheet refreshes itself. Here we only toggle visibility.

  openLevelUpModal(): void  { this.isLevelUpModalOpen = true;  }
  closeLevelUpModal(): void { this.isLevelUpModalOpen = false; }

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
