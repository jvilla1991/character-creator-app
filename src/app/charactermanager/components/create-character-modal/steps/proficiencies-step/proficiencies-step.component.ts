import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DndBackground } from '../../../../models/dnd-api.types';
import { FormsModule } from '@angular/forms';

/**
 * Step 5: choose class skills + an additional language; show background-granted
 * skills/tools (read-only), and a World of Warcraft species' skills, skill picks
 * and tool picks. Presentational — the parent owns selection logic and passes
 * the skill arrays in. The chosen/locked predicates are trivial membership
 * checks over those arrays, reimplemented here for display.
 */
@Component({
    selector: 'app-proficiencies-step',
    templateUrl: './proficiencies-step.component.html',
    styleUrls: ['./proficiencies-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class ProficienciesStepComponent {
  readonly clazz = input('');
  readonly classSkillConfig = input<{
    choose: number;
    from: string[];
}>({ choose: 0, from: [] });
  readonly selectedSkills = input<string[]>([]);
  readonly classSkillsFull = input(false);
  readonly backgroundDetail = input<DndBackground | null>(null);
  readonly background = input('');
  readonly backgroundSkillProfs = input<string[]>([]);
  readonly backgroundToolProfs = input<string[]>([]);
  /** Skills held from the background or the species — a class pick can't be spent on them. */
  readonly lockedSkills = input<string[] | null>(null);
  /** Species name, for the section heading. */
  readonly species = input('');
  /** Skills the species gives with no choice. */
  readonly speciesGrantedSkills = input<string[]>([]);
  /** The species' skill choice (how many, from which); null when it has none. */
  readonly speciesSkillChoice = input<{ count: number; from: readonly string[] } | null>(null);
  readonly speciesSkillPicks = input<string[]>([]);
  /** How many tools the species lets the player pick, and which are on offer. */
  readonly speciesToolCount = input(0);
  readonly speciesToolOptions = input<readonly string[]>([]);
  /** The tool picked in each slot ('' = empty). */
  readonly speciesTools = input<string[]>([]);
  readonly languageChoice = input('');
  readonly languageChoice2 = input('');
  readonly standardLanguages = input<string[]>([]);

  /** A skill chip was clicked — parent runs toggleSkillProf. */
  readonly toggleSkill = output<string>();
  /** A species skill chip was clicked — parent runs toggleSpeciesSkill. */
  readonly toggleSpeciesSkill = output<string>();
  /** A species tool slot changed — parent runs setSpeciesTool. */
  readonly speciesToolChange = output<{ index: number; tool: string }>();
  /** Additional-language selections (two-way [(languageChoice)]/[(languageChoice2)] on the parent). */
  readonly languageChoiceChange = output<string>();
  readonly languageChoice2Change = output<string>();

  /** Options for each dropdown exclude the other dropdown's pick (no duplicate languages). */
  get firstLanguageOptions(): string[] {
    return this.standardLanguages().filter(l => l !== this.languageChoice2());
  }

  get secondLanguageOptions(): string[] {
    return this.standardLanguages().filter(l => l !== this.languageChoice());
  }

  isSkillChosen(skill: string): boolean {
    return this.selectedSkills().includes(skill) || this.isSkillLocked(skill);
  }

  isSkillLocked(skill: string): boolean {
    return (this.lockedSkills() ?? this.backgroundSkillProfs()).includes(skill);
  }

  /** True when the species section has anything to show. */
  get hasSpeciesProficiencies(): boolean {
    return this.speciesGrantedSkills().length > 0 || !!this.speciesSkillChoice() || this.speciesToolCount() > 0;
  }

  get speciesSkillsFull(): boolean {
    return this.speciesSkillPicks().length >= (this.speciesSkillChoice()?.count ?? 0);
  }

  /** A species skill option the character already has from somewhere else. */
  isSpeciesSkillHeld(skill: string): boolean {
    return this.backgroundSkillProfs().includes(skill) || this.speciesGrantedSkills().includes(skill)
      || this.selectedSkills().includes(skill);
  }

  /** One entry per tool slot, so the template can loop over them. */
  get speciesToolSlots(): number[] {
    return Array.from({ length: this.speciesToolCount() }, (_, i) => i);
  }

  /** Options for a tool slot exclude the tools picked in the other slots. */
  toolOptionsFor(index: number): string[] {
    const others = this.speciesTools().filter((t, i) => i !== index && !!t);
    return this.speciesToolOptions().filter(t => !others.includes(t));
  }

  trackByName(_: number, name: string): string { return name; }
}
