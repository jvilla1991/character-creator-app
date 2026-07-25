import { Component, input, output } from '@angular/core';
import { DndClass } from '../../../../models/dnd-api.types';

/**
 * Step 3: pick a class (accordion) and, for Sorcerer/Warlock, its level-1
 * subclass. Presentational — the parent owns selection logic and the detail
 * fetch and passes the derived saving-throws string and subclass list in.
 */
@Component({
    selector: 'app-class-step',
    templateUrl: './class-step.component.html',
    styleUrls: ['./class-step.component.scss']
})
export class ClassStepComponent {
  readonly classList = input<string[]>([]);
  readonly clazz = input('');
  readonly classDetail = input<DndClass | null>(null);
  readonly loadingClassList = input(false);
  readonly loadingClassDetail = input(false);
  readonly classSavingThrows = input('…');
  readonly requiresLevel1Subclass = input(false);
  readonly availableSubclasses = input<{
    name: string;
    desc: string;
}[]>([]);
  readonly selectedSubclass = input('');

  /** A class row was clicked — parent runs toggleClass (select / collapse). */
  readonly toggle = output<string>();
  /** A subclass card was picked (two-way [(selectedSubclass)] on the parent). */
  readonly selectedSubclassChange = output<string>();
}
