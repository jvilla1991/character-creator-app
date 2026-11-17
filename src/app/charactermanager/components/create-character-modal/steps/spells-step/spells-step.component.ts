import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DndSpell } from '../../../../models/dnd-api.types';
import { FormsModule } from '@angular/forms';

/**
 * Step 7 (spellcasting classes only): pick cantrips/1st-level spells with a
 * filterable, expandable list. Presentational — the parent owns the spell list,
 * the selection, the filter state, and which row is expanded. The child renders
 * the passed `filteredSpellList`, reimplements the trivial selected/open
 * predicates over the inputs, and reports filter changes and toggles via events.
 */
@Component({
    selector: 'app-spells-step',
    templateUrl: './spells-step.component.html',
    styleUrls: ['./spells-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class SpellsStepComponent {
  readonly filteredSpellList = input<DndSpell[]>([]);
  readonly spellGroups = computed(() => {
    const spells = this.filteredSpellList();
    return [...new Set(spells.map(s => s.level))].sort((a, b) => a - b)
      .map(level => ({ level, spells: spells.filter(s => s.level === level) }));
  });
  readonly loadingSpells = input(false);
  /** True when the wizard's content-source filter has every source off. */
  readonly noSourcesEnabled = input(false);
  readonly maxCantrips = input(0);
  readonly maxKnownSpells = input(0);
  readonly selectedCantrips = input(0);
  readonly selectedLeveled = input(0);
  readonly spellLevelFilter = input<number | 'all'>('all');
  readonly spellSearch = input('');
  readonly selectedSpells = input<DndSpell[]>([]);
  readonly expandedSpellName = input<string | null>(null);

  /** Filter tab clicked (two-way [(spellLevelFilter)] on the parent). */
  readonly spellLevelFilterChange = output<number | 'all'>();
  /** Search box edited (two-way [(spellSearch)] on the parent). */
  readonly spellSearchChange = output<string>();
  /** A spell row was clicked — parent runs toggleSpellDesc (expand/collapse). */
  readonly toggleDesc = output<DndSpell>();
  /** Add/remove a spell — parent runs toggleSpell. */
  readonly toggleSpell = output<DndSpell>();

  /**
   * True once every pick in this group has been spent — all cantrips chosen
   * for level 0, all known spells for a leveled group. The template uses it to
   * collapse the finished group so the player's eye lands on what is left.
   * A group with no allowance at all (max 0) never counts as "complete", or it
   * would start collapsed with nothing to show for it.
   */
  isGroupComplete(level: number): boolean {
    const picked = level === 0 ? this.selectedCantrips() : this.selectedLeveled();
    const max = level === 0 ? this.maxCantrips() : this.maxKnownSpells();
    return max > 0 && picked >= max;
  }

  isSpellSelected(spell: DndSpell): boolean {
    return this.selectedSpells().some(s => s.name === spell.name);
  }

  isSpellDescOpen(spell: DndSpell): boolean {
    return this.expandedSpellName() === spell.name;
  }

  trackBySpellName(_: number, spell: DndSpell): string { return spell.name; }
}
