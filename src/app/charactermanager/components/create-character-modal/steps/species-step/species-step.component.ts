import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DndSpecies } from '../../../../models/dnd-api.types';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

/**
 * Step 2: pick a species and view its traits (accordion). Presentational — the
 * parent owns selection logic and the detail fetch; this child renders the list
 * and emits (toggle) when a row is clicked. Trait descriptions are a read-only
 * lookup, so the child resolves them via DndResourcesService directly.
 */
@Component({
    selector: 'app-species-step',
    templateUrl: './species-step.component.html',
    styleUrls: ['./species-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpeciesStepComponent {
  readonly speciesList = input<string[]>([]);
  readonly species = input('');
  readonly loadingSpecies = input(false);
  readonly loadingSpeciesDetail = input(false);
  readonly speciesDetail = input<DndSpecies | null>(null);
  readonly speciesSubspeciesNames = input('');

  /** A species row was clicked — parent runs toggleSpecies (select / collapse). */
  readonly toggle = output<string>();

  constructor(private dndResources: DndResourcesService) {}

  getTraitDescription(traitName: string): string {
    return this.dndResources.getTraitDescription(traitName);
  }

  trackByName(_: number, name: string): string { return name; }
}
