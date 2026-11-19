import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ClassEquipment, DndClass, DndSpecies, DndSpell } from '../../../../models/dnd-api.types';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';
import { modFromScore } from '../../../../utils/character-math';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/**
 * Final review step: a read-only summary of every choice, with per-section Edit
 * buttons. Presentational — the parent computes all the review getters and
 * passes them in; the child only renders and emits (edit) with the target step
 * number when an Edit button is clicked. The ability grid reuses the parent's
 * finalScore as a bound function input (single-sourced math); modifiers render as
 * `modFromScore(score) | modifier` — the pipe only signs an existing modifier.
 */
@Component({
    selector: 'app-review-step',
    templateUrl: './review-step.component.html',
    styleUrls: ['./review-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
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
  /** A catalog species' choices on one line ('Night Elf · Wisdom'); '' shows nothing. */
  readonly speciesChoices = input('');
  /** Class as shown to the player — the hero-class label for e.g. Death Knight (Paladin). */
  readonly clazz = input('');
  readonly selectedSubclass = input('');
  /** Hero-class specialization; '' for everyone else. */
  readonly specialization = input('');
  /** What the hero class calls it ('rune', 'specialization'); '' for everyone else. */
  readonly specializationLabel = input('');

  /** "Rune" / "Specialization" — the review row label. */
  get specializationHeading(): string {
    const l = this.specializationLabel() || 'specialization';
    return l.charAt(0).toUpperCase() + l.slice(1);
  }
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
  /** The character's starting languages as the wizard will save them; null falls back to Common + the two picks. */
  readonly languages = input<string[] | null>(null);

  get languagesDisplay(): string {
    const languages = this.languages() ?? ['Common', this.languageChoice(), this.languageChoice2()];
    return languages.filter(l => !!l).join(', ') || '—';
  }

  // Ability scores
  readonly abilities = input<readonly Ability[]>([]);
  readonly finalScore = input<(a: Ability) => number>(() => 0);
  /** Score → modifier (17 → 3). The `modifier` pipe then only adds the sign. */
  protected readonly modFromScore = modFromScore;

  // Spells (casters only)
  readonly isSpellcastingClass = input(false);
  readonly selectedSpells = input<DndSpell[]>([]);
  readonly reviewCantripNames = input('');
  readonly reviewLeveledSpellNames = input('');
  /** "Hunter's Mark (Favored Enemy)" — spells the class always keeps prepared; '' for none. */
  readonly alwaysPreparedNames = input('');

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
