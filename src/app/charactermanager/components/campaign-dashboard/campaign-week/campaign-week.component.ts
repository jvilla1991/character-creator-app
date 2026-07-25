import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { CampaignService } from '../../../services/campaign.service';
import { WeekDaysEditorComponent } from '../../week-days-editor/week-days-editor.component';

/**
 * Campaign Week panel on the DM dashboard — shows the campaign's defined week
 * (the ordered weekday names the clock walks each new day) and lets the DM edit
 * or clear it after creation via the week-days editor. Without a definition the
 * clock keeps its free-text weekday whose repetition counts weeks.
 */
@Component({
    selector: 'app-campaign-week',
    templateUrl: './campaign-week.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [WeekDaysEditorComponent]
})
export class CampaignWeekComponent implements OnChanges {
  @Input() campaign!: Campaign;

  // Signals: cleared from HTTP callbacks, which never mark an OnPush view.
  readonly editing = signal(false);
  draft: string[] | null = null;
  readonly saving = signal(false);

  constructor(private campaignService: CampaignService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) this.editing.set(false);
  }

  /** "Sul · Mol · …" or the free-text fallback description. */
  get summary(): string {
    return this.campaign?.weekDays?.length
      ? this.campaign.weekDays.join(' · ')
      : 'Free-text weekdays — repetition counts weeks';
  }

  edit(): void {
    this.draft = this.campaign.weekDays?.length ? [...this.campaign.weekDays] : null;
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.campaignService.setWeekDays(this.campaign.id, this.draft).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
      },
      error: err => {
        console.error('Failed to save the week definition', err);
        this.saving.set(false); // keep the editor open so the DM can retry
      },
    });
  }
}
