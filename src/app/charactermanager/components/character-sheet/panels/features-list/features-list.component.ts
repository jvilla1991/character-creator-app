import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { DndResourcesService } from '../../../../services/dnd-resources.service';

type Feature = { name: string; source: string; desc: string; category?: 'class' | 'other' };

@Component({
    selector: 'app-features-list',
    templateUrl: './features-list.component.html',
    styleUrls: ['./features-list.component.scss'],
    standalone: false
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
   * Entries shown in this panel: everything NOT tagged category 'other' (absent =
   * class, so every pre-existing entry stays here). 'other' entries render in the
   * sibling Other Features panel.
   */
  get classFeatures(): Feature[] {
    return (this.pc.features ?? []).filter(f => f.category !== 'other');
  }

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

  /** All known Origin feat names, loaded once — backs the Name field typeahead. */
  allFeatNames: string[] = this.dndResources.getFeatNames();
  featDropdownOpen = false;

  openGrantForm(): void {
    this.grantFormOpen = true;
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  /** Feat names matching the current Name draft; blank query shows the full list. */
  get filteredFeats(): string[] {
    const q = this.nameDraft.trim().toLowerCase();
    if (!q) return this.allFeatNames;
    return this.allFeatNames.filter(n => n.toLowerCase().includes(q));
  }

  onNameFocus(): void {
    this.featDropdownOpen = true;
  }

  onNameInput(): void {
    this.featDropdownOpen = true;
  }

  onNameBlur(): void {
    this.featDropdownOpen = false;
  }

  /** Escape closes the dropdown first; a second Escape (dropdown already closed) cancels the form. */
  onNameEscape(): void {
    if (this.featDropdownOpen) {
      this.featDropdownOpen = false;
      return;
    }
    this.cancelGrant();
  }

  /** Selecting a feat from the dropdown auto-fills Name/Source/Description. */
  selectFeat(name: string): void {
    this.nameDraft = name;
    this.sourceDraft = 'Feat';
    this.descDraft = this.dndResources.getFeatDescription(name);
    this.featDropdownOpen = false;
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
    this.featDropdownOpen = false;
  }
}
