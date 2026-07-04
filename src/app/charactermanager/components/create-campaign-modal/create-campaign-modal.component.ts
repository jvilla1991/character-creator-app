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

  // Optional in-world start date — free-text labels for any homebrew calendar
  // ("1492 DR" / "Hammer" / "3rd"). The clock starts at morning of that day.
  // Any part filled counts as "set"; empty parts default to "1".
  startYear = '';
  startMonth = '';
  startDay = '';
  startWeekday = '';

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
    const year = this.startYear.trim();
    const month = this.startMonth.trim();
    const day = this.startDay.trim();
    const weekday = this.startWeekday.trim();
    if (!year && !month && !day && !weekday) return undefined;
    return {
      year: year || '1',
      month: month || '1',
      day: day || '1',
      timeOfDay: 'morning',
      weekday: weekday || null,
      weekdaysSeen: weekday ? [weekday] : [],
      week: 1,
    };
  }
}
