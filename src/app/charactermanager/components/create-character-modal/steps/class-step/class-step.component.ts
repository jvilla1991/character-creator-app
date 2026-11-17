import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DndClass } from '../../../../models/dnd-api.types';
import { ClassOption, Rune, RuneOption } from '../../../../models/hero-class';

/**
 * Step 3: pick a class (accordion) and, for Sorcerer/Warlock, its level-1
 * subclass. Hero classes (e.g. Death Knight (Paladin)) show their blurb, their
 * locked subclass and — for Death Knight — the required rune picker.
 * Presentational — the parent owns selection logic, the source filter and the
 * detail fetch, and passes the already-filtered rows and derived strings in.
 */
@Component({
    selector: 'app-class-step',
    templateUrl: './class-step.component.html',
    styleUrls: ['./class-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassStepComponent {
  /** Class rows after the content-source filter (base classes, then hero classes). */
  readonly classOptions = input<ClassOption[]>([]);
  /** Label of the chosen row ('Death Knight (Paladin)' or a base class name). */
  readonly selectedLabel = input('');
  /** True when the chosen class is hidden by the source filter (it stays chosen). */
  readonly selectedHidden = input(false);
  readonly runeOptions = input<readonly RuneOption[]>([]);
  readonly rune = input<Rune | ''>('');
  /** The chosen BASE class — used in the level-1 subclass note. */
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

  /** A class row was clicked (by label) — parent runs toggleClass (select / collapse). */
  readonly toggle = output<string>();
  /** A subclass card was picked (two-way [(selectedSubclass)] on the parent). */
  readonly selectedSubclassChange = output<string>();
  /** A rune card was picked — parent runs selectRune. */
  readonly runeChange = output<Rune>();
}
