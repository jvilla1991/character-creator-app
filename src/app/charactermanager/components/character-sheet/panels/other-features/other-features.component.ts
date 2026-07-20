import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';

type Feature = { name: string; source: string; desc: string; category?: 'class' | 'other' };

/**
 * "Other Features" panel — the non-class half of the character's features array:
 * species traits, boons, magic-item properties, story rewards. Entries live in
 * the same `pc.features` JSON column as class features, tagged category 'other'
 * (the tag is stamped by the host's grant handler, not here). Visually mirrors
 * FeaturesListComponent, minus the feat typeahead — feats belong to Class
 * Features, so the grant form here is a plain name/source/description form.
 */
@Component({
    selector: 'app-other-features',
    templateUrl: './other-features.component.html',
    styleUrls: ['./other-features.component.scss'],
    standalone: false
})
export class OtherFeaturesComponent {
  @Input() pc!: PC;
  /** True when the viewer is a DM cross-linked into this sheet — reveals the Grant control. */
  @Input() addAllowed = false;
  /**
   * A DM-granted non-class feature. Emitted as a bare payload rather than a
   * merged PC because a grant must go through GrantService's refetch-merge-save
   * (the sheet's `pc` copy can be stale — PUTting it directly risks clobbering a
   * concurrent player edit). CharacterSheetComponent owns the actual save and
   * stamps category 'other' onto the entry.
   */
  @Output() featureGranted = new EventEmitter<{ name: string; source: string; desc: string }>();

  /** Entries shown here: only those tagged 'other' (everything else is a class feature). */
  get otherFeatures(): Feature[] {
    return (this.pc.features ?? []).filter(f => f.category === 'other');
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
