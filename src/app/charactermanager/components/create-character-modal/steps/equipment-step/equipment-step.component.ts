import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ClassEquipment } from '../../../../models/dnd-api.types';

/**
 * Step 7/8: choose a starting-equipment kit (Option A) or gold (Option B).
 * Presentational — the parent owns the equipment data fetch and the choice;
 * the child renders the two cards and emits the selection.
 */
@Component({
    selector: 'app-equipment-step',
    templateUrl: './equipment-step.component.html',
    styleUrls: ['./equipment-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentStepComponent {
  readonly loadingEquipment = input(false);
  readonly currentClassEquipment = input<ClassEquipment | null>(null);
  readonly equipmentChoice = input<'A' | 'B' | ''>('');
  readonly background = input('');
  readonly backgroundStartingGold = input(0);

  /** Kit/gold choice (two-way [(equipmentChoice)] on the parent). */
  readonly equipmentChoiceChange = output<'A' | 'B' | ''>();
}
