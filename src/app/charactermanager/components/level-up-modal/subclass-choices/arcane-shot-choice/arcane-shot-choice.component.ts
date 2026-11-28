import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ArcaneShotDraft, ArcaneShotRule, arcaneShotDraftStart, arcaneShotListRule, swapArcaneShot, withArcaneShotPicks,
} from '../../../../models/arcane-shots';
import { ArcaneShotPickerComponent } from '../../../arcane-shot-picker/arcane-shot-picker.component';

let nextId = 0;

/**
 * An Arcane Archer's Arcane Shot options at a level-up, as a section of the
 * subclass choices: the tick list, and at a level that adds an option the
 * select that names one known option to replace.
 *
 * It keeps no state and owns no rule: the host holds the draft and passes the
 * rule in (models/arcane-shots), and this section reports each change.
 */
@Component({
  selector: 'app-arcane-shot-choice',
  templateUrl: './arcane-shot-choice.component.html',
  styleUrls: ['./arcane-shot-choice.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ArcaneShotPickerComponent],
})
export class ArcaneShotChoiceComponent {
  /** What this level-up lets the player choose. */
  readonly rule = input.required<ArcaneShotRule>();
  /** The Fighter level being reached: the options show their damage at it. */
  readonly level = input.required<number>();
  /** The choice so far; null until the player changes something. */
  readonly value = input<ArcaneShotDraft | null>(null);
  readonly valueChange = output<ArcaneShotDraft>();

  readonly selectId = `arcane-shot-replace-${++nextId}`;

  readonly draft = computed(() => this.value() ?? arcaneShotDraftStart(this.rule()));
  /** The tick list's rule: the known options stay as they are; the select moves them. */
  readonly listRule = computed(() => arcaneShotListRule(this.rule(), this.draft()));

  onPicks(selected: string[]): void {
    this.valueChange.emit(withArcaneShotPicks(this.rule(), this.draft(), selected));
  }

  onSwap(name: string): void {
    this.valueChange.emit(swapArcaneShot(this.rule(), this.draft(), name));
  }
}
