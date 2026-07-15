import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { Campaign } from '../../models/campaign';
import { PC } from '../../models/pc';
import { CampaignService } from '../../services/campaign.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';

interface CampaignRow {
  campaign: Campaign;
  heroes: number;
  range: string;     // "Lv 7" | "Lv 5–7" | "no heroes"
}

/** DM-mode sidebar: a "Your Campaigns" list (mirrors PlayerRoster). */
@Component({
    selector: 'app-campaign-sidebar',
    templateUrl: './campaign-sidebar.component.html',
    standalone: false
})
export class CampaignSidebarComponent implements OnInit, OnDestroy {
  activeCampaignId$ = this.uiState.activeCampaignId$;

  // Refetch valve: fired on window refocus so a player joining while the DM
  // was in another tab shows up without a manual reload. No background polling.
  private refresh$ = new BehaviorSubject<void>(undefined);

  /**
   * One row per campaign with a real member count. Counts come from the
   * DM-scoped member projection (getMembers) — the local PC store only holds
   * the signed-in user's OWN characters, so filtering it undercounts every
   * campaign whose members belong to other players (the "0 heroes" bug).
   * pcs$ stays in the trigger set so demo-mode joins refresh instantly.
   */
  rows$: Observable<CampaignRow[]> = combineLatest([
    this.campaignService.campaigns$,
    this.pcService.pcs$,
    this.refresh$,
  ]).pipe(
    switchMap(([campaigns]) =>
      campaigns.length === 0
        ? of([] as CampaignRow[])
        : forkJoin(
            campaigns.map(c =>
              this.campaignService.getMembers(c.id).pipe(
                take(1),
                catchError(() => of([] as PC[])),
              )),
          ).pipe(map(lists => campaigns.map((campaign, i) => this.toRow(campaign, lists[i]))))
    )
  );

  count$ = this.campaignService.campaigns$.pipe(map(c => c.length));

  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') this.refresh$.next();
  };

  constructor(
    private campaignService: CampaignService,
    private pcService: PCService,
    private uiState: UiStateService,
  ) {}

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  select(id: string): void {
    this.uiState.setActiveCampaign(id);
  }

  padCount(n: number): string {
    return n.toString().padStart(2, '0');
  }

  private toRow(campaign: Campaign, members: PC[]): CampaignRow {
    const levels = members.map(m => m.level);
    const range = levels.length
      ? (Math.min(...levels) === Math.max(...levels)
          ? `Lv ${levels[0]}`
          : `Lv ${Math.min(...levels)}–${Math.max(...levels)}`)
      : 'no heroes';
    return { campaign, heroes: members.length, range };
  }
}
