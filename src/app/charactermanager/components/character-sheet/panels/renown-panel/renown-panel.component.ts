import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PC } from '../../../../models/pc';
import { RENOWN_MILESTONES, RenownFaction, renownProgress, renownStanding } from '../../../../models/renown';
import { RenownService } from '../../../../services/renown.service';

@Component({
  selector: 'app-renown-panel',
  imports: [FormsModule],
  templateUrl: './renown-panel.component.html',
  styleUrls: ['./renown-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenownPanelComponent implements OnChanges, OnDestroy {
  @Input() pc!: PC;
  @Input() canManage = false;
  readonly factions = signal<RenownFaction[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly milestones = RENOWN_MILESTONES;
  readonly standing = renownStanding;
  readonly progress = renownProgress;
  collapsed = new Set<number>();
  formOpen = false;
  name = '';
  parentId: number | null = null;
  private context = '';
  private requests = new Subscription();
  constructor(private service: RenownService) {}
  get campaignId(): string { return String(this.pc.campaignId); }
  get roots(): RenownFaction[] { return this.factions().filter(f => f.parentId == null); }
  get visibleRows(): RenownFaction[] {
    return this.roots.flatMap(root => [root, ...(this.collapsed.has(root.id) ? [] : this.children(root.id))]);
  }
  children(id: number): RenownFaction[] { return this.factions().filter(f => f.parentId === id); }
  ngOnChanges(): void {
    const context = `${this.pc.id}:${this.pc.campaignId}`;
    if (context === this.context) return;
    this.context = context;
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.factions.set([]);
    this.saving.set(false);
    this.collapsed.clear();
    this.formOpen = false;
    this.name = '';
    this.parentId = null;
    this.load();
  }
  ngOnDestroy(): void { this.requests.unsubscribe(); }
  load(): void {
    this.error.set('');
    this.loading.set(false);
    if (this.pc.campaignId == null) return;
    this.loading.set(true);
    this.requests.add(this.service.list(this.pc.id, this.campaignId).subscribe({
      next: rows => { this.factions.set(rows); this.loading.set(false); },
      error: () => { this.error.set('Could not load renown. Please retry.'); this.loading.set(false); },
    }));
  }
  toggle(id: number): void {
    if (this.collapsed.has(id)) this.collapsed.delete(id); else this.collapsed.add(id);
  }
  add(): void {
    if (!this.canManage || this.saving() || !this.name.trim() || this.name.trim().length > 100) return;
    this.saving.set(true);
    this.error.set('');
    this.requests.add(this.service.create(this.pc.id, this.campaignId, this.name.trim(), this.parentId).subscribe({
      next: row => {
        this.factions.update(rows => [...rows, row]);
        if (row.parentId != null) this.collapsed.delete(row.parentId);
        this.name = ''; this.formOpen = false; this.saving.set(false);
      },
      error: () => { this.error.set('Could not add faction. Please try again.'); this.saving.set(false); },
    }));
  }
  adjust(row: RenownFaction, delta: number): void {
    if (!this.canManage || this.saving() || row.score + delta < -100 || row.score + delta > 100) return;
    this.saving.set(true);
    this.error.set('');
    this.requests.add(this.service.adjust(this.pc.id, this.campaignId, row.id, delta).subscribe({
      next: updated => { this.factions.update(rows => rows.map(f => f.id === updated.id ? updated : f)); this.saving.set(false); },
      error: () => { this.error.set('Could not adjust renown. Please retry.'); this.saving.set(false); },
    }));
  }
}
