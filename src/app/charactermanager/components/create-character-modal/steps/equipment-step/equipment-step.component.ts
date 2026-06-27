import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClassEquipment } from '../../../../models/dnd-api.types';

/**
 * Step 7/8: choose a starting-equipment kit (Option A) or gold (Option B).
 * Presentational — the parent owns the equipment data fetch and the choice;
 * the child renders the two cards and emits the selection.
 */
@Component({
  selector: 'app-equipment-step',
  templateUrl: './equipment-step.component.html',
  styleUrls: ['./equipment-step.component.scss'],
})
export class EquipmentStepComponent {
  @Input() loadingEquipment = false;
  @Input() currentClassEquipment: ClassEquipment | null = null;
  @Input() equipmentChoice: 'A' | 'B' | '' = '';
  @Input() background = '';
  @Input() backgroundStartingGold = 0;

  /** Kit/gold choice (two-way [(equipmentChoice)] on the parent). */
  @Output() equipmentChoiceChange = new EventEmitter<'A' | 'B' | ''>();
}
