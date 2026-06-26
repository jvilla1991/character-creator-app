import { Component } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Campaign } from '../../models/campaign';
import { PC } from '../../models/pc';
import { CampaignService } from '../../services/campaign.service';
import { PCService } from '../../services/pc.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { SessionState } from '../../models/session';
import { passiveScore, tintFor } from '../../utils/character-math';

interface DashboardVm {
  campaign: Campaign;
  members: PC[];
  avgLevel: string;
  topPassivePerception: number | string;
  activeConditions: number;
  liveSession: SessionState | null;
}

/**
 * DM dashboard shell: header + aggregate vitals strip + party board + the
 * two-column chronicle/treasury row. Shows an empty state until a campaign is
 * selected in the campaign sidebar.
 *
 * Members come from CampaignService.getMembers — in real mode this is the
 * DM-scoped projection, so the board includes other players' bound characters.
 */
@Component({
  selector: 'app-campaign-dashboard',
  templateUrl: './campaign-dashboard.component.html',
})
export class CampaignDashboardComponent {
  // Bump to re-pull the member projection (after a bind/unbind).
  private membersRefresh$ = new BehaviorSubject<void>(undefined);

  vm$: Observable<DashboardVm | null> = combineLatest([
    this.uiState.activeCampaignId$,
    this.campaignService.campaigns$,
    this.membersRefresh$,
  ]).pipe(
    switchMap(([activeId, campaigns]) => {
      const campaign = campaigns.find(c => c.id === activeId) ?? null;
      if (!campaign) return of(null);
      return combineLatest([
        this.campaignService.getMembers(campaign.id),
        this.sessionService.getActiveForCampaign(campaign.id),
      ]).pipe(
        map(([members, liveSession]) => this.buildVm(campaign, members, liveSession)),
      );
    })
  );

  /** All of the current user's characters — the bind pool for Manage Party. */
  allPcs$ = this.pcService.pcs$;
  managePartyOpen = false;

  constructor(
    private campaignService: CampaignService,
    private pcService: PCService,
    private sessionService: SessionService,
    private uiState: UiStateService,
  ) {}

  /**
   * Open a live Session Mode lobby for this campaign and switch the main view to
   * the initiative tracker. The session is server-authoritative; we just store
   * its id so the sidenav overlay takes over. (Initiative is then entered inside
   * the session via the DM controls.)
   */
  startSession(campaign: Campaign): void {
    this.sessionService.createSession(campaign.id).subscribe({
      next: state => this.uiState.openSession(String(state.sessionId)),
      error: err => {
        // Lost a race with an existing live session — just resume it.
        if (err?.status === 409) { this.resumeSession(campaign); return; }
        console.error('Failed to start session', err);
      },
    });
  }

  /** Re-enter the campaign's existing live session. */
  resumeSession(campaign: Campaign): void {
    this.sessionService.getActiveForCampaign(campaign.id).subscribe(session => {
      if (session) this.uiState.openSession(String(session.sessionId));
    });
  }

  private buildVm(campaign: Campaign, members: PC[], liveSession: SessionState | null): DashboardVm {
    const avgLevel = members.length
      ? (members.reduce((s, m) => s + m.level, 0) / members.length).toFixed(1)
      : '—';
    const topPassivePerception = members.length
      ? Math.max(...members.map(m => passiveScore(m, 'Perception', 'WIS')))
      : '—';
    const activeConditions = members.reduce((s, m) => s + (m.conditions?.length ?? 0), 0);
    return { campaign, members, avgLevel, topPassivePerception, activeConditions, liveSession };
  }

  /**
   * Cross-link: open the clicked hero's full sheet in Player mode, where the DM
   * can edit it inline. For the DM's own characters the full PC is already in the
   * local store. For other players' members we only hold the privacy-limited
   * projection, so we fetch the complete sheet via the DM-authorized path before
   * opening (the dashboard only ever lists members the DM is allowed to edit).
   */
  openHero(pc: PC): void {
    const owned = this.pcService.getPCById(pc.id);
    if (owned) {
      this.pcService.setActivePC(owned);
      this.uiState.viewHeroAsDm();
      return;
    }
    this.pcService.getPCByIdAsDm(pc.id).subscribe({
      next: full => {
        this.pcService.setActivePC(full?.id ? full : pc);
        this.uiState.viewHeroAsDm();
      },
      error: err => {
        // Fall back to the projection (read-only edits will 403) so the sheet still opens.
        console.error('Failed to load full character for DM edit', err);
        this.pcService.setActivePC(pc);
        this.uiState.viewHeroAsDm();
      },
    });
  }

  // --- Manage Party (bind/unbind characters) -------------------------------

  openManageParty(): void { this.managePartyOpen = true; }
  closeManageParty(): void { this.managePartyOpen = false; this.membersRefresh$.next(); }

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
      next: () => this.membersRefresh$.next(),
      error: err => console.error('Failed to update campaign binding', err),
    });
  }
}
