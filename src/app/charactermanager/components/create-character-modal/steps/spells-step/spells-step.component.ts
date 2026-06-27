import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DndSpell } from '../../../../models/dnd-api.types';

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
})
export class SpellsStepComponent {
  @Input() filteredSpellList: DndSpell[] = [];
  @Input() loadingSpells = false;
  @Input() maxCantrips = 0;
  @Input() maxKnownSpells = 0;
  @Input() selectedCantrips = 0;
  @Input() selectedLeveled = 0;
  @Input() spellLevelFilter: number | 'all' = 'all';
  @Input() spellSearch = '';
  @Input() selectedSpells: DndSpell[] = [];
  @Input() expandedSpellName: string | null = null;

  /** Filter tab clicked (two-way [(spellLevelFilter)] on the parent). */
  @Output() spellLevelFilterChange = new EventEmitter<number | 'all'>();
  /** Search box edited (two-way [(spellSearch)] on the parent). */
  @Output() spellSearchChange = new EventEmitter<string>();
  /** A spell row was clicked — parent runs toggleSpellDesc (expand/collapse). */
  @Output() toggleDesc = new EventEmitter<DndSpell>();
  /** Add/remove a spell — parent runs toggleSpell. */
  @Output() toggleSpell = new EventEmitter<DndSpell>();

  isSpellSelected(spell: DndSpell): boolean {
    return this.selectedSpells.some(s => s.name === spell.name);
  }

  isSpellDescOpen(spell: DndSpell): boolean {
    return this.expandedSpellName === spell.name;
  }

  trackBySpellName(_: number, spell: DndSpell): string { return spell.name; }
}
