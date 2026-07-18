import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { CuratedLoot, CuratedLootItem, CuratedLootSummary } from '../../../models/curated-loot';
import { parseLootImportPayload, toLootImportPayload } from '../../../models/loot';
import { formatCp } from '../../../models/shop';
import { AuthoredItem } from '../../item-composer/authored-item';
import { CuratedLootService } from '../../../services/curated-loot.service';

/**
 * DM-curated loot panel on the campaign dashboard — the standalone home for
 * prepped spoils (item lines plus a coin pile), decoupled from encounters and
 * mirroring the curated-shops/encounters panels. Lines are authored through
 * the shared ItemComposerComponent (the same form the DM grant flow uses), so
 * custom items carry the full attribute set; the JSON import/export speaks the
 * extended loot contract. A list is dropped into a live session's claim pool
 * from Session Mode (copy semantics — dropping never mutates the list).
 */
@Component({
    selector: 'app-curated-loot',
    templateUrl: './curated-loot.component.html',
    styleUrls: ['./curated-loot.component.scss'],
    standalone: false
})
export class CuratedLootComponent implements OnChanges {
  @Input() campaign!: Campaign;

  lists: CuratedLootSummary[] = [];
  selected: CuratedLoot | null = null;
  newName = '';
  notesDraft = '';
  busy = false;

  /** The coin pile input, in gp (persisted as copper). */
  coinGpDraft: number | null = null;

  // Paste-loot import (lines as JSON, appended; keys validated server-side).
  lootImportOpen = false;
  lootImportDraft = '';
  lootImportError: string | null = null;
  /** True briefly after "Copy JSON" (drives the "Copied" flash). */
  lootCopied = false;

  readonly lootImportExample = JSON.stringify(
    { coinGp: 125.5,
      items: [{ key: 'longsword' }, { key: 'rations', qty: 10 },
              { name: 'Flametongue', category: 'weapon', valueGp: 5000, weight: 3,
                damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' }] }, null, 2);

  readonly formatCp = formatCp;

  constructor(private curatedLoot: CuratedLootService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadLists();
    }
  }

  private loadLists(): void {
    if (!this.campaign) { this.lists = []; return; }
    this.curatedLoot.list(this.campaign.id).subscribe({
      next: lists => (this.lists = lists),
      error: err => console.error('Failed to load curated loot', err),
    });
  }

  createList(): void {
    const name = this.newName.trim();
    if (!name || this.busy) return;
    this.busy = true;
    this.curatedLoot.create(this.campaign.id, name, null).subscribe({
      next: loot => {
        this.newName = '';
        this.busy = false;
        this.select(loot);
        this.loadLists();
      },
      error: err => { this.busy = false; console.error('Failed to create loot list', err); },
    });
  }

  open(summary: CuratedLootSummary): void {
    this.curatedLoot.get(summary.id).subscribe({
      next: loot => this.select(loot),
      error: err => console.error('Failed to open loot list', err),
    });
  }

  back(): void {
    this.selected = null;
    this.loadLists(); // refresh item counts / coin totals
  }

  /** Persist the notes textarea (name unchanged). */
  saveNotes(): void {
    if (!this.selected) return;
    this.curatedLoot.update(this.selected.id, this.selected.name, this.notesDraft.trim() || null).subscribe({
      next: loot => this.select(loot),
      error: err => console.error('Failed to save loot notes', err),
    });
  }

  deleteList(): void {
    if (!this.selected) return;
    this.curatedLoot.delete(this.selected.id).subscribe({
      next: () => this.back(),
      error: err => console.error('Failed to delete loot list', err),
    });
  }

  // ── Lines ──────────────────────────────────────────────────────────────────

  /** The shared composer authored a line — append it to the selected list. */
  onItemAuthored(item: AuthoredItem): void {
    if (!this.selected || this.busy) return;
    this.busy = true;
    this.curatedLoot.addItem(this.selected.id, item).subscribe({
      next: loot => { this.select(loot); this.busy = false; },
      error: err => { this.busy = false; console.error('Failed to add loot item', err); },
    });
  }

  /** Persist a qty edit from the line's number input (reverts on failure). */
  changeQty(item: CuratedLootItem, qty: number): void {
    if (!this.selected || !qty || qty < 1) return;
    this.curatedLoot.updateItem(this.selected.id, item.id, Math.floor(qty), null, null).subscribe({
      next: loot => this.select(loot),
      error: err => {
        console.error('Failed to update loot item', err);
        this.open({ id: this.selected!.id } as CuratedLootSummary);
      },
    });
  }

  removeItem(item: CuratedLootItem): void {
    if (!this.selected) return;
    this.curatedLoot.removeItem(this.selected.id, item.id).subscribe({
      next: loot => this.select(loot),
      error: err => console.error('Failed to remove loot item', err),
    });
  }

  saveCoins(): void {
    if (!this.selected || this.coinGpDraft == null || this.coinGpDraft < 0) return;
    this.curatedLoot.setCoins(this.selected.id, this.coinGpDraft).subscribe({
      next: loot => this.select(loot),
      error: err => console.error('Failed to save loot coins', err),
    });
  }

  /** Compact attribute summary for a line (custom lines carry the stats). */
  itemMeta(item: CuratedLootItem): string {
    if (!item.custom) return 'Catalog item';
    const parts: string[] = [];
    if (item.category) parts.push(item.category);
    if (item.damage) parts.push(item.damage);
    if (item.armorClass) parts.push(`AC ${item.armorClass}`);
    if (item.weight != null) parts.push(`${item.weight} lb`);
    if (item.unitCostCp != null) parts.push(formatCp(item.unitCostCp));
    if (item.customNotes) parts.push(item.customNotes);
    return parts.length ? parts.join(' · ') : 'Custom item';
  }

  // ── JSON import / export ───────────────────────────────────────────────────

  toggleLootImport(): void {
    this.lootImportOpen = !this.lootImportOpen;
    this.lootImportError = null;
  }

  importLoot(): void {
    if (!this.selected || this.busy) return;
    const { payload, error } = parseLootImportPayload(this.lootImportDraft);
    if (error || !payload) {
      this.lootImportError = error ?? 'Could not read that JSON.';
      return;
    }
    this.busy = true;
    this.lootImportError = null;
    this.curatedLoot.importLoot(this.selected.id, payload).subscribe({
      next: loot => {
        this.busy = false;
        this.lootImportOpen = false;
        this.lootImportDraft = '';
        this.select(loot);
      },
      error: err => {
        this.busy = false;
        // Surface the server's message (e.g. "Unknown catalog keys: vorpal-blade").
        this.lootImportError = err?.error?.message ?? err?.message ?? 'Import failed.';
      },
    });
  }

  /** Copy the list's JSON (import format) so DMs can share or author by example. */
  copyLootJson(): void {
    if (!this.selected) return;
    navigator.clipboard?.writeText(JSON.stringify(toLootImportPayload(this.selected), null, 2));
    this.lootCopied = true;
    setTimeout(() => (this.lootCopied = false), 1500);
  }

  trackById(_index: number, x: { id: number }): number {
    return x.id;
  }

  private select(loot: CuratedLoot): void {
    this.selected = loot;
    this.notesDraft = loot.notes ?? '';
    this.coinGpDraft = loot.coinCp > 0 ? loot.coinCp / 100 : null;
  }
}
