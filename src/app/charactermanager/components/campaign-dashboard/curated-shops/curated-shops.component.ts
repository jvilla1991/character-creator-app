import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Campaign } from '../../../models/campaign';
import { CuratedShop, ShopSummary } from '../../../models/curated-shop';
import { formatCp } from '../../../models/shop';
import { CuratedShopService } from '../../../services/curated-shop.service';

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
})
export class CuratedShopsComponent implements OnChanges {
  @Input() campaign!: Campaign;

  shops: ShopSummary[] = [];
  selected: CuratedShop | null = null;
  newName = '';
  busy = false;

  readonly importCategories: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
    { value: 'MATERIAL_COMPONENT', label: 'Components' },
  ];

  readonly formatCp = formatCp;

  constructor(private curatedShops: CuratedShopService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campaign']) {
      this.selected = null;
      this.loadShops();
    }
  }

  private loadShops(): void {
    if (!this.campaign) { this.shops = []; return; }
    this.curatedShops.list(this.campaign.id).subscribe({
      next: shops => (this.shops = shops),
      error: err => console.error('Failed to load curated shops', err),
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
      error: err => { this.busy = false; console.error('Failed to create shop', err); },
    });
  }

  open(summary: ShopSummary): void {
    this.curatedShops.get(summary.id).subscribe({
      next: shop => (this.selected = shop),
      error: err => console.error('Failed to open shop', err),
    });
  }

  back(): void {
    this.selected = null;
    this.loadShops(); // refresh item counts
  }

  importCategory(category: string): void {
    if (!this.selected || this.busy) return;
    this.busy = true;
    this.curatedShops.importCategory(this.selected.id, category).subscribe({
      next: shop => { this.selected = shop; this.busy = false; },
      error: err => { this.busy = false; console.error('Failed to import category', err); },
    });
  }

  removeItem(item: CuratedShop['items'][number]): void {
    if (!this.selected) return;
    this.curatedShops.removeItem(this.selected.id, item.id).subscribe({
      next: shop => (this.selected = shop),
      error: err => console.error('Failed to remove item', err),
    });
  }

  /** Save a price override typed in gp; empty clears it back to the catalog price. */
  setOverride(item: CuratedShop['items'][number], gpValue: string): void {
    if (!this.selected) return;
    const trimmed = (gpValue ?? '').trim();
    let priceCp: number | null;
    if (trimmed === '') {
      priceCp = null;
    } else {
      const gp = Number(trimmed);
      if (isNaN(gp) || gp < 0) return;
      priceCp = Math.round(gp * 100);
    }
    this.curatedShops.updateItem(this.selected.id, item.id, priceCp).subscribe({
      next: shop => (this.selected = shop),
      error: err => console.error('Failed to update price', err),
    });
  }

  deleteShop(): void {
    if (!this.selected) return;
    const id = this.selected.id;
    this.curatedShops.delete(id).subscribe({
      next: () => this.back(),
      error: err => console.error('Failed to delete shop', err),
    });
  }

  trackById(_index: number, x: { id: number }): number {
    return x.id;
  }
}
