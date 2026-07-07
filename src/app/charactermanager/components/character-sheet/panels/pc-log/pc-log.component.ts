import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { PC } from '../../../../models/pc';
import { PcActivityLogEntry } from '../../../../models/pc-activity-log';
import { PCService } from '../../../../services/pc.service';

/**
 * Per-character activity log — the latest 10 server-recorded events
 * (level-ups, shop purchases/sales, DM XP awards, long rests, DM sheet
 * edits), newest first. Entirely read-only: every row is written by a
 * backend mutation, never by the client, so there is no `canWrite` input
 * (unlike {@link PcNotesComponent} — the server enforces who could have
 * caused each entry, not this panel). Self-serviced via PCService, mirroring
 * the pc-notes panel's data-flow pattern.
 */
@Component({
  selector: 'app-pc-log',
  templateUrl: './pc-log.component.html',
})
export class PcLogComponent implements OnChanges {
  @Input() pc!: PC;

  entries: PcActivityLogEntry[] = [];

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const previous = changes['pc']?.previousValue as PC | undefined;
    if (changes['pc'] && this.pc?.id != null && this.pc.id !== previous?.id) {
      this.load();
    }
  }

  entryDate(entry: PcActivityLogEntry): string {
    const d = new Date(entry.createdAt);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24));

    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (dayDiff === 0) return `Today, ${time}`;
    if (dayDiff === 1) return `Yesterday, ${time}`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private load(): void {
    this.entries = [];
    this.pcService.getLog(this.pc.id).subscribe({
      next: entries => { this.entries = entries; },
      error: () => { /* not readable (stranger) — leave the list empty */ },
    });
  }
}
