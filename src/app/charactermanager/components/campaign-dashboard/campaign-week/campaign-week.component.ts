import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { CampaignService } from '../../../services/campaign.service';

/**
 * Campaign Week panel on the DM dashboard — shows the campaign's defined week
 * (the ordered weekday names the clock walks each new day) and lets the DM edit
 * or clear it after creation via the week-days editor. Without a definition the
 * clock keeps its free-text weekday whose repetition counts weeks.
 */
@Component({
    selector: 'app-campaign-week',
    templateUrl: './campaign-week.component.html',
    standalone: false
})
export class CampaignWeekComponent implements OnChanges {
  @Input() campaign!: Campaign;

  editing = false;
  draft: string[] | null = null;
  saving = false;

  constructor(private campaignService: CampaignService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) this.editing = false;
  }

  /** "Sul · Mol · …" or the free-text fallback description. */
  get summary(): string {
    return this.campaign?.weekDays?.length
      ? this.campaign.weekDays.join(' · ')
      : 'Free-text weekdays — repetition counts weeks';
  }

  edit(): void {
    this.draft = this.campaign.weekDays?.length ? [...this.campaign.weekDays] : null;
    this.editing = true;
  }

  cancel(): void {
    this.editing = false;
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.campaignService.setWeekDays(this.campaign.id, this.draft).subscribe({
      next: () => {
        this.saving = false;
        this.editing = false;
      },
      error: err => {
        console.error('Failed to save the week definition', err);
        this.saving = false; // keep the editor open so the DM can retry
      },
    });
  }
}
