import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, combineLatest, of, timer } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { PC } from '../../models/pc';
import { SessionState } from '../../models/session';
import { CampaignService } from '../../services/campaign.service';
import { PCService } from '../../services/pc.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';

interface LiveSession {
  session: SessionState;
  campaignId: string;
  campaignName: string;
}

/**
 * Player-facing "a session is live — join" banner. Polls the campaigns the
 * player's characters belong to and, when the DM has a session open, offers a
 * picker to seat one of their member PCs. Hidden entirely in demo mode (no
 * multi-client discovery there) and whenever no session is live.
 */
@Component({
    selector: 'app-session-live-banner',
    templateUrl: './session-live-banner.component.html',
    styleUrls: ['./session-live-banner.component.scss'],
    standalone: false
})
export class SessionLiveBannerComponent implements OnInit, OnDestroy {
  live: LiveSession | null = null;

  pickerOpen = false;
  eligiblePcs: PC[] = [];
  selectedPcId: number | null = null;
  joining = false;
  error: string | null = null;

  private allPcs: PC[] = [];
  private sub?: Subscription;

  constructor(
    private pcService: PCService,
    private campaignService: CampaignService,
    private sessionService: SessionService,
    private uiState: UiStateService,
  ) {}

  ngOnInit(): void {
    // Re-check whenever the roster changes and on a 5s heartbeat (paused while
    // the tab is hidden). Show the first campaign that has a live session.
    this.sub = combineLatest([this.pcService.pcs$, timer(0, 5000)]).pipe(
      filter(() => !document.hidden),
      switchMap(([pcs]) => {
        this.allPcs = pcs;
        const campaignIds = this.distinctCampaignIds(pcs);
        if (!campaignIds.length) return of(null);
        return combineLatest(
          campaignIds.map(id =>
            this.sessionService.getActiveForCampaign(id).pipe(
              map(session => (session ? { id, session } : null)),
              catchError(() => of(null)),
            ),
          ),
        ).pipe(map(results => results.find(r => r != null) ?? null));
      }),
    ).subscribe(found => {
      this.live = found
        ? {
            session: found.session,
            campaignId: found.id,
            campaignName: this.campaignService.getById(found.id)?.name ?? 'your campaign',
          }
        : null;
      // If the live session went away while the picker was open, close it.
      if (!found) this.pickerOpen = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  openPicker(): void {
    if (!this.live) return;
    this.error = null;
    this.eligiblePcs = this.allPcs.filter(
      pc => pc.campaignId != null && String(pc.campaignId) === this.live!.campaignId,
    );
    this.selectedPcId = this.eligiblePcs[0]?.id ?? null;
    this.pickerOpen = true;
  }

  closePicker(): void {
    this.pickerOpen = false;
  }

  join(): void {
    if (!this.live || this.selectedPcId == null) return;
    this.joining = true;
    this.error = null;
    this.sessionService.joinSession(this.live.session.sessionId, this.selectedPcId).subscribe({
      next: state => {
        this.joining = false;
        this.pickerOpen = false;
        this.uiState.openSession(String(state.sessionId));
      },
      error: () => {
        this.joining = false;
        this.error = 'Could not join the session. Try again.';
      },
    });
  }

  private distinctCampaignIds(pcs: PC[]): string[] {
    const ids = pcs
      .map(pc => pc.campaignId)
      .filter((id): id is number | string => id != null)
      .map(id => String(id));
    return Array.from(new Set(ids));
  }
}
