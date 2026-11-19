import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DndSpecies } from '../../../../models/dnd-api.types';
import { SpeciesOption } from '../../../../models/species';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

/**
 * Step 2: pick a species and view its traits (accordion). Presentational — the
 * parent owns selection logic and the detail fetch; this child renders the rows
 * and emits (toggle) with a row's key when it is clicked.
 *
 * A base-game row shows the rules API's detail, with trait descriptions from a
 * read-only lookup in DndResourcesService. A World of Warcraft row carries its
 * own catalog entry (`option.catalog`) and is rendered straight from it.
 */
@Component({
    selector: 'app-species-step',
    templateUrl: './species-step.component.html',
    styleUrls: ['./species-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpeciesStepComponent {
  /** Species rows after the content-source filter (base game, then World of Warcraft). */
  readonly options = input<SpeciesOption[]>([]);
  /** Key of the chosen row; '' when nothing is chosen. */
  readonly selectedKey = input('');
  /** True when the chosen species is hidden by the content-source filter. */
  readonly selectedHidden = input(false);
  readonly loadingSpecies = input(false);
  readonly loadingSpeciesDetail = input(false);
  readonly speciesDetail = input<DndSpecies | null>(null);
  readonly speciesSubspeciesNames = input('');

  /** A species row was clicked — parent runs toggleSpecies (select / collapse) with its key. */
  readonly toggle = output<string>();

  constructor(private dndResources: DndResourcesService) {}

  getTraitDescription(traitName: string): string {
    return this.dndResources.getTraitDescription(traitName);
  }
}
