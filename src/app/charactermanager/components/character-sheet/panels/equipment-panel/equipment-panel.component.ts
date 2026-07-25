import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PC } from '../../../../models/pc';

@Component({
    selector: 'app-equipment-panel',
    templateUrl: './equipment-panel.component.html',
    styleUrls: ['./equipment-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EquipmentPanelComponent {
  readonly pc = input.required<PC>();
}
