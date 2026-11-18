import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { SessionNote } from '../../../models/session-note';
import { CampaignService } from '../../../services/campaign.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmService } from '../../modal/confirm.service';
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
  /** The log request failed — the empty state must not claim there are no notes. */
  readonly loadFailed = signal(false);

  /** The note currently in edit mode (null = none) and its textarea draft. */
  editingId: SessionNote['id'] | null = null;
  editDraft = '';

  private readonly notifications = inject(NotificationService);
  private readonly confirmations = inject(ConfirmService);

  constructor(private campaignService: CampaignService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) this.load();
  }

  load(): void {
    if (!this.campaign) { this.notes.set([]); return; }
    this.campaignService.getNotes(this.campaign.id).subscribe({
      next: notes => { this.notes.set(notes); this.loadFailed.set(false); },
      error: err => {
        this.loadFailed.set(true);
        this.notifications.error('Could not load the session notes. Try again.', err);
      },
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
        this.notifications.error('Could not save the note. Your text is still here — try again.', err);
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
        this.notifications.error('Could not save the edit. Your text is still here — try again.', err);
        this.saving.set(false);
      },
    });
  }

  /** Asks first — the ✕ sits right beside Edit, and a note is the table's memory. */
  remove(note: SessionNote): void {
    this.confirmations.confirm({
      title: 'Delete Note',
      subject: excerpt(note.body),
      message: 'will be erased from the session notes. This cannot be undone.',
      confirmLabel: 'Delete Note',
    }).subscribe(() => this.reallyRemove(note));
  }

  private reallyRemove(note: SessionNote): void {
    this.campaignService.deleteNote(this.campaign.id, note.id).subscribe({
      next: () => this.notes.update(notes => notes.filter(n => n !== note)),
      error: err => this.notifications.error('Could not delete the note. Try again.', err),
    });
  }

  trackById(_index: number, note: SessionNote): number | string {
    return note.id;
  }
}

/** The note's opening words, quoted, so the DM can tell which one they hit. */
function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return `“${flat.length > 60 ? flat.slice(0, 60).trimEnd() + '…' : flat}”`;
}
