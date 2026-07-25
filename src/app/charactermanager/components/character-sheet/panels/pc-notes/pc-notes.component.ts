import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { PC } from '../../../../models/pc';
import { PcNote } from '../../../../models/pc-note';
import { PCService } from '../../../../services/pc.service';
import { FormsModule } from '@angular/forms';

/**
 * Per-character session notes — the player's own log ("what my character
 * remembers"). The owning player writes; the DM cross-link sees the list
 * read-only (`canWrite` false — the server enforces owner-only writes too).
 * Self-serviced via PCService, the initiative-panel precedent for panels
 * that own their data flow.
 */
@Component({
    selector: 'app-pc-notes',
    templateUrl: './pc-notes.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class PcNotesComponent implements OnChanges {
  @Input() pc!: PC;
  @Input() canWrite = false;
  /** Set when the sheet is embedded in a live session — tags new notes with it. */
  @Input() sessionId: number | string | null = null;

  // Signals: both are written from HTTP callbacks, which don't mark an OnPush
  // view dirty on their own. `draft` stays a plain field — only template events write it.
  readonly notes = signal<PcNote[]>([]);
  draft = '';
  readonly saving = signal(false);

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes['pc']?.previousValue as PC | undefined;
    if (changes['pc'] && this.pc?.id != null && this.pc.id !== previous?.id) {
      this.load();
    }
  }

  addNote(): void {
    const body = this.draft.trim();
    if (!body || this.saving()) return;
    this.saving.set(true);
    this.pcService.addNote(this.pc.id, body, this.sessionId).subscribe({
      next: note => {
        this.notes.update(notes => [note, ...notes]);
        this.draft = '';
        this.saving.set(false);
      },
      error: err => {
        console.error('Failed to add character note', err);
        this.saving.set(false);
      },
    });
  }

  noteDate(note: PcNote): string {
    const d = new Date(note.createdAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private load(): void {
    this.notes.set([]);
    this.pcService.getNotes(this.pc.id).subscribe({
      next: notes => { this.notes.set(notes); },
      error: () => { /* not readable (stranger) — leave the list empty */ },
    });
  }
}
