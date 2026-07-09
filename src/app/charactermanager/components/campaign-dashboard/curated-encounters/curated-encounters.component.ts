import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { Encounter, EncounterCreature, EncounterLootItem, EncounterSummary } from '../../../models/encounter';
import { parseLootImportPayload, toLootImportPayload } from '../../../models/loot';
import { CatalogItem, formatCp } from '../../../models/shop';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';
import { ShopService } from '../../../services/shop.service';

/**
 * DM-curated encounters panel on the campaign dashboard. The DM creates reusable
 * encounters and fills them with free-hand enemy creatures (name, DEX modifier,
 * optional HP, quantity); the encounter is later loaded into Session Mode, where
 * each creature becomes an enemy combatant. Mirrors the curated-shops panel:
 * reloads when the selected campaign changes.
 *
 * Each encounter also carries prepped loot — catalog items, custom items, and a
 * coin pile — which the DM can drop as a claimable pool in Session Mode. Loot is
 * edited inline here, or bulk-added from pasted JSON (mirroring the shop import).
 */
@Component({
  selector: 'app-curated-encounters',
  templateUrl: './curated-encounters.component.html',
  styleUrls: ['./curated-encounters.component.scss'],
})
export class CuratedEncountersComponent implements OnChanges {
  @Input() campaign!: Campaign;

  encounters: EncounterSummary[] = [];
  selected: Encounter | null = null;
  newName = '';
  notesDraft = '';
  busy = false;

  // The "add creature" form.
  cName = '';
  cDex: number | null = null;
  cHp: number | null = null;
  cQty = 1;

