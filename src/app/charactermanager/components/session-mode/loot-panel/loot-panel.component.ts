import { Component, Input, OnChanges } from '@angular/core';
import { SessionState, ParticipantView } from '../../../models/session';
import { LootItem, LootView } from '../../../models/loot';
import { EncounterSummary } from '../../../models/encounter';
import { CatalogItem, formatCp } from '../../../models/shop';
import { PC } from '../../../models/pc';
import { LootService } from '../../../services/loot.service';
import { CuratedEncounterService } from '../../../services/curated-encounter.service';
import { ShopService } from '../../../services/shop.service';
import { PCService } from '../../../services/pc.service';
import { NotificationService } from '../../../services/notification.service';

/**
 * Session Mode post-combat loot. The DM prepares a pool — seeded from a curated
 * encounter's prepped loot or built from scratch — edits it as an invisible
 * draft, then drops it; players claim items and take coins first-come-first-
 * served. Visibility is driven by the session poll (`lootStatus` on the
 * snapshot): players render nothing until it reads 'DROPPED'.
 *
 * State stays server-authoritative: a claim hits the backend (inventory/coins
 * written to the pc row under a lock, pool decremented) and the returned
 * coins/inventory are mirrored into the local PC store, with the refreshed pool
 * replacing the local copy. Unlike the shop, pool CONTENTS change under a
 * stable status (someone else claims), so the poll-driven refetch is keyed on
 * the session version, not just on the status flipping.
 */
@Component({
  selector: 'app-loot-panel',
  templateUrl: './loot-panel.component.html',
  styleUrls: ['./loot-panel.component.scss'],
})
export class LootPanelComponent implements OnChanges {
  @Input() state!: SessionState;

  loot: LootView | null = null;
  loading = false;
  busyItemId: number | null = null; // loot line mid-claim
  busyCoins = false;

  // DM prepare form
  source: 'encounter' | 'scratch' = 'encounter';
  encounterId: number | null = null;
  encounters: EncounterSummary[] = [];
  nameDraft = '';

  // DM add-item form (draft or live), mirroring the curated loot editor.
  lootMode: 'catalog' | 'custom' = 'catalog';
  lootCategory = 'WEAPON';
  lootCatalog: CatalogItem[] = [];
  lootItemKey = '';
  lootCustomName = '';
  lootCustomNotes = '';
  lootQty = 1;
  /** The DM's coin pile input, in gp. */
  coinGpDraft: number | null = null;

  // Player inputs
  claimQty: { [itemId: number]: number } = {};
  /** Coins to take from the pile, in gp. */
  takeGp: number | null = null;

