import { ChangeDetectionStrategy, Component, OnInit, output, input, signal } from '@angular/core';
import { PcItem } from '../../models/pc';
import { CatalogItem, ShopCategory, categoryLabelFor, formatCp } from '../../models/shop';
import { ShopService } from '../../services/shop.service';
import { environment } from '../../../../environments/environment';
import { AuthoredItem } from './authored-item';
import { FormsModule } from '@angular/forms';
import { JsonImportComponent, JsonImportConfirmed } from '../json-import/json-import.component';

/**
 * The one shared "author an item" form: a tabbed composer (Catalog / Custom,
 * plus an opt-in JSON tab) used everywhere a DM creates an item line —
 * granting into an inventory, prepping a curated loot list, or adding to a
 * live session pool. The catalog tab picks a real SRD item by category/search;
 * the custom tab is free-hand homebrew with the full attribute set (category,
 * value in gold, weight, the category stat — weapon damage or armor class —
 * and notes). Emits a neutral {@link AuthoredItem}; each host maps it onto its
 * own wire call, so this component owns no persistence. Demo mode has no
 * catalog, so the catalog tab is not offered there.
 *
 * The JSON tab (hosts opt in with `jsonTab`) takes pasted item lines in the
 * curated-loot import format — the shared JsonImportComponent checks them as
 * they are pasted — and emits them together through `itemsAuthored`, so a
 * host can save the whole paste in one go.
 */
@Component({
    selector: 'app-item-composer',
    templateUrl: './item-composer.component.html',
    styleUrls: ['./item-composer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, JsonImportComponent]
})
export class ItemComposerComponent implements OnInit {
  /** Label for the confirm button (hosts read differently: Add / Grant). */
  readonly confirmLabel = input('Add');
  /** Whether a Cancel button renders (embedded always-open hosts hide it). */
  readonly cancellable = input(true);

  /** Whether the JSON tab is offered (paste many item lines at once). A host
   *  that turns it on must listen to `itemsAuthored`. */
  readonly jsonTab = input(false);

  /** The authored item — catalog pick (full CatalogItem) or custom line. */
  readonly itemAuthored = output<AuthoredItem>();
  /** Every line of a JSON paste, in the order written — emitted once, as one
   *  batch, so the host can save them together instead of racing N saves. */
  readonly itemsAuthored = output<AuthoredItem[]>();
  /** The Cancel button (only when `cancellable`). */
  readonly cancelled = output<void>();

  constructor(private shopService: ShopService) {}

  readonly demoMode = environment.demoMode;
  readonly categories: ShopCategory[] = ['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR', 'TRANSPORT'];
  readonly categoryLabelFor = categoryLabelFor;
  readonly formatCp = formatCp;

  tab: 'catalog' | 'custom' | 'json' = 'catalog';

  // Catalog tab
  catalogCategory: ShopCategory = 'WEAPON';
  // Signals: written from the catalog HTTP callback, which never marks an OnPush view.
  readonly catalogItems = signal<CatalogItem[]>([]);
  catalogSearch = '';
  catalogSelectedKey: string | null = null;
  catalogQty = 1;
  readonly loadingCatalog = signal(false);

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

  setTab(tab: 'catalog' | 'custom' | 'json'): void {
    this.tab = tab;
    if (tab === 'catalog' && !this.catalogItems().length) this.loadCatalog();
  }

  loadCatalog(): void {
    this.loadingCatalog.set(true);
    this.catalogSelectedKey = null;
    this.shopService.getCatalog(this.catalogCategory).subscribe({
      next: items => { this.catalogItems.set(items); this.loadingCatalog.set(false); },
      error: () => { this.catalogItems.set([]); this.loadingCatalog.set(false); },
    });
  }

  get filteredCatalog(): CatalogItem[] {
    const q = this.catalogSearch.trim().toLowerCase();
    return q ? this.catalogItems().filter(i => i.name.toLowerCase().includes(q)) : this.catalogItems();
  }

  /** A tidy display label for an item's category (shared with the inventory list). */
  categoryLabel(category: PcItem['category']): string {
    switch (category) {
      case 'weapon': return 'Weapon';
      case 'armor': return 'Armor';
      case 'material-component': return 'Material';
      case 'gear': return 'Gear';
      case 'transport': return 'Transport';
      case 'treasure': return 'Treasure';
      default: return category;
    }
  }

  /** Emit the selected catalog item (the full CatalogItem rides along). */
  confirmCatalog(): void {
    const item = this.catalogItems().find(i => i.itemKey === this.catalogSelectedKey);
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

  /**
   * The JSON tab's paste passed its check: emit every line as one batch, in
   * the order written. The paste box has already looked each catalog "key" up
   * (the lookup the Catalog tab does by hand) and hands the items over, so a
   * key that is not there cannot reach this point — it is skipped defensively.
   */
  onJsonConfirmed(confirmed: JsonImportConfirmed): void {
    const authored: AuthoredItem[] = [];
    for (const line of confirmed.loot?.items ?? []) {
      const qty = Math.max(1, Math.floor(line.qty ?? 1));
      if (line.key) {
        const item = confirmed.catalog.get(line.key);
        if (item) authored.push({ kind: 'catalog', item, qty });
        continue;
      }
      const category = line.category ?? 'gear';
      const custom: AuthoredItem = { kind: 'custom', name: line.name ?? '', category, qty };
      if (line.valueGp != null) custom.valueGp = line.valueGp;
      if (line.weight != null) custom.weight = line.weight;
      if (category === 'weapon' && line.damage) custom.damage = line.damage;
      if (category === 'armor' && line.armorClass) custom.armorClass = line.armorClass;
      if (line.notes) custom.notes = line.notes;
      authored.push(custom);
    }
    if (!authored.length) return;
    this.itemsAuthored.emit(authored);
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
