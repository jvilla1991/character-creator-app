import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PC } from '../../../../models/pc';
import { GATHERING_PROFESSIONS, GatheringProfession, ProfessionGrant, ProfessionKey, meetsProfessionRequirement } from '../../../../models/profession';
import { ProfessionService } from '../../../../services/profession.service';

@Component({
  selector: 'app-professions-panel',
  templateUrl: './professions-panel.component.html',
  styleUrls: ['./professions-panel.component.scss'],
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfessionsPanelComponent implements OnChanges, OnDestroy {
  @Input() pc!: PC;
  @Input() canGrant = false;
  readonly catalog = GATHERING_PROFESSIONS;
  readonly grants = signal<ProfessionGrant[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly loaded = signal(false);
  grantFormOpen = false;
  selected: ProfessionKey = 'fishing';
  confirming: ProfessionKey | null = null;
  private pcId?: number;
  private requests = new Subscription();
  constructor(private service: ProfessionService) {}
  ngOnChanges(): void {
    if (!this.canGrant) { this.grantFormOpen = false; this.confirming = null; }
    if (this.pc?.id !== this.pcId) { this.pcId = this.pc?.id; this.load(); }
  }
  ngOnDestroy(): void { this.requests.unsubscribe(); }
  get bonus(): number { return this.pc.prof ?? Math.floor((this.pc.level - 1) / 4) + 2; }
  get assigned(): GatheringProfession[] { return this.catalog.filter(p => this.grants().some(g => g.profession === p.key)); }
  get available(): GatheringProfession[] { return this.catalog.filter(p => !this.grants().some(g => g.profession === p.key)); }
  get chosen(): GatheringProfession { return this.catalog.find(p => p.key === this.selected)!; }
  eligible(profession: GatheringProfession): boolean { return meetsProfessionRequirement(this.pc, profession); }
  load(): void {
    this.requests.unsubscribe(); this.requests = new Subscription();
    this.grants.set([]); this.error.set(null); this.loaded.set(false); this.loading.set(true); this.saving.set(false);
    this.grantFormOpen = false; this.confirming = null;
    this.requests.add(this.service.list(this.pc.id).subscribe({
      next: grants => { this.grants.set(grants); this.loading.set(false); this.loaded.set(true); },
      error: () => { this.loading.set(false); this.error.set('Could not load professions. Please try again.'); }
    }));
  }
  openGrant(): void { this.selected = this.available[0].key; this.grantFormOpen = true; this.error.set(null); }
  grant(): void {
    if (!this.canGrant || !this.loaded() || this.saving() || !this.eligible(this.chosen)
      || !this.available.some(p => p.key === this.selected)) return;
    this.saving.set(true); this.error.set(null);
    this.requests.add(this.service.grant(this.pc.id, this.selected).subscribe({
      next: grant => { this.grants.update(rows => [...rows, grant]); this.saving.set(false); this.grantFormOpen = false; },
      error: () => { this.saving.set(false); this.error.set('Could not grant profession. Check the prerequisite and your DM access, then try again.'); }
    }));
  }
  revoke(profession: ProfessionKey): void {
    if (!this.canGrant || this.saving() || this.confirming !== profession) return;
    this.saving.set(true); this.error.set(null);
    this.requests.add(this.service.revoke(this.pc.id, profession).subscribe({
      next: () => { this.grants.update(rows => rows.filter(g => g.profession !== profession)); this.saving.set(false); this.confirming = null; },
      error: () => { this.saving.set(false); this.error.set('Could not revoke profession. Please try again.'); }
    }));
  }
}
