import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';

export interface JoinRequest { code: string; pcId: number; }

/** Controls the player-facing "Join a Campaign" modal and runs the join. */
@Injectable({ providedIn: 'root' })
export class JoinModalService {
  private openSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.openSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  constructor(private campaignService: CampaignService, private pcService: PCService) {}

  open(): void { this.errorSubject.next(null); this.openSubject.next(true); }
  close(): void { this.openSubject.next(false); }

  onJoin(req: JoinRequest): void {
    this.errorSubject.next(null);
    this.campaignService.join(req.code, req.pcId).subscribe({
      next: () => { this.pcService.refreshPCs(); this.close(); },
      error: () => this.errorSubject.next('No campaign found for that invite code.'),
    });
  }
}
