import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { SessionNote } from '../../../models/session-note';
import { CampaignService } from '../../../services/campaign.service';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

/**
 * Session Notes panel on the DM dashboard — the out-of-session surface for the
 * campaign-scoped note log. Reloads whenever the selected campaign changes; the
 * in-session composer (Session Mode) writes to the same backend log.
 */
@Component({
    selector: 'app-campaign-notes',
    templateUrl: './campaign-notes.component.html',
    styleUrls: ['./campaign-notes.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DatePipe]
})
export class CampaignNotesComponent implements OnChanges {
  @Input() campaign!: Campaign;

  // Signals: written from HTTP callbacks, which never mark an OnPush view.
  readonly notes = signal<SessionNote[]>([]);
  draft = '';
  readonly saving = signal(false);

  /** The note currently in edit mode (null = none) and its textarea draft. */
  editingId: SessionNote['id'] | null = null;
  editDraft = '';

  constructor(private campaignService: CampaignService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) this.load();
  }

  private load(): void {
    if (!this.campaign) { this.notes.set([]); return; }
    this.campaignService.getNotes(this.campaign.id).subscribe({
      next: notes => this.notes.set(notes),
      error: err => console.error('Failed to load session notes', err),
    });
  }

  add(): void {
    const body = this.draft.trim();
    if (!body || this.saving()) return;
    this.saving.set(true);
    this.campaignService.addNote(this.campaign.id, body).subscribe({
      next: note => {
        this.notes.update(notes => [note, ...notes]);
        this.draft = '';
        this.saving.set(false);
      },
      error: err => {
        console.error('Failed to add session note', err);
        this.saving.set(false);
      },
    });
  }

  /** Open the inline editor for a note (one at a time; mirrors the compose box). */
  startEdit(note: SessionNote): void {
    this.editingId = note.id;
    this.editDraft = note.body;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = '';
  }

  /** Save the edited body; the returned note (with updatedAt) replaces the row. */
  saveEdit(note: SessionNote): void {
    const body = this.editDraft.trim();
    if (!body || this.saving()) return;
    this.saving.set(true);
    this.campaignService.updateNote(this.campaign.id, note.id, body).subscribe({
      next: updated => {
        this.notes.update(notes => notes.map(n => (n.id === note.id ? updated : n)));
        this.cancelEdit();
        this.saving.set(false);
      },
      error: err => {
        console.error('Failed to update session note', err);
        this.saving.set(false);
      },
    });
  }

  remove(note: SessionNote): void {
    this.campaignService.deleteNote(this.campaign.id, note.id).subscribe({
      next: () => this.notes.update(notes => notes.filter(n => n !== note)),
      error: err => console.error('Failed to delete session note', err),
    });
  }

  trackById(_index: number, note: SessionNote): number | string {
    return note.id;
  }
}
