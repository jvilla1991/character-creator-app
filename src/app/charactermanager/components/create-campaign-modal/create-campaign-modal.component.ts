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
  strictComponents = false;

  // Optional defined week — an ordered list of weekday names (preset or
  // custom). Null keeps free-text weekdays; editable later on the dashboard.
  weekDays: string[] | null = null;

  // Optional in-world start date — free-text labels for any homebrew calendar
  // ("1492 DR" / "Hammer" / "3rd"). The clock starts at morning of that day.
  // Any part filled counts as "set"; empty parts default to "1". With a
  // defined week the weekday becomes a select constrained to the defined days.
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
        strictComponents: this.strictComponents,
      },
      gameTime: this.draftGameTime(),
      weekDays: this.weekDays,
    });
  }

  cancel(): void { this.close.emit(); }

  /** A new definition may orphan a weekday typed before it — clear the stale pick. */
  onWeekDaysChange(days: string[] | null): void {
    this.weekDays = days;
    if (days?.length && !days.some(d => d.toLowerCase() === this.startWeekday.trim().toLowerCase())) {
      this.startWeekday = '';
    }
  }

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
