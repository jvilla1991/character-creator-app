import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DndSpecies } from '../../../../models/dnd-api.types';
import {
  CatalogSpecies, SPECIES_ABILITY_NAMES, SpeciesAbility, SpeciesOption, SpeciesSelections, emptySpeciesSelections,
  needsAbilityChoice,
} from '../../../../models/species';
import { DndResourcesService, OriginFeatOption } from '../../../../services/dnd-resources.service';

/**
 * Step 2: pick a species and view its traits (accordion). Presentational — the
 * parent owns selection logic and the detail fetch; this child renders the rows
 * and emits (toggle) with a row's key when it is clicked.
 *
 * A base-game row shows the rules API's detail, with trait descriptions from a
 * read-only lookup in DndResourcesService. A World of Warcraft row carries its
 * own catalog entry (`option.catalog`) and is rendered straight from it,
 * together with the choices that species asks for (lineage, size, an ability,
 * a Human's Origin feat). Each pick is emitted as a patch for the parent to merge.
 */
@Component({
    selector: 'app-species-step',
    templateUrl: './species-step.component.html',
    styleUrls: ['./species-step.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
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
  /** What the player has picked for the chosen catalog species. */
  readonly selections = input<SpeciesSelections>(emptySpeciesSelections());
  /** Origin feats on offer for the species' feat choice; empty when it has none. */
  readonly originFeats = input<readonly OriginFeatOption[]>([]);
  /** Description of the chosen Origin feat. */
  readonly featDescription = input('');
  /** The background's Origin feat when the chosen one repeats it and can't; '' otherwise. */
  readonly blockedFeat = input('');

  /** A species row was clicked — parent runs toggleSpecies (select / collapse) with its key. */
  readonly toggle = output<string>();
  /** A choice was made — parent merges the patch into its selections. */
  readonly selectionsChange = output<Partial<SpeciesSelections>>();

  readonly abilityNames = SPECIES_ABILITY_NAMES;

  constructor(private dndResources: DndResourcesService) {}

  getTraitDescription(traitName: string): string {
    return this.dndResources.getTraitDescription(traitName);
  }

  /** True when the species has anything to choose in this step. */
  hasChoices(species: CatalogSpecies): boolean {
    return !!species.lineages?.length || species.sizes.length > 1
      || !!species.choices?.ability || !!species.choices?.originFeat;
  }

  /** The ability picker shows unless the chosen lineage has no use for it. */
  showAbility(species: CatalogSpecies): boolean {
    return needsAbilityChoice(species, this.selections());
  }

  abilityLabel(species: CatalogSpecies): string {
    return species.choices?.ability?.use === 'save DC' ? 'Saving throw ability' : 'Spellcasting ability';
  }

  abilityName(ability: SpeciesAbility): string {
    return this.abilityNames[ability];
  }
}
