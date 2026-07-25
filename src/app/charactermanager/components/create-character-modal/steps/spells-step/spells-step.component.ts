import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
  readonly loadingSpells = input(false);
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

  isSpellSelected(spell: DndSpell): boolean {
    return this.selectedSpells().some(s => s.name === spell.name);
  }

  isSpellDescOpen(spell: DndSpell): boolean {
    return this.expandedSpellName() === spell.name;
  }

  trackBySpellName(_: number, spell: DndSpell): string { return spell.name; }
}
