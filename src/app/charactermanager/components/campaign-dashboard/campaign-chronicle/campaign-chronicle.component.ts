import { Component, Input } from '@angular/core';
import { Campaign } from '../../../models/campaign';

/** Campaign Chronicle: prose recap (drop cap), open threads, DM-only secrets. */
@Component({
  selector: 'app-campaign-chronicle',
  templateUrl: './campaign-chronicle.component.html',
})
export class CampaignChronicleComponent {
  @Input() campaign!: Campaign;

  get dropCap(): string { return this.campaign.chronicle.charAt(0); }
  get rest(): string { return this.campaign.chronicle.slice(1); }
}
