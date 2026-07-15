import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClassEquipment, DndClass, DndSpecies, DndSpell } from '../../../../models/dnd-api.types';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/**
 * Final review step: a read-only summary of every choice, with per-section Edit
 * buttons. Presentational — the parent computes all the review getters and
 * passes them in; the child only renders and emits (edit) with the target step
 * number when an Edit button is clicked. The ability grid reuses the parent's
 * finalScore/modifier as bound function inputs (single-sourced math).
 */
@Component({
    selector: 'app-review-step',
    templateUrl: './review-step.component.html',
    styleUrls: ['./review-step.component.scss'],
    standalone: false
})
export class ReviewStepComponent {
  // Combat banner
  @Input() reviewHp = 0;
  @Input() reviewAc = 0;
  @Input() reviewInitiative = '';

  // Identity / species / class / background
  @Input() name = '';
  @Input() player = '';
  @Input() species = '';
  @Input() speciesDetail: DndSpecies | null = null;
  @Input() reviewSpeciesTraitNames = '';
  @Input() clazz = '';
  @Input() selectedSubclass = '';
  @Input() classDetail: DndClass | null = null;
  @Input() classSavingThrows = '…';
  @Input() background = '';
  @Input() backgroundFeatName = '';
  @Input() bonusPlus2: Ability | '' = '';
  @Input() bonusPlus1: Ability | '' = '';

  // Proficiencies & languages
  @Input() reviewAllSkills: string[] = [];
  @Input() backgroundToolProfs: string[] = [];
  @Input() languageChoice = '';

  // Ability scores
  @Input() abilities: readonly Ability[] = [];
  @Input() finalScore: (a: Ability) => number = () => 0;
  @Input() modifier: (score: number) => string = () => '';

  // Spells (casters only)
  @Input() isSpellcastingClass = false;
  @Input() selectedSpells: DndSpell[] = [];
  @Input() reviewCantripNames = '';
  @Input() reviewLeveledSpellNames = '';

  // Equipment
  @Input() equipmentChoice: 'A' | 'B' | '' = '';
  @Input() equipmentStep = 8;
  @Input() currentClassEquipment: ClassEquipment | null = null;
  @Input() reviewWeaponNames = '';
  @Input() reviewGearNames = '';
  @Input() reviewStartingGp = 0;

  /** An Edit button was clicked — parent runs goToStep with this step number. */
  @Output() edit = new EventEmitter<number>();
}
