import { ChangeDetectionStrategy, Component, Input, OnChanges, signal } from '@angular/core';
import { SessionState } from '../../../models/session';
import { EncounterSummary } from '../../../models/encounter';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { FormsModule } from '@angular/forms';

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
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class EncounterLoaderComponent implements OnChanges {
  @Input() state!: SessionState;

  // Signals: written from list/load HTTP callbacks, which never mark an OnPush view.
  readonly encounters = signal<EncounterSummary[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly busy = signal(false);

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
        next: encounters => this.encounters.set(encounters),
        error: () => this.encounters.set([]),
      });
    }
  }

  get selectedNotes(): string | null {
    const e = this.encounters().find(x => x.id === this.selectedId());
    return e?.notes ?? null;
  }

  load(): void {
    const selectedId = this.selectedId();
    if (selectedId == null || this.busy()) return;
    const encounter = this.encounters().find(x => x.id === selectedId);
    this.busy.set(true);
    this.sessionService.loadEncounter(this.state.sessionId, selectedId).subscribe({
      next: () => {
        this.busy.set(false);
        this.notifications.notify(`Loaded ${encounter?.name ?? 'encounter'} into the session.`);
        this.selectedId.set(null);
      },
      error: err => {
        this.busy.set(false);
        this.notifications.notify(err?.error?.message || 'Could not load the encounter.');
      },
    });
  }

  trackById(_index: number, e: EncounterSummary): number {
    return e.id;
  }
}
