import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { tintFor } from '../../utils/character-math';

@Component({
  selector: 'app-character-sheet',
  templateUrl: './character-sheet.component.html',
  styleUrls: ['./character-sheet.component.scss']
})
export class CharacterSheetComponent implements OnChanges {
  @Input() pc!: PC;
  /**
   * When true, the sheet's numbers become click-to-edit and changes persist via
   * the DM-authorized path. Driven by UiState.dmReturn$ — i.e. a DM viewing one
   * of their campaign members (cross-linked from the dashboard).
   */
  @Input() editable = false;
  @Output() deleteRequested = new EventEmitter<void>();
  @Output() rollRequested = new EventEmitter<void>();
  @Output() levelUpRequested = new EventEmitter<void>();
  /** Player asks to connect to their campaign's live session. */
  @Output() connectRequested = new EventEmitter<void>();

  /** Whether this PC belongs to a campaign (gates the Connect button). */
  get inCampaign(): boolean {
    return this.pc?.campaignId != null;
  }

  /** Briefly shows the "not in a campaign" hint after a click (hover shows it via CSS). */
  connectHintPinned = false;

  onConnectClick(): void {
    if (this.inCampaign) {
      this.connectRequested.emit();
      return;
    }
    this.connectHintPinned = true;
    setTimeout(() => (this.connectHintPinned = false), 2500);
  }

  editingName = false;
  nameDraft = '';
  editingLevel = false;
  levelDraft: number | null = null;

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pc']) {
      // Reset edit state whenever a new PC is loaded
      this.editingName = false;
      this.nameDraft = this.pc?.name ?? '';
      this.editingLevel = false;
      this.levelDraft = this.pc?.level ?? 1;
    }
  }

  /**
   * Persist an updated PC. In editable (DM cross-link) mode this goes through the
   * DM-authorized path so a DM may save another player's character; otherwise it
   * uses the owner path. PCService pushes the result into activePC$, so the sheet
   * refreshes itself.
   */
  private persist(updated: PC): void {
    const save$ = this.editable
      ? this.pcService.updatePCAsDm(updated)
      : this.pcService.updatePC(updated);
    save$.subscribe({ error: err => console.error('Failed to save character', err) });
  }

  /** A child panel emitted a fully-updated PC (e.g. an ability score changed). */
  onPcChange(updated: PC): void {
    this.persist(updated);
  }

  // ── Portrait helpers ────────────────────────────────────────────────────────

  /** CSS background value for portrait circle. Delegates to shared utility. */
  tintFor(pc: PC): string { return tintFor(pc); }

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

  // ── Conditions (wired fully in Phase 5) ─────────────────────────────────────

  onConditionToggle(condition: string): void {
    const conditions = this.pc.conditions ?? [];
    const next = conditions.includes(condition)
      ? conditions.filter(c => c !== condition)
      : [...conditions, condition];
    this.persist({ ...this.pc, conditions: next });
  }

  // ── Spell slots (wired fully in Phase 5) ────────────────────────────────────

  onSlotToggle(level: number, index: number): void {
    const slots = { ...(this.pc.spellSlots ?? {}) };
    const slot = slots[level];
    if (!slot) return;
    const used = index < slot.used ? index : index + 1;
    slots[level] = { ...slot, used: Math.min(slot.max, Math.max(0, used)) };
    this.persist({ ...this.pc, spellSlots: slots });
  }
}
