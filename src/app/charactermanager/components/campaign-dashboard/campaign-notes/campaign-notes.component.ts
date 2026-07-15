import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { SessionNote } from '../../../models/session-note';
import { CampaignService } from '../../../services/campaign.service';

/**
 * Session Notes panel on the DM dashboard — the out-of-session surface for the
 * campaign-scoped note log. Reloads whenever the selected campaign changes; the
 * in-session composer (Session Mode) writes to the same backend log.
 */
@Component({
    selector: 'app-campaign-notes',
    templateUrl: './campaign-notes.component.html',
    styleUrls: ['./campaign-notes.component.scss'],
    standalone: false
})
export class CampaignNotesComponent implements OnChanges {
  @Input() campaign!: Campaign;

  notes: SessionNote[] = [];
  draft = '';
  saving = false;

  constructor(private campaignService: CampaignService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) this.load();
  }

  private load(): void {
    if (!this.campaign) { this.notes = []; return; }
    this.campaignService.getNotes(this.campaign.id).subscribe({
      next: notes => (this.notes = notes),
      error: err => console.error('Failed to load session notes', err),
    });
  }

  add(): void {
    const body = this.draft.trim();
    if (!body || this.saving) return;
    this.saving = true;
    this.campaignService.addNote(this.campaign.id, body).subscribe({
      next: note => {
        this.notes = [note, ...this.notes];
        this.draft = '';
        this.saving = false;
      },
      error: err => {
        console.error('Failed to add session note', err);
        this.saving = false;
      },
    });
  }

  remove(note: SessionNote): void {
    this.campaignService.deleteNote(this.campaign.id, note.id).subscribe({
      next: () => (this.notes = this.notes.filter(n => n !== note)),
      error: err => console.error('Failed to delete session note', err),
    });
  }

  trackById(_index: number, note: SessionNote): number | string {
    return note.id;
  }
}
