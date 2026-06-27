import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DndClass } from '../../../../models/dnd-api.types';

/**
 * Step 3: pick a class (accordion) and, for Sorcerer/Warlock, its level-1
 * subclass. Presentational — the parent owns selection logic and the detail
 * fetch and passes the derived saving-throws string and subclass list in.
 */
@Component({
  selector: 'app-class-step',
  templateUrl: './class-step.component.html',
  styleUrls: ['./class-step.component.scss'],
})
export class ClassStepComponent {
  @Input() classList: string[] = [];
  @Input() clazz = '';
  @Input() classDetail: DndClass | null = null;
  @Input() loadingClassList = false;
  @Input() loadingClassDetail = false;
  @Input() classSavingThrows = '…';
  @Input() requiresLevel1Subclass = false;
  @Input() availableSubclasses: { name: string; desc: string }[] = [];
  @Input() selectedSubclass = '';

  /** A class row was clicked — parent runs toggleClass (select / collapse). */
  @Output() toggle = new EventEmitter<string>();
  /** A subclass card was picked (two-way [(selectedSubclass)] on the parent). */
  @Output() selectedSubclassChange = new EventEmitter<string>();
}
