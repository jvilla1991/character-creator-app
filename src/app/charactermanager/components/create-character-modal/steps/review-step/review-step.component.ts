import { Component, input, output } from '@angular/core';
import { ClassEquipment, DndClass, DndSpecies, DndSpell } from '../../../../models/dnd-api.types';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/**
 * Final review step: a read-only summary of every choice, with per-section Edit
 * buttons. Presentational — the parent computes all the review getters and
 * passes them in; the child only renders and emits (edit) with the target step
 * number when an Edit button is clicked. The ability grid reuses the parent's
 * finalScore as a bound function input (single-sourced math); modifiers render
 * via the shared `modifier` pipe.
 */
@Component({
    selector: 'app-review-step',
    templateUrl: './review-step.component.html',
    styleUrls: ['./review-step.component.scss'],
    imports: [ModifierPipe]
})
export class ReviewStepComponent {
  // Combat banner
  readonly reviewHp = input(0);
  readonly reviewAc = input(0);
  readonly reviewInitiative = input('');

  // Identity / species / class / background
  readonly name = input('');
  readonly player = input('');
  readonly species = input('');
  readonly speciesDetail = input<DndSpecies | null>(null);
  readonly reviewSpeciesTraitNames = input('');
  readonly clazz = input('');
  readonly selectedSubclass = input('');
  readonly classDetail = input<DndClass | null>(null);
  readonly classSavingThrows = input('…');
  readonly background = input('');
  readonly backgroundFeatName = input('');
  readonly bonusPlus2 = input<Ability | ''>('');
  readonly bonusPlus1 = input<Ability | ''>('');

  // Proficiencies & languages
  readonly reviewAllSkills = input<string[]>([]);
  readonly backgroundToolProfs = input<string[]>([]);
  readonly languageChoice = input('');
  readonly languageChoice2 = input('');

  /** 'Common' plus the chosen languages, for the languages review row. */
  get languagesDisplay(): string {
    return ['Common', this.languageChoice(), this.languageChoice2()].filter(l => !!l).join(', ');
  }

  // Ability scores
  readonly abilities = input<readonly Ability[]>([]);
  readonly finalScore = input<(a: Ability) => number>(() => 0);

  // Spells (casters only)
  readonly isSpellcastingClass = input(false);
  readonly selectedSpells = input<DndSpell[]>([]);
  readonly reviewCantripNames = input('');
  readonly reviewLeveledSpellNames = input('');

  // Equipment
  readonly equipmentChoice = input<'A' | 'B' | ''>('');
  readonly equipmentStep = input(8);
  readonly currentClassEquipment = input<ClassEquipment | null>(null);
  readonly reviewWeaponNames = input('');
  readonly reviewGearNames = input('');
  readonly reviewStartingGp = input(0);

  /** An Edit button was clicked — parent runs goToStep with this step number. */
  readonly edit = output<number>();
}
