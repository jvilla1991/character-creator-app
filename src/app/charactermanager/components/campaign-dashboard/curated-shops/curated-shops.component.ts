import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { CuratedShop, ShopSummary, toImportPayload } from '../../../models/curated-shop';
import { categoryLabelFor, formatCp } from '../../../models/shop';
import { AuthoredItem } from '../../item-composer/authored-item';
import { ItemComposerComponent } from '../../item-composer/item-composer.component';
import { CuratedShopService } from '../../../services/curated-shop.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmService } from '../../modal/confirm.service';
import { FormsModule } from '@angular/forms';
import { JsonImportComponent, JsonImportConfirmed } from '../../json-import/json-import.component';

/**
 * DM-curated shops panel on the campaign dashboard. The DM creates reusable
 * shops, seeds them from a standard catalog category ("import"), prunes items
 * and sets price overrides; the shop is later activated in Session Mode.
 * Mirrors the campaign-notes panel: reloads when the selected campaign changes.
 */
@Component({
    selector: 'app-curated-shops',
    templateUrl: './curated-shops.component.html',
    styleUrls: ['./curated-shops.component.scss'],
    imports: [FormsModule, ItemComposerComponent, JsonImportComponent]
})
export class CuratedShopsComponent implements OnChanges {
  @Input() campaign!: Campaign;

  shops: ShopSummary[] = [];
  selected: CuratedShop | null = null;
  newName = '';
  busy = false;
  /** The list request failed — say so instead of showing an empty list. */
  loadFailed = false;

  // Paste-a-shop import (whole shop as JSON). The import box owns the text and
  // checks it; the server still has the final say on catalog keys.
  importOpen = false;
  importError: string | null = null;
  /** Shop id whose JSON was just copied (drives the "Copied" flash). */
  copiedShopId: number | null = null;

