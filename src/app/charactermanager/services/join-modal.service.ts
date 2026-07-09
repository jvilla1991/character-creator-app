import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CampaignService } from './campaign.service';
import { PCService } from './pc.service';

export interface JoinRequest { code: string; pcId: number; }

/** The pending join awaiting the slot-inventory conversion consent. */
export interface JoinConsentState { req: JoinRequest; campaignName: string; }

/** Controls the player-facing "Join a Campaign" modal and runs the join. */
@Injectable({ providedIn: 'root' })
export class JoinModalService {
  private openSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.openSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  // Set when the entered code belongs to a slot-inventory campaign: the modal
  // swaps to the consent pane until the player accepts or goes back.
  private consentSubject = new BehaviorSubject<JoinConsentState | null>(null);
  consent$ = this.consentSubject.asObservable();

  // The character to preselect in the modal's PC picker (e.g. opened from
  // that character's own sheet). Cleared on close.
  private preselectPcIdSubject = new BehaviorSubject<number | null>(null);
  preselectPcId$ = this.preselectPcIdSubject.asObservable();

  constructor(private campaignService: CampaignService, private pcService: PCService) {}

  open(preselectPcId?: number): void {
    this.errorSubject.next(null);
    this.consentSubject.next(null);
    this.preselectPcIdSubject.next(preselectPcId ?? null);
    this.openSubject.next(true);
  }

  close(): void {
    this.openSubject.next(false);
    this.consentSubject.next(null);
    this.preselectPcIdSubject.next(null);
  }

  onJoin(req: JoinRequest): void {
    this.errorSubject.next(null);
    this.campaignService.previewByCode(req.code).subscribe({
      next: preview => {
        if (preview.variantRules?.slotInventory) {
          // Consent gate: the join proceeds only from acceptConsent().
          this.consentSubject.next({ req, campaignName: preview.name });
        } else {
          this.doJoin(req, false);
        }
      },
      error: () => this.errorSubject.next('No campaign found for that invite code.'),
    });
  }

  /** Player accepted the inventory conversion — run the acknowledged join. */
  acceptConsent(): void {
    const pending = this.consentSubject.getValue();
    if (!pending) return;
    this.consentSubject.next(null);
    this.doJoin(pending.req, true);
  }

  /** Player declined — the join is cancelled; back to the form, code retained. */
  declineConsent(): void {
    this.consentSubject.next(null);
  }

  private doJoin(req: JoinRequest, acknowledgeVariantRules: boolean): void {
    this.campaignService.join(req.code, req.pcId, acknowledgeVariantRules).subscribe({
      next: () => { this.pcService.refreshPCs(); this.close(); },
      error: err =>
        this.errorSubject.next(
          err?.status === 409
            ? 'This campaign requires accepting the inventory conversion.'
            : 'No campaign found for that invite code.'
        ),
    });
  }
}
