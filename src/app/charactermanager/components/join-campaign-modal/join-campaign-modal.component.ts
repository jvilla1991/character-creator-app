import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { PCService } from '../../services/pc.service';
import { JoinConsentState, JoinRequest } from '../../services/join-modal.service';

/**
 * "Join a Campaign" — a player enters an invite code and picks one of their
 * characters. When the code belongs to a slot-inventory campaign the host
 * passes a consent state and the modal swaps to a conversion consent pane.
 */
@Component({
    selector: 'app-join-campaign-modal',
    templateUrl: './join-campaign-modal.component.html',
    standalone: false
})
export class JoinCampaignModalComponent implements OnChanges {
  pcs$ = this.pcService.pcs$;
  code = '';
  pcId: number | null = null;

  @Input() consent: JoinConsentState | null = null;
  @Input() error: string | null = null;
  /** Preselect this character in the PC picker (e.g. opened from its sheet). */
  @Input() preselectPcId: number | null = null;

  @Output() confirm = new EventEmitter<JoinRequest>();
  @Output() close = new EventEmitter<void>();
  @Output() acceptConsent = new EventEmitter<void>();
  @Output() declineConsent = new EventEmitter<void>();

  constructor(private pcService: PCService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Apply the preselect only while the player hasn't picked anyone yet —
    // never stomp an explicit choice.
    if (changes['preselectPcId'] && this.pcId == null && this.preselectPcId != null) {
      this.pcId = this.preselectPcId;
    }
  }

  get canSubmit(): boolean {
    return this.code.trim().length > 0 && this.pcId != null;
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.confirm.emit({ code: this.code.trim(), pcId: this.pcId as number });
  }

  cancel(): void { this.close.emit(); }
}
