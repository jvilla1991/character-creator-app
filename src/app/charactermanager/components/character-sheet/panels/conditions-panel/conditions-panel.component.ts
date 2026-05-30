import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { CONDITIONS_LIST } from '../../../../utils/character-math';

@Component({
  selector: 'app-conditions-panel',
  templateUrl: './conditions-panel.component.html',
  styleUrls: ['./conditions-panel.component.scss']
})
export class ConditionsPanelComponent {
  @Input() pc!: PC;
  @Output() conditionToggled = new EventEmitter<string>();

  readonly conditions = CONDITIONS_LIST;

  isActive(condition: string): boolean {
    return this.pc.conditions?.includes(condition) ?? false;
  }
}
