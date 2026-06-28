import { Component, Input, OnChanges } from '@angular/core';
import { SessionState, ParticipantView } from '../../../models/session';
import { ShopItem, ShopView, formatCp } from '../../../models/shop';
import { PC } from '../../../models/pc';
import { ShopService } from '../../../services/shop.service';
import { PCService } from '../../../services/pc.service';
import { NotificationService } from '../../../services/notification.service';

/**
 * Session Mode shop. The DM activates one weapon shop (Phase 1), types a
 * settlement label, and toggles which roster characters are at it; targeted
 * players see the catalog and buy. Visibility is driven by the session poll
 * (`shopForMe` on the snapshot) — non-targeted players never render this.
 *
 * State stays server-authoritative: a purchase hits the backend (coins deducted
 * + inventory appended on the pc row) and the returned coins/inventory are
 * mirrored into the local PC store. DM open/target/close return the updated shop
 * view directly so the DM's controls respond without waiting for the next poll.
 */
@Component({
  selector: 'app-shop-panel',
  templateUrl: './shop-panel.component.html',
  styleUrls: ['./shop-panel.component.scss'],
})
export class ShopPanelComponent implements OnChanges {
  @Input() state!: SessionState;

  shop: ShopView | null = null;
  loading = false;
  busyItem: string | null = null; // itemKey mid-purchase

  // DM open-shop form
  settlement = '';
  category: 'WEAPON' | 'ARMOR' = 'WEAPON';
  selected: { [pcId: number]: boolean } = {};

  /** Catalog slices a DM can open (Phase 1). */
  readonly categories: ReadonlyArray<{ value: 'WEAPON' | 'ARMOR'; label: string }> = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
  ];

  /** Guards re-fetching the catalog on every 2s poll; only refetch on a real change. */
  private fetchedKey: string | null = null;

  readonly formatCp = formatCp;

  constructor(
    private shopService: ShopService,
    private pcService: PCService,
    private notifications: NotificationService,
  ) {}

  ngOnChanges(): void {
    const s = this.state;
    if (!s) return;
    if (s.shopForMe && s.shopOpen) {
      const key = `${s.sessionId}|${s.shopCategory}`;
      if (key !== this.fetchedKey) {
        this.fetchedKey = key;
        this.fetchShop();
      }
    } else if (!s.shopOpen) {
      this.shop = null;
      this.fetchedKey = null;
    }
  }

  /** PC combatants the DM may place at a shop (NPCs excluded). */
  get roster(): ParticipantView[] {
    return (this.state?.participants ?? []).filter(p => p.pcId != null && !p.npc);
  }

  get myParticipant(): ParticipantView | null {
    return (this.state?.participants ?? []).find(p => p.ownedByMe && p.pcId != null) ?? null;
  }

  get myPc(): PC | undefined {
    const pcId = this.myParticipant?.pcId;
    return pcId != null ? this.pcService.getPCById(pcId) : undefined;
  }

  /** The buyer's total wealth in copper (same rates as the coin purse). */
  get myCoinsCp(): number {
    const c = this.myPc?.coins;
    if (!c) return 0;
    return (c.cp ?? 0) + (c.sp ?? 0) * 10 + (c.ep ?? 0) * 50 + (c.gp ?? 0) * 100 + (c.pp ?? 0) * 1000;
  }

  canAfford(item: ShopItem): boolean {
    return this.myCoinsCp >= item.costCp;
  }

  detail(item: ShopItem, key: string): string {
    const v = item.details?.[key];
    return Array.isArray(v) ? v.join(', ') : (v ?? '');
  }

  /** The descriptive line under an item, by category (weapon damage vs armor AC). */
  itemMeta(item: ShopItem): string {
    const cat = (item.category || '').toUpperCase();
    const fields = cat === 'ARMOR'
      ? [this.detail(item, 'armorClass'), this.detail(item, 'armorCategory')]
      : [this.detail(item, 'damage'), this.detail(item, 'properties')];
    return fields.filter(f => f).join(' · ');
  }

  /** Singular label for a category, used in shop headers and buttons. */
  categoryLabel(category: string | null | undefined): string {
    return (category || '').toUpperCase() === 'ARMOR' ? 'Armor' : 'Weapon';
  }

  // --- DM actions ----------------------------------------------------------

  openShop(): void {
    const pcIds = this.roster.filter(p => this.selected[p.pcId!]).map(p => p.pcId!);
    this.shopService.openShop(this.state.sessionId, this.category, this.settlement.trim(), pcIds).subscribe({
      next: view => {
        this.shop = view;
        this.fetchedKey = `${this.state.sessionId}|${this.category}`;
      },
      error: err => this.notifications.notify(this.errMsg(err, 'Could not open the shop.')),
    });
  }

  closeShop(): void {
    this.shopService.closeShop(this.state.sessionId).subscribe({
      next: () => {
        this.shop = null;
        this.fetchedKey = null;
      },
      error: err => this.notifications.notify(this.errMsg(err, 'Could not close the shop.')),
    });
  }

  isAttendee(pcId: number): boolean {
    return !!this.shop?.attendeePcIds?.includes(pcId);
  }

  toggleAttendee(pcId: number): void {
    const next = new Set(this.shop?.attendeePcIds ?? []);
    next.has(pcId) ? next.delete(pcId) : next.add(pcId);
    this.shopService.setAttendees(this.state.sessionId, Array.from(next)).subscribe({
      next: view => (this.shop = view),
      error: err => this.notifications.notify(this.errMsg(err, 'Could not update who is at the shop.')),
    });
  }

  // --- player action -------------------------------------------------------

  buy(item: ShopItem): void {
    const pcId = this.myParticipant?.pcId;
    if (pcId == null || this.busyItem) return;
    this.busyItem = item.itemKey;
    this.shopService.purchase(this.state.sessionId, pcId, item.itemKey, 1).subscribe({
      next: res => {
        this.pcService.patchLocalPC(pcId, { coins: res.coins, inventory: res.inventory });
        this.notifications.notify(`Bought ${item.name} for ${this.formatCp(item.costCp)}.`);
        this.busyItem = null;
      },
      error: err => {
        this.busyItem = null;
        this.notifications.notify(this.errMsg(err, 'Purchase failed.'));
      },
    });
  }

  // --- helpers -------------------------------------------------------------

  private fetchShop(): void {
    this.loading = true;
    this.shopService.getShop(this.state.sessionId).subscribe({
      next: view => {
        this.shop = view;
        this.loading = false;
      },
      error: () => {
        this.shop = null;
        this.loading = false;
      },
    });
  }

  private errMsg(err: any, fallback: string): string {
    if (err?.status === 409) return 'Not enough coin for that purchase.';
    if (err?.status === 403) return 'That character isn’t at this shop.';
    return err?.error?.message || fallback;
  }

  trackByKey(_: number, item: ShopItem): string {
    return item.itemKey;
  }
}
