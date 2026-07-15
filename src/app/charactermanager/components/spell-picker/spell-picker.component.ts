import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DndSpell } from '../../models/dnd-api.types';

/**
 * Reusable spell search-and-select list — extracted from the level-up modal so
 * DM spell grants (spellbook panel) can reuse the exact same filter/limit/toggle
 * behavior instead of re-implementing it. This component is a thin presenter: the
 * caller supplies the already-loaded candidate list and owns the selection state;
 * this component only owns the search box and the limit-enforcing toggle.
 *
 * <p>Limit semantics match the level-up modal's original `filteredSpells` /
 * `toggleSpell`: a limit of `0` hides that kind entirely, `null` means unlimited
 * (never blocks), and any positive number caps how many of that kind may be
 * selected at once.
 */
@Component({
    selector: 'app-spell-picker',
    templateUrl: './spell-picker.component.html',
    styleUrls: ['./spell-picker.component.scss'],
    standalone: false
})
export class SpellPickerComponent {
  @Input() spells: DndSpell[] = [];
  @Input() selected: DndSpell[] = [];
  @Input() cantripLimit: number | null = null;
  @Input() spellLimit: number | null = null;
  @Input() loading = false;
  @Output() selectedChange = new EventEmitter<DndSpell[]>();

  search = '';

  /** Candidates filtered by search and limited to the kinds the caller allows. */
  get filteredSpells(): DndSpell[] {
    const q = this.search.trim().toLowerCase();
    return this.spells.filter(s => {
      if (s.level === 0 && this.cantripLimit === 0) return false;
      if (s.level > 0 && this.spellLimit === 0) return false;
      return !q || s.name.toLowerCase().includes(q);
    });
  }

  get selectedCantripCount(): number {
    return this.selected.filter(s => s.level === 0).length;
  }

  get selectedSpellCount(): number {
    return this.selected.filter(s => s.level > 0).length;
  }

  isSelected(spell: DndSpell): boolean {
    return this.selected.some(s => s.name === spell.name);
  }

  /** Toggle selection, enforcing the per-kind limit (null = unlimited, never blocks). */
  toggle(spell: DndSpell): void {
    if (this.isSelected(spell)) {
      this.selectedChange.emit(this.selected.filter(s => s.name !== spell.name));
      return;
    }
    if (spell.level === 0 && this.cantripLimit !== null && this.selectedCantripCount >= this.cantripLimit) return;
    if (spell.level > 0 && this.spellLimit !== null && this.selectedSpellCount >= this.spellLimit) return;
    this.selectedChange.emit([...this.selected, spell]);
  }
}
