import { Component } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Campaign } from '../../models/campaign';
import { PC } from '../../models/pc';
import { CampaignService } from '../../services/campaign.service';
import { PCService } from '../../services/pc.service';
import { UiStateService } from '../../services/ui-state.service';
import { passiveScore, tintFor } from '../../utils/character-math';

interface DashboardVm {
  campaign: Campaign;
  members: PC[];
  avgLevel: string;
  topPassivePerception: number | string;
  activeConditions: number;
}

/**
 * DM dashboard shell: header + aggregate vitals strip + party board + the
 * two-column chronicle/treasury row. Shows an empty state until a campaign is
 * selected in the campaign sidebar.
 */
@Component({
  selector: 'app-campaign-dashboard',
  templateUrl: './campaign-dashboard.component.html',
})
export class CampaignDashboardComponent {
  vm$: Observable<DashboardVm | null> = combineLatest([
    this.uiState.activeCampaignId$,
    this.campaignService.campaigns$,
    this.pcService.pcs$,
  ]).pipe(
    map(([activeId, campaigns, pcs]) => {
      const campaign = campaigns.find(c => c.id === activeId) ?? null;
      if (!campaign) return null;
      const members = this.campaignService.membersOf(campaign, pcs);
      const avgLevel = members.length
        ? (members.reduce((s, m) => s + m.level, 0) / members.length).toFixed(1)
        : '—';
      const topPassivePerception = members.length
        ? Math.max(...members.map(m => passiveScore(m, 'Perception', 'WIS')))
        : '—';
      const activeConditions = members.reduce((s, m) => s + (m.conditions?.length ?? 0), 0);
      return { campaign, members, avgLevel, topPassivePerception, activeConditions };
    })
  );

  /** All of the current user's characters — the bind pool for Manage Party. */
  allPcs$ = this.pcService.pcs$;
  managePartyOpen = false;

  constructor(
    private campaignService: CampaignService,
    private pcService: PCService,
    private uiState: UiStateService,
  ) {}

  /** Cross-link: open the clicked hero's full sheet in Player mode. */
  openHero(pc: PC): void {
    this.pcService.setActivePC(pc);
    this.uiState.setRole('player');
  }

  // --- Manage Party (bind/unbind characters) -------------------------------

  openManageParty(): void { this.managePartyOpen = true; }
  closeManageParty(): void { this.managePartyOpen = false; }

  boundTint(pc: PC): string { return tintFor(pc); }

  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  /** True if the PC is explicitly bound to this campaign. */
  isBound(pc: PC, campaign: Campaign): boolean {
    return pc.campaignId != null && String(pc.campaignId) === campaign.id;
  }

  /** Bind (or unbind) a character to the campaign and persist via PCService. */
  toggleMembership(pc: PC, campaign: Campaign): void {
    const campaignId = this.isBound(pc, campaign) ? null : campaign.id;
    this.pcService.updatePC({ ...pc, campaignId }).subscribe({
      error: err => console.error('Failed to update campaign binding', err),
    });
  }
}
