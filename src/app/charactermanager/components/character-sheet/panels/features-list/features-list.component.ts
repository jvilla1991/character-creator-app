import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  /** True when the viewer is a DM cross-linked into this sheet — reveals the Grant control. */
  @Input() addAllowed = false;
  /**
   * A DM-granted feature. Emitted as a bare payload rather than a merged PC because a grant
   * must go through GrantService's refetch-merge-save (the sheet's `pc` copy can be stale —
   * PUTting it directly risks clobbering a concurrent player edit). CharacterSheetComponent
   * owns the actual save.
   */
  @Output() featureGranted = new EventEmitter<Feature>();

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

  // ── DM grant form ────────────────────────────────────────────────────────

  grantFormOpen = false;
  nameDraft = '';
  sourceDraft = 'DM Grant';
  descDraft = '';

  openGrantForm(): void {
    this.grantFormOpen = true;
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  submitGrant(): void {
    const name = this.nameDraft.trim();
    if (!name) return;
    const source = this.sourceDraft.trim() || 'DM Grant';
    const desc = this.descDraft.trim();
    this.featureGranted.emit({ name, source, desc });
    this.resetGrantForm();
  }

  private resetGrantForm(): void {
    this.grantFormOpen = false;
    this.nameDraft = '';
    this.sourceDraft = 'DM Grant';
    this.descDraft = '';
  }
}
