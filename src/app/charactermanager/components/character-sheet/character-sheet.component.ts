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
  @Output() deleteRequested = new EventEmitter<void>();

  editingName = false;
  nameDraft = '';

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pc']) {
      // Reset name edit state whenever a new PC is loaded
      this.editingName = false;
      this.nameDraft = this.pc?.name ?? '';
    }
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
      this.pcService.updatePC({ ...this.pc, name: trimmed }).subscribe();
    } else {
      this.nameDraft = this.pc.name;
    }
  }

  cancelNameEdit(): void {
    this.editingName = false;
    this.nameDraft = this.pc.name;
  }

  // ── HP ───────────────────────────────────────────────────────────────────────

  updateHP(delta: number): void {
    if (!this.pc.hp) return;
    const cur = Math.max(0, Math.min(this.pc.hp.max, this.pc.hp.cur + delta));
    this.pcService.updatePC({ ...this.pc, hp: { ...this.pc.hp, cur } }).subscribe();
  }

  // ── Conditions (wired fully in Phase 5) ─────────────────────────────────────

  onConditionToggle(condition: string): void {
    const conditions = this.pc.conditions ?? [];
    const next = conditions.includes(condition)
      ? conditions.filter(c => c !== condition)
      : [...conditions, condition];
    this.pcService.updatePC({ ...this.pc, conditions: next }).subscribe();
  }

  // ── Spell slots (wired fully in Phase 5) ────────────────────────────────────

  onSlotToggle(level: number, index: number): void {
    const slots = { ...(this.pc.spellSlots ?? {}) };
    const slot = slots[level];
    if (!slot) return;
    const used = index < slot.used ? index : index + 1;
    slots[level] = { ...slot, used: Math.min(slot.max, Math.max(0, used)) };
    this.pcService.updatePC({ ...this.pc, spellSlots: slots }).subscribe();
  }
}
