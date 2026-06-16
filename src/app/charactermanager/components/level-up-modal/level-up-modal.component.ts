import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { PC } from '../../models/pc';
import { LevelUpPreview } from '../../models/level-up';
import { PCService } from '../../services/pc.service';
import { fmtMod } from '../../utils/character-math';

/**
 * Focused, single-level "Level Up" modal — mirrors the create wizard's pattern of applying
 * one well-scoped set of gains at a time. It is a thin presenter: it loads the server-computed
 * {@link LevelUpPreview} to show the deltas, then on confirm commits the advance via PCService
 * (the backend is the rules authority). PCService pushes the updated PC into activePC$, so the
 * character sheet refreshes itself — the modal only has to close.
 *
 * <p>Phase 1 covers HP + proficiency bonus. Later phases (spell slots, subclass, ASI/feat,
 * features) extend this with additional choice steps; the load-preview → confirm flow stays.
 */
@Component({
  selector: 'app-level-up-modal',
  templateUrl: './level-up-modal.component.html',
  styleUrls: ['./level-up-modal.component.scss'],
})
export class LevelUpModalComponent implements OnInit {
  @Input() pc!: PC;
  @Output() close = new EventEmitter<void>();

  preview: LevelUpPreview | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  selectedSubclass: string | null = null;

  constructor(private pcService: PCService) {}

  ngOnInit(): void {
    this.pcService.levelUpPreview(this.pc.id).subscribe({
      next: preview => {
        this.preview = preview;
        this.loading = false;
      },
      error: err => {
        this.error = this.messageFrom(err, 'Could not work out this level-up.');
        this.loading = false;
      },
    });
  }

  fmtMod(value: number): string {
    return fmtMod(value);
  }

  /** Whether the proficiency bonus changes on this level (drives a highlight). */
  get profChanged(): boolean {
    return !!this.preview && this.preview.newProfBonus !== this.preview.currentProfBonus;
  }

  /** Per-spell-level slot picture for casters: { level, current, next, gained }. Empty otherwise. */
  get slotRows(): { level: number; current: number; next: number; gained: boolean }[] {
    const p = this.preview;
    if (!p || !p.newSpellSlots) return [];
    return Object.keys(p.newSpellSlots)
      .map(k => Number(k))
      .sort((a, b) => a - b)
      .map(level => {
        const next = p.newSpellSlots[level] ?? 0;
        const current = p.currentSpellSlots?.[level] ?? 0;
        return { level, current, next, gained: next > current };
      });
  }

  /** True when this level grants new or additional spell slots (shows the slots row). */
  get hasSlotChanges(): boolean {
    return this.slotRows.some(r => r.gained);
  }

  /** Whether to show the subclass picker: a choice is due AND the server offered options. */
  get needsSubclass(): boolean {
    return !!this.preview?.subclassDue && (this.preview?.subclassOptions?.length ?? 0) > 0;
  }

  /** Confirm is blocked until a subclass is chosen when one is required. */
  get canConfirm(): boolean {
    return !this.needsSubclass || !!this.selectedSubclass;
  }

  confirm(): void {
    if (!this.preview || this.submitting || !this.canConfirm) return;
    this.submitting = true;
    this.error = null;
    this.pcService.levelUp(this.pc.id, this.selectedSubclass ?? undefined).subscribe({
      next: () => this.close.emit(),
      error: err => {
        this.error = this.messageFrom(err, 'Level-up failed. Please try again.');
        this.submitting = false;
      },
    });
  }

  cancel(): void {
    if (this.submitting) return;
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  private messageFrom(err: unknown, fallback: string): string {
    const maybe = err as { error?: { message?: string } };
    return maybe?.error?.message ?? fallback;
  }
}
