import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DndBackground } from '../../../../models/dnd-api.types';

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
    standalone: false
})
export class ProficienciesStepComponent {
  @Input() clazz = '';
  @Input() classSkillConfig: { choose: number; from: string[] } = { choose: 0, from: [] };
  @Input() selectedSkills: string[] = [];
  @Input() classSkillsFull = false;
  @Input() backgroundDetail: DndBackground | null = null;
  @Input() background = '';
  @Input() backgroundSkillProfs: string[] = [];
  @Input() backgroundToolProfs: string[] = [];
  @Input() languageChoice = '';
  @Input() languageChoice2 = '';
  @Input() standardLanguages: string[] = [];

  /** A skill chip was clicked — parent runs toggleSkillProf. */
  @Output() toggleSkill = new EventEmitter<string>();
  /** Additional-language selections (two-way [(languageChoice)]/[(languageChoice2)] on the parent). */
  @Output() languageChoiceChange = new EventEmitter<string>();
  @Output() languageChoice2Change = new EventEmitter<string>();

  /** Options for each dropdown exclude the other dropdown's pick (no duplicate languages). */
  get firstLanguageOptions(): string[] {
    return this.standardLanguages.filter(l => l !== this.languageChoice2);
  }

  get secondLanguageOptions(): string[] {
    return this.standardLanguages.filter(l => l !== this.languageChoice);
  }

  isSkillChosen(skill: string): boolean {
    return this.selectedSkills.includes(skill) || this.backgroundSkillProfs.includes(skill);
  }

  isSkillLocked(skill: string): boolean {
    return this.backgroundSkillProfs.includes(skill);
  }

  trackByName(_: number, name: string): string { return name; }
}
