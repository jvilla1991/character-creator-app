import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC, PcItem } from '../../../../models/pc';
import { ShopCategory, ShopItem, formatCp } from '../../../../models/shop';
import { CatalogService } from '../../../../services/catalog.service';

type AdHocCategory = PcItem['category'];

/**
 * Displays and manages a character's structured inventory (`pc.inventory`).
 * Mirrors {@link CoinPurseComponent}: takes the PC, and when `editable` emits a
 * modified PC via `pcChange` — the host character-sheet routes that to
 * updatePC / updatePCAsDm. Read-only when `editable` is false (e.g. the
 * in-session embed). `equipped` is a display flag only — it does not recompute
 * AC or any derived stat.
 */
@Component({
  selector: 'app-inventory-panel',
  templateUrl: './inventory-panel.component.html',
  styleUrls: ['./inventory-panel.component.scss']
})
export class InventoryPanelComponent {
  @Input() pc!: PC;
  /** When true, shows add/remove/qty/equip controls and emits pcChange. */
  @Input() editable = false;
  @Output() pcChange = new EventEmitter<PC>();

  readonly formatCp = formatCp;

  /** Category picker for "add from catalog". */
  readonly catalogCategories: { value: ShopCategory; label: string }[] = [
    { value: 'WEAPON', label: 'Weapons' },
    { value: 'ARMOR', label: 'Armor' },
    { value: 'MATERIAL_COMPONENT', label: 'Material Components' },
  ];

  /** Ad-hoc item categories the player can pick. */
  readonly adHocCategories: AdHocCategory[] = ['weapon', 'armor', 'material-component', 'gear'];

  // ── Add-from-catalog UI state ──────────────────────────────────────────────
  showCatalog = false;
  catalogCategory: ShopCategory = 'WEAPON';
  catalogItems: ShopItem[] = [];
  catalogLoading = false;

  // ── Ad-hoc add UI state ─────────────────────────────────────────────────────
  showAdHoc = false;
  adHocName = '';
  adHocCategory: AdHocCategory = 'gear';
  adHocQty = 1;
  adHocWeight: number | null = null;
  adHocNotes = '';

  constructor(private catalogService: CatalogService) {}

  get items(): PcItem[] {
    return this.pc?.inventory ?? [];
  }

  get totalWeight(): number {
    return this.items.reduce((sum, i) => sum + (i.weight ?? 0) * (i.qty ?? 0), 0);
  }

  /** A tidy display label for an item's category. */
  categoryLabel(category: PcItem['category']): string {
    switch (category) {
      case 'weapon': return 'Weapon';
      case 'armor': return 'Armor';
      case 'material-component': return 'Material';
      case 'gear': return 'Gear';
      default: return category;
    }
  }

  // ── Mutations (emit a new PC; host persists) ────────────────────────────────

  /** Adjust a line's quantity; removing the line when it hits 0. */
  adjustQty(index: number, delta: number): void {
    const inventory = this.items.map(i => ({ ...i }));
    const line = inventory[index];
    if (!line) return;
    const next = (line.qty ?? 0) + delta;
    if (next <= 0) {
      inventory.splice(index, 1);
    } else {
      line.qty = next;
    }
    this.emit(inventory);
  }

  removeItem(index: number): void {
    const inventory = this.items.map(i => ({ ...i }));
    if (index < 0 || index >= inventory.length) return;
    inventory.splice(index, 1);
    this.emit(inventory);
  }

  toggleEquipped(index: number): void {
    const inventory = this.items.map(i => ({ ...i }));
    const line = inventory[index];
    if (!line) return;
    line.equipped = !line.equipped;
    this.emit(inventory);
  }

  // ── Add ad-hoc item ──────────────────────────────────────────────────────────

  openAdHoc(): void {
    this.showAdHoc = true;
    this.showCatalog = false;
    this.adHocName = '';
    this.adHocCategory = 'gear';
    this.adHocQty = 1;
    this.adHocWeight = null;
    this.adHocNotes = '';
  }

  cancelAdHoc(): void {
    this.showAdHoc = false;
  }

  addAdHoc(): void {
    const name = this.adHocName.trim();
    if (!name) return;
    const qty = Math.max(1, Math.floor(this.adHocQty || 1));
    const item: PcItem = { name, category: this.adHocCategory, qty };
    if (this.adHocWeight != null && !isNaN(this.adHocWeight)) item.weight = this.adHocWeight;
    const notes = this.adHocNotes.trim();
    if (notes) item.notes = notes;
    this.emit([...this.items.map(i => ({ ...i })), item]);
    this.showAdHoc = false;
  }

  // ── Add from catalog ─────────────────────────────────────────────────────────

  openCatalog(): void {
    this.showCatalog = true;
    this.showAdHoc = false;
    this.loadCatalog();
  }

  cancelCatalog(): void {
    this.showCatalog = false;
  }

  loadCatalog(): void {
    this.catalogLoading = true;
    this.catalogItems = [];
    this.catalogService.list(this.catalogCategory).subscribe({
      next: items => { this.catalogItems = items; this.catalogLoading = false; },
      error: () => { this.catalogItems = []; this.catalogLoading = false; },
    });
  }

  /** Add a catalog item to inventory, stacking qty onto a matching catalogKey line. */
  addFromCatalog(shopItem: ShopItem): void {
    const inventory = this.items.map(i => ({ ...i }));
    const existing = inventory.find(i => i.catalogKey && i.catalogKey === shopItem.itemKey);
    if (existing) {
      existing.qty = (existing.qty ?? 0) + 1;
    } else {
      inventory.push(this.toPcItem(shopItem));
    }
    this.emit(inventory);
  }

  /**
   * Map a catalog ShopItem to a denormalized PcItem — mirrors the backend
   * ShopService.newInventoryEntry (catalogKey, name, lowercased category, qty,
   * unitCostCp, weight, then the flattened category-specific details).
   */
  private toPcItem(shopItem: ShopItem): PcItem {
    const item: PcItem = {
      catalogKey: shopItem.itemKey,
      name: shopItem.name,
      category: this.categoryFromShop(shopItem.category),
      qty: 1,
      unitCostCp: shopItem.costCp,
    };
    if (shopItem.weight != null) item.weight = shopItem.weight;
    // Flatten the catalog details (damage, properties, armorClass, …) without
    // clobbering the fields set above.
    const details = shopItem.details ?? {};
    for (const key of Object.keys(details)) {
      if (!(key in item)) (item as any)[key] = details[key];
    }
    return item;
  }

  /** WEAPON → 'weapon', MATERIAL_COMPONENT → 'material-component', etc. */
  private categoryFromShop(category: string): PcItem['category'] {
    switch (category) {
      case 'WEAPON': return 'weapon';
      case 'ARMOR': return 'armor';
      case 'MATERIAL_COMPONENT': return 'material-component';
      default: return 'gear';
    }
  }

  private emit(inventory: PcItem[]): void {
    this.pcChange.emit({ ...this.pc, inventory });
  }
}
