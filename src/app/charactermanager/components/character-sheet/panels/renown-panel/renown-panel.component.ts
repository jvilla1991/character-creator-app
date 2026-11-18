import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PC } from '../../../../models/pc';
import { RENOWN_MILESTONES, RENOWN_THRESHOLDS, RenownFaction, renownFillsFromRight, renownProgress, renownSpan, renownStanding } from '../../../../models/renown';
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
  readonly thresholds = RENOWN_THRESHOLDS;
  /** Best standing first, as the milestones table reads top to bottom. */
  readonly standingsTable = [...RENOWN_MILESTONES].reverse();
  readonly standing = renownStanding;
  readonly progress = renownProgress;
  readonly fillsFromRight = renownFillsFromRight;
  readonly span = renownSpan;
  /** Unsaved score changes, by faction id — the DM clicks +/− freely and one
   *  Save sends them all, so the activity log gets one entry, not one per click. */
  readonly pending = signal<Record<number, number>>({});
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
    this.pending.set({});
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
      error: () => { this.error.set('Could not load renown. Try again.'); this.loading.set(false); },
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
      error: () => { this.error.set('Could not add the faction. Try again.'); this.saving.set(false); },
    }));
  }
  /** The score to show: the saved one plus any unsaved change. */
  scoreOf(row: RenownFaction): number { return row.score + (this.pending()[row.id] ?? 0); }
  /** The unsaved change on this row (0 when untouched). */
  changeOf(row: RenownFaction): number { return this.pending()[row.id] ?? 0; }
  get dirty(): boolean { return Object.keys(this.pending()).length > 0; }
  /** Local only — nothing is sent until {@link save}. */
  adjust(row: RenownFaction, delta: number): void {
    const next = this.scoreOf(row) + delta;
    if (!this.canManage || this.saving() || next < -100 || next > 100) return;
    this.pending.update(changes => {
      const { [row.id]: current = 0, ...rest } = changes;
      const change = current + delta;
      // Stepping back to the saved score leaves nothing to save for this row.
      return change === 0 ? rest : { ...rest, [row.id]: change };
    });
  }
  discard(): void { if (!this.saving()) this.pending.set({}); }
  save(): void {
    if (!this.canManage || this.saving() || !this.dirty) return;
    const changes = Object.entries(this.pending()).map(([id, delta]) => ({ factionId: Number(id), delta }));
    this.saving.set(true);
    this.error.set('');
    this.requests.add(this.service.saveAll(this.pc.id, this.campaignId, changes).subscribe({
      next: rows => { this.factions.set(rows); this.pending.set({}); this.saving.set(false); },
      error: () => { this.error.set('Could not save renown. Your changes are still here — try again.'); this.saving.set(false); },
    }));
  }
}
