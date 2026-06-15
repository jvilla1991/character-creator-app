import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CampaignDraft } from '../models/campaign';
import { CampaignService } from './campaign.service';
import { UiStateService } from './ui-state.service';

/** Controls the create-campaign modal and wires submits into CampaignService. */
@Injectable({ providedIn: 'root' })
export class CampaignModalService {
  private openSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.openSubject.asObservable();

  constructor(
    private campaignService: CampaignService,
    private uiState: UiStateService,
  ) {}

  openCreateModal(): void  { this.openSubject.next(true); }
  closeCreateModal(): void { this.openSubject.next(false); }

  onCreated(draft: CampaignDraft): void {
    this.closeCreateModal();
    this.campaignService.createCampaign(draft).subscribe({
      next: campaign => this.uiState.setActiveCampaign(campaign.id),
      error: err => console.error('Failed to create campaign', err),
    });
  }
}
