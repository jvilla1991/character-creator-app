import { Component, Input, OnChanges } from '@angular/core';
import { SessionState } from '../../../models/session';
import { EncounterSummary } from '../../../models/encounter';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';

/**
 * DM-only in-session control: pick one of the campaign's curated encounters and
 * load its creatures into the initiative tracker as enemy combatants. Mirrors the
 * curated-shop side of the shop panel — the campaign's encounters are fetched once
 * per campaign, and loading appends enemies (the DM then rolls their initiative).
 */
@Component({
  selector: 'app-encounter-loader',
  templateUrl: './encounter-loader.component.html',
  styleUrls: ['./encounter-loader.component.scss'],
})
export class EncounterLoaderComponent implements OnChanges {
  @Input() state!: SessionState;

  encounters: EncounterSummary[] = [];
  selectedId: number | null = null;
  busy = false;

  private loadedFor: string | null = null;

  constructor(
    private curatedEncounters: CuratedEncounterService,
    private sessionService: SessionService,
    private notifications: NotificationService,
  ) {}

  ngOnChanges(): void {
    const s = this.state;
    if (!s || !s.dm) return;
    // The poll re-emits state every 2s; only refetch when the campaign changes.
    if (`${s.campaignId}` !== this.loadedFor) {
      this.loadedFor = `${s.campaignId}`;
      this.curatedEncounters.list(s.campaignId).subscribe({
        next: encounters => (this.encounters = encounters),
        error: () => (this.encounters = []),
      });
    }
  }

  get selectedNotes(): string | null {
    const e = this.encounters.find(x => x.id === this.selectedId);
    return e?.notes ?? null;
  }

  load(): void {
    if (this.selectedId == null || this.busy) return;
    const encounter = this.encounters.find(x => x.id === this.selectedId);
    this.busy = true;
    this.sessionService.loadEncounter(this.state.sessionId, this.selectedId).subscribe({
      next: () => {
        this.busy = false;
        this.notifications.notify(`Loaded ${encounter?.name ?? 'encounter'} into the session.`);
        this.selectedId = null;
      },
      error: err => {
        this.busy = false;
        this.notifications.notify(err?.error?.message || 'Could not load the encounter.');
      },
    });
  }

  trackById(_index: number, e: EncounterSummary): number {
    return e.id;
  }
}
