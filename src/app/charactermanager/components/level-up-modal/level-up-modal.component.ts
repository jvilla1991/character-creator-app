import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { PC } from '../../models/pc';
import { LevelUpPreview, LevelUpChoices, HpMode } from '../../models/level-up';
import { DndSpell } from '../../models/dnd-api.types';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { fmtMod } from '../../utils/character-math';
import { toPcSpell } from '../../utils/spell-mapping';

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
    standalone: false
})
export class LevelUpModalComponent implements OnInit {
  @Input() pc!: PC;
  @Output() close = new EventEmitter<void>();

  preview: LevelUpPreview | null = null;
  loading = true;
  submitting = false;
  error: string | null = null;
  selectedSubclass: string | null = null;

  /**
   * HP mode for this level: take the fixed average (default) or roll the hit die. In 'ROLL' the
   * server does the rolling on confirm — the preview keeps showing the average, so the displayed
   * "+HP" is an estimate until committed. Only sent to the server when 'ROLL' (AVERAGE is implied).
   */
  hpMode: HpMode = 'AVERAGE';

  readonly abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  /** Points allocated this ASI per ability (0/1/2); total must reach 2 to confirm. */
  asiAllocation: { [ability: string]: number } = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };

  /** At an ASI level, whether the player is taking an ASI or a feat. */
  milestoneMode: 'asi' | 'feat' = 'asi';
  selectedFeat: string | null = null;

  /** Spell selection (casters who gain cantrips/spells this level). */
  spellList: DndSpell[] = [];
  selectedSpells: DndSpell[] = [];
  loadingSpells = false;

  constructor(private pcService: PCService, private dndResources: DndResourcesService) {}

  ngOnInit(): void {
    this.pcService.levelUpPreview(this.pc.id).subscribe({
      next: preview => {
        this.preview = preview;
        this.loading = false;
        if (this.cantripDelta > 0 || this.spellDelta > 0) this.loadSpells();
      },
      error: err => {
        this.error = this.messageFrom(err, 'Could not work out this level-up.');
        this.loading = false;
      },
    });
  }

  // ── Spell selection (learning new cantrips/spells) ──────────────────────────

  private loadSpells(): void {
    this.loadingSpells = true;
    const known = new Set((this.pc.spells ?? []).map(s => s.name.toLowerCase()));
    this.dndResources.getSpellsForClass(this.pc.clazz).subscribe({
      next: spells => {
        this.spellList = spells.filter(s => !known.has(s.name.toLowerCase()));
        this.loadingSpells = false;
      },
      error: () => { this.loadingSpells = false; },
    });
  }

  /** How many new cantrips / leveled spells the player may learn this level. */
  get cantripDelta(): number {
    return this.preview ? Math.max(0, this.preview.newCantripsKnown - this.preview.currentCantripsKnown) : 0;
  }

  get spellDelta(): number {
    return this.preview ? Math.max(0, this.preview.newSpellsKnown - this.preview.currentSpellsKnown) : 0;
  }

  /** Show the spell picker when this level grants any new cantrips or spells. */
  get showSpellPicker(): boolean {
    return this.cantripDelta > 0 || this.spellDelta > 0;
  }

  get selectedCantripCount(): number {
    return this.selectedSpells.filter(s => s.level === 0).length;
  }

  get selectedSpellCount(): number {
    return this.selectedSpells.filter(s => s.level > 0).length;
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

  /** Whether to show the cantrips-known row (caster). */
  get showCantrips(): boolean {
    return (this.preview?.newCantripsKnown ?? 0) > 0;
  }

  /** Whether cantrips known increases this level. */
  get cantripsChanged(): boolean {
    return !!this.preview && this.preview.newCantripsKnown > this.preview.currentCantripsKnown;
  }

  /** Whether to show the subclass picker: a choice is due AND the server offered options. */
  get needsSubclass(): boolean {
    return !!this.preview?.subclassDue && (this.preview?.subclassOptions?.length ?? 0) > 0;
  }

  // ── Ability Score Improvement allocator ─────────────────────────────────────

  /** Whether an ASI is due this level (server-decided). */
  get needsAsi(): boolean {
    return !!this.preview?.asiDue;
  }

  /** Points spent so far (0–2). */
  get asiUsed(): number {
    return this.abilities.reduce((sum, a) => sum + this.asiAllocation[a], 0);
  }

  get asiRemaining(): number {
    return 2 - this.asiUsed;
  }

  /** A valid ASI spends exactly 2 points (= +2 to one ability or +1 to two). */
  get asiValid(): boolean {
    return this.asiUsed === 2;
  }

  /** Whether the pending ASI raises Constitution (HP will increase further on confirm). */
  get asiRaisesCon(): boolean {
    return this.asiAllocation['CON'] > 0;
  }

  currentScore(ability: string): number {
    return (this.pc.stats as Record<string, number> | undefined)?.[ability] ?? 10;
  }

  newScore(ability: string): number {
    return this.currentScore(ability) + this.asiAllocation[ability];
  }

  canInc(ability: string): boolean {
    return this.asiRemaining > 0 && this.asiAllocation[ability] < 2 && this.newScore(ability) < 20;
  }

  canDec(ability: string): boolean {
    return this.asiAllocation[ability] > 0;
  }

  incAsi(ability: string): void {
    if (this.canInc(ability)) this.asiAllocation[ability]++;
  }

  decAsi(ability: string): void {
    if (this.canDec(ability)) this.asiAllocation[ability]--;
  }

  // ── Feat option (the ASI alternative) ───────────────────────────────────────

  get featOptions(): string[] {
    return this.preview?.featOptions ?? [];
  }

  /** Class features automatically granted at this level (read-only). */
  get featuresGained(): { name: string; desc: string }[] {
    return this.preview?.featuresGained ?? [];
  }

  featDescription(name: string): string {
    return this.dndResources.getFeatDescription(name);
  }

  /** Whether the milestone choice (ASI or feat) is satisfied. */
  get milestoneSatisfied(): boolean {
    if (!this.needsAsi) return true;
    return this.milestoneMode === 'asi' ? this.asiValid : !!this.selectedFeat;
  }

  /** Confirm is blocked until any required subclass and milestone (ASI/feat) choices are made. */
  get canConfirm(): boolean {
    return (!this.needsSubclass || !!this.selectedSubclass) && this.milestoneSatisfied;
  }

  confirm(): void {
    if (!this.preview || this.submitting || !this.canConfirm) return;
    this.submitting = true;
    this.error = null;

    const choices: LevelUpChoices = {};
    // Only send the mode when rolling — omitting it lets the server default to AVERAGE.
    if (this.hpMode === 'ROLL') choices.hpMode = 'ROLL';
    if (this.selectedSubclass) choices.subclass = this.selectedSubclass;
    if (this.needsAsi) {
      if (this.milestoneMode === 'asi') {
        const increases = this.allocatedAbilities();
        if (Object.keys(increases).length) choices.abilityIncreases = increases;
      } else if (this.selectedFeat) {
        choices.feat = this.selectedFeat;
      }
    }
    if (this.selectedSpells.length) {
      choices.newSpells = this.selectedSpells.map(toPcSpell);
    }

    this.pcService.levelUp(this.pc.id, choices).subscribe({
      next: () => this.close.emit(),
      error: err => {
        this.error = this.messageFrom(err, 'Level-up failed. Please try again.');
        this.submitting = false;
      },
    });
  }

  private allocatedAbilities(): { [ability: string]: number } {
    const out: { [ability: string]: number } = {};
    for (const a of this.abilities) {
      if (this.asiAllocation[a] > 0) out[a] = this.asiAllocation[a];
    }
    return out;
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
