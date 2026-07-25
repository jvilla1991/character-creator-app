import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BackgroundGroup, DndBackground } from '../../../../models/dnd-api.types';

/**
 * Step 4: pick a background (grouped by source book, accordion) and view its
 * ability bonuses, proficiencies, and origin feat. Presentational — the parent
 * owns source filtering, selection, and the detail fetch, and passes the derived
 * display strings in.
 */
@Component({
    selector: 'app-background-step',
    templateUrl: './background-step.component.html',
    styleUrls: ['./background-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackgroundStepComponent {
  readonly backgroundGroups = input<BackgroundGroup[]>([]);
  readonly enabledSources = input<Record<string, boolean>>({});
  readonly activeBackgroundGroups = input<BackgroundGroup[]>([]);
  readonly background = input('');
  readonly backgroundDetail = input<DndBackground | null>(null);
  readonly loadingBackgroundDetail = input(false);
  readonly backgroundAbilityNames = input('…');
  readonly backgroundProficiencyNames = input('');
  readonly backgroundFeatName = input('');
  readonly backgroundFeatDescription = input('');

  /** A source-book checkbox was toggled — parent runs toggleSource. */
  readonly toggleSource = output<string>();
  /** A background row was clicked — parent runs toggleBackground (select / collapse). */
  readonly toggleBackground = output<string>();

  trackBySource(_: number, group: BackgroundGroup): string { return group.source; }
  trackByName(_: number, name: string): string { return name; }
}
