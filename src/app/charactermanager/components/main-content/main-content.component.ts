import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { CharacterModalService } from '../../services/character-modal.service';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent implements OnInit, OnDestroy {
  pc: PC | null = null;
  isDeleteModalOpen = false;
  isRollModalOpen = false;
  isLevelUpModalOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
  ) {}

  ngOnInit(): void {
    this.pcService.getActivePC()
      .pipe(takeUntil(this.destroy$))
      .subscribe(pc => { this.pc = pc; });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
