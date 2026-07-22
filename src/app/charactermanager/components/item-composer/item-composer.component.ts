import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { PcItem } from '../../models/pc';
import { CatalogItem, ShopCategory, categoryLabelFor, formatCp } from '../../models/shop';
import { ShopService } from '../../services/shop.service';
import { environment } from '../../../../environments/environment';
import { AuthoredItem } from './authored-item';

/**
 * The one shared "author an item" form: a two-tab composer (Catalog / Custom)
 * used everywhere a DM creates an item line — granting into an inventory,
 * prepping a curated loot list, or adding to a live session pool. The catalog
 * tab picks a real SRD item by category/search; the custom tab is free-hand
 * homebrew with the full attribute set (category, value in gold, weight, the
 * category stat — weapon damage or armor class — and notes). Emits a neutral
 * {@link AuthoredItem}; each host maps it onto its own wire call, so this
 * component owns no persistence. Demo mode has no catalog, so only the custom
 * tab is offered there.
 */
@Component({
    selector: 'app-item-composer',
    templateUrl: './item-composer.component.html',
    styleUrls: ['./item-composer.component.scss'],
    standalone: false
})
export class ItemComposerComponent implements OnInit {
  /** Label for the confirm button (hosts read differently: Add / Grant). */
  @Input() confirmLabel = 'Add';
  /** Whether a Cancel button renders (embedded always-open hosts hide it). */
  @Input() cancellable = true;

  /** The authored item — catalog pick (full CatalogItem) or custom line. */
  @Output() itemAuthored = new EventEmitter<AuthoredItem>();
  /** The Cancel button (only when `cancellable`). */
  @Output() cancelled = new EventEmitter<void>();

  constructor(private shopService: ShopService) {}

  readonly demoMode = environment.demoMode;
  readonly categories: ShopCategory[] = ['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR', 'TRANSPORT'];
  readonly categoryLabelFor = categoryLabelFor;
  readonly formatCp = formatCp;

  tab: 'catalog' | 'custom' = 'catalog';

  // Catalog tab
  catalogCategory: ShopCategory = 'WEAPON';
  catalogItems: CatalogItem[] = [];
  catalogSearch = '';
  catalogSelectedKey: string | null = null;
  catalogQty = 1;
  loadingCatalog = false;

  // Custom tab
  customName = '';
  customCategory: PcItem['category'] = 'gear';
  customQty = 1;
  customValueGp: number | null = null;   // value in gold (host converts to copper)
  customWeight: number | null = null;    // pounds (feeds bulk in slot campaigns)
  customDamage = '';                     // weapons, e.g. "1d8 slashing"
  customArmorClass = '';                 // armor, e.g. "14 + Dex modifier (max 2)"
  customNotes = '';

  ngOnInit(): void {
    if (this.demoMode) {
      this.tab = 'custom';               // the demo has no catalog to browse
    } else {
      this.loadCatalog();
    }
  }

  setTab(tab: 'catalog' | 'custom'): void {
    this.tab = tab;
    if (tab === 'catalog' && !this.catalogItems.length) this.loadCatalog();
  }

  loadCatalog(): void {
    this.loadingCatalog = true;
    this.catalogSelectedKey = null;
    this.shopService.getCatalog(this.catalogCategory).subscribe({
      next: items => { this.catalogItems = items; this.loadingCatalog = false; },
      error: () => { this.catalogItems = []; this.loadingCatalog = false; },
    });
  }

  get filteredCatalog(): CatalogItem[] {
    const q = this.catalogSearch.trim().toLowerCase();
    return q ? this.catalogItems.filter(i => i.name.toLowerCase().includes(q)) : this.catalogItems;
  }

  /** A tidy display label for an item's category (shared with the inventory list). */
  categoryLabel(category: PcItem['category']): string {
    switch (category) {
      case 'weapon': return 'Weapon';
      case 'armor': return 'Armor';
      case 'material-component': return 'Material';
      case 'gear': return 'Gear';
      case 'transport': return 'Transport';
      default: return category;
    }
  }

  /** Emit the selected catalog item (the full CatalogItem rides along). */
  confirmCatalog(): void {
    const item = this.catalogItems.find(i => i.itemKey === this.catalogSelectedKey);
    if (!item) return;
    const qty = Math.max(1, Math.floor(this.catalogQty || 1));
    this.itemAuthored.emit({ kind: 'catalog', item, qty });
    this.reset();
  }

  /**
   * Emit a free-hand custom line. Value/weight are included only when set and
   * non-negative; the category stat rides only with its category (weapon
   * damage / armor AC), mirroring what the backend accepts.
   */
  confirmCustom(): void {
    const name = this.customName.trim();
    if (!name) return;
    const authored: AuthoredItem = {
      kind: 'custom',
      name,
      category: this.customCategory,
      qty: Math.max(1, Math.floor(this.customQty || 1)),
    };
    if (this.customValueGp != null && this.customValueGp >= 0) authored.valueGp = this.customValueGp;
    if (this.customWeight != null && this.customWeight >= 0) authored.weight = this.customWeight;
    const damage = this.customDamage.trim();
    if (this.customCategory === 'weapon' && damage) authored.damage = damage;
    const armorClass = this.customArmorClass.trim();
    if (this.customCategory === 'armor' && armorClass) authored.armorClass = armorClass;
    const notes = this.customNotes.trim();
    if (notes) authored.notes = notes;
    this.itemAuthored.emit(authored);
    this.reset();
  }

  cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.tab = this.demoMode ? 'custom' : 'catalog';
    this.catalogSearch = '';
    this.catalogSelectedKey = null;
    this.catalogQty = 1;
    this.customName = '';
    this.customCategory = 'gear';
    this.customQty = 1;
    this.customValueGp = null;
    this.customWeight = null;
    this.customDamage = '';
    this.customArmorClass = '';
    this.customNotes = '';
  }
}