  // The "add loot" form — catalog mode picks from the SRD by category, custom
  // mode is free text (magic items, trophies).
  lootMode: 'catalog' | 'custom' = 'catalog';
  lootCategory = 'WEAPON';
  lootCatalog: CatalogItem[] = [];
  lootItemKey = '';
  lootCustomName = '';
  lootCustomNotes = '';
  lootQty = 1;
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
              { name: 'Cloak of Elvenkind', notes: 'Advantage on Stealth while hooded.' }] }, null, 2);

  readonly lootCategories: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
    { value: 'MATERIAL_COMPONENT', label: 'Components' },
    { value: 'GEAR', label: 'Gear' },
  ];

  readonly formatCp = formatCp;

  constructor(private curatedEncounters: CuratedEncounterService,
              private shopService: ShopService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadEncounters();
    }
  }

  private loadEncounters(): void {
    if (!this.campaign) { this.encounters = []; return; }
    this.curatedEncounters.list(this.campaign.id).subscribe({
      next: encounters => (this.encounters = encounters),
      error: err => console.error('Failed to load curated encounters', err),
    });
  }

  createEncounter(): void {
    const name = this.newName.trim();
    if (!name || this.busy) return;
    this.busy = true;
    this.curatedEncounters.create(this.campaign.id, name, '').subscribe({
      next: encounter => {
        this.newName = '';
        this.busy = false;
        this.select(encounter);
        this.loadEncounters();
      },
      error: err => { this.busy = false; console.error('Failed to create encounter', err); },
    });
  }

  open(summary: EncounterSummary): void {
    this.curatedEncounters.get(summary.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to open encounter', err),
    });
  }

  back(): void {
    this.selected = null;
    this.loadEncounters(); // refresh creature counts
  }

  /** Persist the notes textarea (name unchanged). */
  saveNotes(): void {
    if (!this.selected) return;
    this.curatedEncounters.update(this.selected.id, this.selected.name, this.notesDraft).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to save notes', err),
    });
  }

  addCreature(): void {
    if (!this.selected || this.busy) return;
    const name = this.cName.trim();
    if (!name || this.cDex == null) return;
    const qty = this.cQty && this.cQty >= 1 ? Math.floor(this.cQty) : 1;
    this.busy = true;
    this.curatedEncounters.addCreature(this.selected.id, name, this.cDex, this.cHp, qty).subscribe({
      next: encounter => {
        this.select(encounter);
        this.cName = '';
        this.cDex = null;
        this.cHp = null;
        this.cQty = 1;
        this.busy = false;
      },
      error: err => { this.busy = false; console.error('Failed to add creature', err); },
    });
  }

  removeCreature(creature: EncounterCreature): void {
    if (!this.selected) return;
    this.curatedEncounters.removeCreature(this.selected.id, creature.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to remove creature', err),
    });
  }

  deleteEncounter(): void {
    if (!this.selected) return;
    this.curatedEncounters.delete(this.selected.id).subscribe({
      next: () => this.back(),
      error: err => console.error('Failed to delete encounter', err),
    });
  }

  // ── Loot ───────────────────────────────────────────────────────────────────

  /** Load the catalog slice for the loot picker (once per category switch). */
  onLootCategoryChange(): void {
    this.lootItemKey = '';
    this.loadLootCatalog();
  }

  private loadLootCatalog(): void {
    this.shopService.getCatalog(this.lootCategory).subscribe({
      next: items => (this.lootCatalog = items),
      error: err => console.error('Failed to load catalog', err),
    });
  }

  setLootMode(mode: 'catalog' | 'custom'): void {
    this.lootMode = mode;
    if (mode === 'catalog' && !this.lootCatalog.length) this.loadLootCatalog();
  }

  addLootItem(): void {
    if (!this.selected || this.busy) return;
    const qty = this.lootQty && this.lootQty >= 1 ? Math.floor(this.lootQty) : 1;
    const catalog = this.lootMode === 'catalog';
    if (catalog && !this.lootItemKey) return;
    if (!catalog && !this.lootCustomName.trim()) return;
    this.busy = true;
    this.curatedEncounters.addLootItem(this.selected.id,
      catalog ? this.lootItemKey : null,
      catalog ? null : this.lootCustomName.trim(),
      catalog ? null : (this.lootCustomNotes.trim() || null),
      qty).subscribe({
      next: encounter => {
        this.select(encounter);
        this.lootItemKey = '';
        this.lootCustomName = '';
        this.lootCustomNotes = '';
        this.lootQty = 1;
        this.busy = false;
      },
      error: err => { this.busy = false; console.error('Failed to add loot', err); },
    });
  }

  /** Persist a qty edit from the line's number input (reverts on failure). */
  changeLootQty(item: EncounterLootItem, qty: number): void {
    if (!this.selected || !qty || qty < 1) return;
    this.curatedEncounters.updateLootItem(this.selected.id, item.id, Math.floor(qty), null, null).subscribe({
      next: encounter => this.select(encounter),
      error: err => { console.error('Failed to update loot', err); this.open({ id: this.selected!.id } as EncounterSummary); },
    });
  }

  removeLootItem(item: EncounterLootItem): void {
    if (!this.selected) return;
    this.curatedEncounters.removeLootItem(this.selected.id, item.id).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to remove loot', err),
    });
  }

  saveLootCoins(): void {
    if (!this.selected || this.coinGpDraft == null || this.coinGpDraft < 0) return;
    this.curatedEncounters.setLootCoins(this.selected.id, this.coinGpDraft).subscribe({
      next: encounter => this.select(encounter),
      error: err => console.error('Failed to save loot coins', err),
    });
  }

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
    this.curatedEncounters.importLoot(this.selected.id, payload).subscribe({
      next: encounter => {
        this.busy = false;
        this.lootImportOpen = false;
        this.lootImportDraft = '';
        this.select(encounter);
      },
      error: err => {
        this.busy = false;
        // Surface the server's message (e.g. "Unknown catalog keys: vorpal-blade").
        this.lootImportError = err?.error?.message ?? err?.message ?? 'Import failed.';
      },
    });
  }

  /** Copy the loot's JSON (import format) so DMs can share or author by example. */
  copyLootJson(): void {
    if (!this.selected) return;
    navigator.clipboard?.writeText(JSON.stringify(toLootImportPayload(this.selected), null, 2));
    this.lootCopied = true;
    setTimeout(() => (this.lootCopied = false), 1500);
  }

  /** Total combatants this encounter will spawn (sum of quantities). */
  totalCombatants(encounter: Encounter): number {
    return encounter.creatures.reduce((sum, c) => sum + Math.max(1, c.quantity), 0);
  }

  trackById(_index: number, x: { id: number }): number {
    return x.id;
  }

  private select(encounter: Encounter): void {
    this.selected = encounter;
    this.notesDraft = encounter.notes ?? '';
    this.coinGpDraft = encounter.lootCoinCp > 0 ? encounter.lootCoinCp / 100 : null;
  }
}
