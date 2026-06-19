import { Component, Input } from '@angular/core';
import { PC } from '../../../../models/pc';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

type Feature = { name: string; source: string; desc: string };

@Component({
  selector: 'app-features-list',
  templateUrl: './features-list.component.html',
  styleUrls: ['./features-list.component.scss']
})
export class FeaturesListComponent {
  @Input() pc!: PC;

  constructor(private dndResources: DndResourcesService) {}

  /**
   * Description to show for a feature. Feats taken on level-up are stored with a blank desc
   * (the backend doesn't own feat descriptions — they live in the frontend), so for those we
   * fall back to the local feat-description lookup. Class features carry their own desc.
   */
  descFor(feature: Feature): string {
    if (feature.desc) return feature.desc;
    if (feature.source?.toLowerCase().startsWith('feat')) {
      return this.dndResources.getFeatDescription(feature.name);
    }
    return '';
  }
}
