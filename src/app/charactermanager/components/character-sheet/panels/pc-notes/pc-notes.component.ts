import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PC } from '../../../../models/pc';
import { PcNote } from '../../../../models/pc-note';
import { PCService } from '../../../../services/pc.service';

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
    standalone: false
})
export class PcNotesComponent implements OnChanges {
  @Input() pc!: PC;
  @Input() canWrite = false;
  /** Set when the sheet is embedded in a live session — tags new notes with it. */
  @Input() sessionId: number | string | null = null;

  notes: PcNote[] = [];
  draft = '';
  saving = false;

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes['pc']?.previousValue as PC | undefined;
    if (changes['pc'] && this.pc?.id != null && this.pc.id !== previous?.id) {
      this.load();
    }
  }

  addNote(): void {
    const body = this.draft.trim();
    if (!body || this.saving) return;
    this.saving = true;
    this.pcService.addNote(this.pc.id, body, this.sessionId).subscribe({
      next: note => {
        this.notes = [note, ...this.notes];
        this.draft = '';
        this.saving = false;
      },
      error: err => {
        console.error('Failed to add character note', err);
        this.saving = false;
      },
    });
  }

  noteDate(note: PcNote): string {
    const d = new Date(note.createdAt);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private load(): void {
    this.notes = [];
    this.pcService.getNotes(this.pc.id).subscribe({
      next: notes => { this.notes = notes; },
      error: () => { /* not readable (stranger) — leave the list empty */ },
    });
  }
}
