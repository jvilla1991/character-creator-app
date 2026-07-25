import { Component, input, output } from '@angular/core';
import { DndBackground } from '../../../../models/dnd-api.types';
import { FormsModule } from '@angular/forms';

/**
 * Step 5: choose class skills + an additional language; show background-granted
 * skills/tools (read-only). Presentational — the parent owns selection logic and
 * passes the skill arrays in. The chosen/locked predicates are trivial membership
 * checks over those arrays, reimplemented here for display.
 */
@Component({
    selector: 'app-proficiencies-step',
    templateUrl: './proficiencies-step.component.html',
    styleUrls: ['./proficiencies-step.component.scss'],
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
  readonly languageChoice = input('');
  readonly languageChoice2 = input('');
  readonly standardLanguages = input<string[]>([]);

  /** A skill chip was clicked — parent runs toggleSkillProf. */
  readonly toggleSkill = output<string>();
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
    return this.selectedSkills().includes(skill) || this.backgroundSkillProfs().includes(skill);
  }

  isSkillLocked(skill: string): boolean {
    return this.backgroundSkillProfs().includes(skill);
  }

  trackByName(_: number, name: string): string { return name; }
}
