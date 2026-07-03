import { Component, EventEmitter, Output } from '@angular/core';
import { CampaignDraft, CampaignGameTime, CampaignTint } from '../../models/campaign';

/** "Open a New Campaign" modal — mirrors the create-character modal chrome. */
@Component({
  selector: 'app-create-campaign-modal',
  templateUrl: './create-campaign-modal.component.html',
})
export class CreateCampaignModalComponent {
  name = '';
  setting = '';
  tint: CampaignTint = 'celestial';
  slotInventory = false;
  survivalConditions = false;

  // Optional in-world start date; the clock starts at dawn of that day. All
  // three parts or none — a partial date is treated as unset.
  startYear: number | null = null;
  startMonth: number | null = null;
  startDay: number | null = null;

  readonly tints: CampaignTint[] = ['celestial', 'violet', 'gold', 'crimson', 'emerald'];

  @Output() confirm = new EventEmitter<CampaignDraft>();
  @Output() close = new EventEmitter<void>();

  submit(): void {
    if (!this.name.trim()) return;
    this.confirm.emit({
      name: this.name.trim(),
      setting: this.setting.trim(),
      tint: this.tint,
      variantRules: {
        slotInventory: this.slotInventory,
        survivalConditions: this.survivalConditions,
      },
      gameTime: this.draftGameTime(),
    });
  }

  cancel(): void { this.close.emit(); }

  private draftGameTime(): CampaignGameTime | undefined {
    if (this.startYear == null || this.startMonth == null || this.startDay == null) {
      return undefined;
    }
    return {
      year: Math.max(0, Math.floor(this.startYear)),
      month: Math.min(12, Math.max(1, Math.floor(this.startMonth))),
      day: Math.min(30, Math.max(1, Math.floor(this.startDay))),
      timeOfDay: 'dawn',
    };
  }
}
