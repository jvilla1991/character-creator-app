import { Component } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Campaign } from '../../models/campaign';
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
})
export class CampaignSidebarComponent {
  activeCampaignId$ = this.uiState.activeCampaignId$;

  rows$: Observable<CampaignRow[]> = combineLatest([
    this.campaignService.campaigns$,
    this.pcService.pcs$,
  ]).pipe(
    map(([campaigns, pcs]) =>
      campaigns.map(campaign => {
        const members = this.campaignService.membersOf(campaign, pcs);
        const levels = members.map(m => m.level);
        const range = levels.length
          ? (Math.min(...levels) === Math.max(...levels)
              ? `Lv ${levels[0]}`
              : `Lv ${Math.min(...levels)}–${Math.max(...levels)}`)
          : 'no heroes';
        return { campaign, heroes: members.length, range };
      })
    )
  );

  count$ = this.campaignService.campaigns$.pipe(map(c => c.length));

  constructor(
    private campaignService: CampaignService,
    private pcService: PCService,
    private uiState: UiStateService,
  ) {}

  select(id: string): void {
    this.uiState.setActiveCampaign(id);
  }

  padCount(n: number): string {
    return n.toString().padStart(2, '0');
  }
}
