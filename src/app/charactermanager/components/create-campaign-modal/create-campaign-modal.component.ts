import { Component, EventEmitter, Output } from '@angular/core';
import { CampaignDraft, CampaignTint } from '../../models/campaign';

/** "Open a New Campaign" modal — mirrors the create-character modal chrome. */
@Component({
  selector: 'app-create-campaign-modal',
  templateUrl: './create-campaign-modal.component.html',
})
export class CreateCampaignModalComponent {
  name = '';
  setting = '';
  tint: CampaignTint = 'celestial';

  readonly tints: CampaignTint[] = ['celestial', 'violet', 'gold', 'crimson', 'emerald'];

  @Output() confirm = new EventEmitter<CampaignDraft>();
  @Output() close = new EventEmitter<void>();

  submit(): void {
    if (!this.name.trim()) return;
    this.confirm.emit({
      name: this.name.trim(),
      setting: this.setting.trim(),
      tint: this.tint,
    });
  }

  cancel(): void { this.close.emit(); }
}