  readonly lootCategories: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
    { value: 'MATERIAL_COMPONENT', label: 'Components' },
    { value: 'GEAR', label: 'Gear' },
  ];

  /**
   * Guards re-fetching on every 2s poll. Includes the version: claims and DM
   * edits mutate the pool under a stable lootStatus, and every one of them
   * bumps the session version.
   */
  private fetchedKey: string | null = null;
  /** Guards re-loading the DM's curated encounter list per campaign. */
  private encountersLoadedFor: string | null = null;

  readonly formatCp = formatCp;

  constructor(
    private lootService: LootService,
    private curatedEncounterService: CuratedEncounterService,
    private shopService: ShopService,
    private pcService: PCService,
    private notifications: NotificationService,
  ) {}

  ngOnChanges(): void {
    const s = this.state;
    if (!s) return;
    if (s.lootStatus) {
      const key = `${s.sessionId}|${s.version}`;
      if (key !== this.fetchedKey) {
        this.fetchedKey = key;
        this.fetchLoot();
      }
    } else {
      this.loot = null;
      this.fetchedKey = null;
    }
    // The DM can seed the pool from a curated encounter — load the list once.
    if (s.dm && `${s.campaignId}` !== this.encountersLoadedFor) {
      this.encountersLoadedFor = `${s.campaignId}`;
      this.curatedEncounterService.list(s.campaignId).subscribe({
        next: encounters => (this.encounters = encounters),
        error: () => (this.encounters = []),
      });
    }
  }

  get myParticipant(): ParticipantView | null {
    return (this.state?.participants ?? []).find(p => p.ownedByMe && p.pcId != null) ?? null;
  }

  get myPc(): PC | undefined {
    const pcId = this.myParticipant?.pcId;
    return pcId != null ? this.pcService.getPCById(pcId) : undefined;
  }

  /** Heading for the pool: its label or a generic fallback. */
  lootTitle(loot: LootView): string {
    return loot.name || 'Spoils';
  }

  // --- DM actions ------------------------------------------------------------

  get canPrepare(): boolean {
    return this.source === 'scratch' || this.encounterId != null;
  }

  prepare(): void {
    const encounterId = this.source === 'encounter' ? this.encounterId : null;
    this.lootService.open(this.state.sessionId, encounterId, this.nameDraft.trim() || null).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not prepare the loot.')),
    });
  }

  drop(): void {
    this.lootService.drop(this.state.sessionId).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not drop the loot.')),
    });
  }

  close(): void {
    this.lootService.close(this.state.sessionId).subscribe({
      next: () => {
        this.loot = null;
        this.fetchedKey = null;
      },
      error: err => this.notifications.notify(this.errMsg(err, 'Could not close the loot.')),
    });
  }

  onLootCategoryChange(): void {
    this.lootItemKey = '';
    this.loadLootCatalog();
  }

  setLootMode(mode: 'catalog' | 'custom'): void {
    this.lootMode = mode;
    if (mode === 'catalog' && !this.lootCatalog.length) this.loadLootCatalog();
  }

  private loadLootCatalog(): void {
    this.shopService.getCatalog(this.lootCategory).subscribe({
      next: items => (this.lootCatalog = items),
      error: () => (this.lootCatalog = []),
    });
  }

  addItem(): void {
    if (!this.loot) return;
    const qty = this.lootQty && this.lootQty >= 1 ? Math.floor(this.lootQty) : 1;
    const catalog = this.lootMode === 'catalog';
    if (catalog && !this.lootItemKey) return;
    if (!catalog && !this.lootCustomName.trim()) return;
    this.lootService.addItem(this.state.sessionId,
      catalog ? this.lootItemKey : null,
      catalog ? null : this.lootCustomName.trim(),
      catalog ? null : (this.lootCustomNotes.trim() || null),
      qty).subscribe({
      next: view => {
        this.setLoot(view);
        this.lootItemKey = '';
        this.lootCustomName = '';
        this.lootCustomNotes = '';
        this.lootQty = 1;
      },
      error: err => this.notifications.notify(this.errMsg(err, 'Could not add the item.')),
    });
  }

  changeQty(item: LootItem, qty: number): void {
    if (!qty || qty < 1) return;
    this.lootService.updateItem(this.state.sessionId, item.id, Math.floor(qty), null, null).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not update the item.')),
    });
  }

  removeItem(item: LootItem): void {
    this.lootService.removeItem(this.state.sessionId, item.id).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not remove the item.')),
    });
  }

  saveCoins(): void {
    if (this.coinGpDraft == null || this.coinGpDraft < 0) return;
    this.lootService.setCoins(this.state.sessionId, this.coinGpDraft).subscribe({
      next: view => this.setLoot(view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not set the coins.')),
    });
  }

  // --- player actions ---------------------------------------------------------

  claim(item: LootItem): void {
    const pcId = this.myParticipant?.pcId;
    if (pcId == null || this.busyItemId != null) return;
    const qty = Math.min(Math.max(1, Math.floor(this.claimQty[item.id] || 1)), item.qtyRemaining);
    this.busyItemId = item.id;
    this.lootService.claimItem(this.state.sessionId, pcId, item.id, qty).subscribe({
      next: res => {
        this.pcService.patchLocalPC(pcId, { coins: res.coins, inventory: res.inventory });
        this.setLoot(res.loot);
        this.claimQty[item.id] = 1;
        this.notifications.notify(`Claimed ${item.name}${qty > 1 ? ' ×' + qty : ''}.`);
        this.busyItemId = null;
      },
      error: err => {
        this.busyItemId = null;
        this.notifications.notify(this.errMsg(err, 'Claim failed.'));
        this.refetchNow();
      },
    });
  }

  takeCoins(): void {
    const pcId = this.myParticipant?.pcId;
    if (pcId == null || this.busyCoins || this.takeGp == null || this.takeGp <= 0) return;
    // Whole-copper amounts only: 1.5 gp → 1 gp 5 sp is expressible, but sub-cp isn't.
    const cp = Math.round(this.takeGp * 100);
    this.busyCoins = true;
    this.lootService.claimCoins(this.state.sessionId, pcId, { cp }).subscribe({
      next: res => {
        this.pcService.patchLocalPC(pcId, { coins: res.coins });
        this.setLoot(res.loot);
        this.notifications.notify(`Took ${formatCp(cp)} from the pile.`);
        this.takeGp = null;
        this.busyCoins = false;
      },
      error: err => {
        this.busyCoins = false;
        this.notifications.notify(this.errMsg(err, 'Could not take the coins.'));
        this.refetchNow();
      },
    });
  }

  // --- helpers -----------------------------------------------------------------

  private setLoot(view: LootView): void {
    this.loot = view;
    this.coinGpDraft = view.coinCpTotal > 0 ? view.coinCpTotal / 100 : null;
  }

  private fetchLoot(): void {
    this.loading = true;
    this.lootService.getLoot(this.state.sessionId).subscribe({
      next: view => {
        if (view) this.setLoot(view); else this.loot = null;
        this.loading = false;
      },
      error: () => {
        this.loot = null;
        this.loading = false;
      },
    });
  }

  /** After a failed claim (usually a 409 race), pull the fresh pool immediately. */
  private refetchNow(): void {
    this.fetchedKey = null;
    this.fetchLoot();
  }

  private errMsg(err: any, fallback: string): string {
    if (err?.status === 409) return err?.error?.message || 'Someone got there first.';
    if (err?.status === 403) return 'That character can’t claim from this loot.';
    return err?.error?.message || fallback;
  }

  trackById(_: number, item: LootItem): number {
    return item.id;
  }
}