  readonly importCategories: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
    { value: 'MATERIAL_COMPONENT', label: 'Components' },
    { value: 'GEAR', label: 'Gear' },
    { value: 'TRANSPORT', label: 'Transport' },
  ];

  readonly formatCp = formatCp;

  private readonly notifications = inject(NotificationService);
  private readonly confirmations = inject(ConfirmService);

  constructor(private curatedShops: CuratedShopService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadShops();
    }
  }

  loadShops(): void {
    if (!this.campaign) { this.shops = []; return; }
    this.curatedShops.list(this.campaign.id).subscribe({
      next: shops => { this.shops = shops; this.loadFailed = false; },
      error: err => {
        this.loadFailed = true;
        this.notifications.error('Could not load the shops. Try again.', err);
      },
    });
  }

  createShop(): void {
    const name = this.newName.trim();
    if (!name || this.busy) return;
    this.busy = true;
    this.curatedShops.create(this.campaign.id, name, '').subscribe({
      next: shop => {
        this.newName = '';
        this.busy = false;
        this.selected = shop;
        this.loadShops();
      },
      error: err => {
        this.busy = false;
        this.notifications.error('Could not create the shop. Try again.', err);
      },
    });
  }

  open(summary: ShopSummary): void {
    this.curatedShops.get(summary.id).subscribe({
      next: shop => (this.selected = shop),
      error: err => this.notifications.error('Could not open that shop. Try again.', err),
    });
  }

  back(): void {
    this.selected = null;
    this.loadShops(); // refresh item counts
  }

  // ── Import a whole shop from pasted JSON ──────────────────────────────────

  toggleImport(): void {
    this.importOpen = !this.importOpen;
    this.importError = null;
  }

  /** The import box's paste passed its check — send it. */
  importShop(confirmed: JsonImportConfirmed): void {
    const payload = confirmed.shop;
    if (this.busy || !payload) return;
    this.busy = true;
    this.importError = null;
    this.curatedShops.importShop(this.campaign.id, payload).subscribe({
      next: shop => {
        this.busy = false;
        this.importOpen = false;
        this.selected = shop;
        this.loadShops();
      },
      error: err => {
        this.busy = false;
        // Surface the server's message (e.g. "Unknown catalog keys: vorpal-blade").
        this.importError = err?.error?.message ?? err?.message ?? 'Import failed.';
      },
    });
  }

  /** Copy a shop's JSON (import format) so DMs can share or author by example. */
  copyShopJson(summary: ShopSummary): void {
    this.curatedShops.get(summary.id).subscribe({
      next: shop => {
        navigator.clipboard?.writeText(JSON.stringify(toImportPayload(shop), null, 2));
        this.copiedShopId = summary.id;
        setTimeout(() => (this.copiedShopId = null), 1500);
      },
      error: err => this.notifications.error('Could not copy the shop. Try again.', err),
    });
  }

  importCategory(category: string): void {
    if (!this.selected || this.busy) return;
    this.busy = true;
    this.curatedShops.importCategory(this.selected.id, category).subscribe({
      next: shop => { this.selected = shop; this.busy = false; },
      error: err => {
        this.busy = false;
        this.notifications.error('Could not stock that category. Try again.', err);
      },
    });
  }

  /** The shared composer authored a line — a catalog pick or a custom item. */
  onItemAuthored(item: AuthoredItem): void {
    if (!this.selected || this.busy) return;
    this.busy = true;
    this.curatedShops.addItem(this.selected.id, item).subscribe({
      next: shop => { this.selected = shop; this.busy = false; },
      error: err => {
        this.busy = false;
        const taken = (err as { status?: number } | null)?.status === 409;
        this.notifications.error(
          taken ? 'That item is already in this shop.' : 'Could not add the item. Try again.', err);
      },
    });
  }

  /** The line under an item's name: its category, plus a custom item's own stats. */
  itemMeta(item: CuratedShop['items'][number]): string {
    const parts: string[] = [categoryLabelFor(item.category)];
    if (item.custom) {
      const damage = item.details?.['damage'];
      const armorClass = item.details?.['armorClass'];
      if (typeof damage === 'string' && damage) parts.push(damage);
      if (typeof armorClass === 'string' && armorClass) parts.push(`AC ${armorClass}`);
      if (item.weight != null) parts.push(`${item.weight} lb`);
      if (item.bulk != null) parts.push(`${item.bulk} bulk`);
      parts.push('custom');
    }
    return parts.join(' · ');
  }

  removeItem(item: CuratedShop['items'][number]): void {
    if (!this.selected) return;
    this.curatedShops.removeItem(this.selected.id, item.id).subscribe({
      next: shop => (this.selected = shop),
      error: err => this.notifications.error(`Could not remove ${item.name}. Try again.`, err),
    });
  }

  /**
   * Save a price typed in gp. On a catalog line it is an override, and empty
   * clears it back to the catalog price; a custom line has no catalog price,
   * so an emptied field is put back. `field`, when given, is the input it was
   * typed into: a failed save puts it back to the saved price, so the shop
   * never shows a price it does not charge.
   */
  setOverride(item: CuratedShop['items'][number], gpValue: string, field?: HTMLInputElement): void {
    if (!this.selected) return;
    const trimmed = (gpValue ?? '').trim();
    let priceCp: number | null;
    if (trimmed === '' && item.custom) {
      if (field) field.value = String(item.effectiveCostCp / 100);
      this.notifications.notify(`${item.name} is a custom item, so it needs a price. Enter 0 to give it away.`);
      return;
    }
    if (trimmed === '') {
      priceCp = null;
    } else {
      const gp = Number(trimmed);
      if (isNaN(gp) || gp < 0) return;
      priceCp = Math.round(gp * 100);
    }
    this.curatedShops.updateItem(this.selected.id, item.id, priceCp).subscribe({
      next: shop => (this.selected = shop),
      error: err => {
        if (field) field.value = item.priceOverrideCp != null ? String(item.priceOverrideCp / 100) : '';
        this.notifications.error(`Could not change the price of ${item.name}. Try again.`, err);
      },
    });
  }

  /** Asks first — a stocked, priced shop is prep work that is slow to rebuild. */
  deleteShop(): void {
    const shop = this.selected;
    if (!shop) return;
    this.confirmations.confirm({
      title: 'Delete Shop',
      subject: shop.name,
      message: 'will be erased along with its stock and prices. This cannot be undone.',
      confirmLabel: 'Delete Shop',
    }).subscribe(() => this.reallyDelete(shop.id));
  }

  private reallyDelete(id: number): void {
    this.curatedShops.delete(id).subscribe({
      next: () => this.back(),
      error: err => this.notifications.error('Could not delete the shop. Try again.', err),
    });
  }

  trackById(_index: number, x: { id: number }): number {
    return x.id;
  }
}
