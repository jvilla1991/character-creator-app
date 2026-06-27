import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  styleUrls: ['./background-step.component.scss'],
})
export class BackgroundStepComponent {
  @Input() backgroundGroups: BackgroundGroup[] = [];
  @Input() enabledSources: Record<string, boolean> = {};
  @Input() activeBackgroundGroups: BackgroundGroup[] = [];
  @Input() background = '';
  @Input() backgroundDetail: DndBackground | null = null;
  @Input() loadingBackgroundDetail = false;
  @Input() backgroundAbilityNames = '…';
  @Input() backgroundProficiencyNames = '';
  @Input() backgroundFeatName = '';
  @Input() backgroundFeatDescription = '';

  /** A source-book checkbox was toggled — parent runs toggleSource. */
  @Output() toggleSource = new EventEmitter<string>();
  /** A background row was clicked — parent runs toggleBackground (select / collapse). */
  @Output() toggleBackground = new EventEmitter<string>();

  trackBySource(_: number, group: BackgroundGroup): string { return group.source; }
  trackByName(_: number, name: string): string { return name; }
}
