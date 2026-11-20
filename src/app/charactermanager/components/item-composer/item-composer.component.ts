import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, output, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, forkJoin } from 'rxjs';
import { PcItem } from '../../models/pc';
import { LootImportPayload, parseLootImportPayload } from '../../models/loot';
import { CatalogItem, ShopCategory, categoryLabelFor, formatCp } from '../../models/shop';
import { ShopService } from '../../services/shop.service';
import { environment } from '../../../../environments/environment';
import { AuthoredItem } from './authored-item';
import { FormsModule } from '@angular/forms';

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
 * curated-loot import format and emits them together through `itemsAuthored`,
 * so a host can save the whole paste in one go.
 */
@Component({
    selector: 'app-item-composer',
    templateUrl: './item-composer.component.html',
    styleUrls: ['./item-composer.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
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

  // JSON tab — the same line format as the curated-loot "Import JSON" box.
  jsonDraft = '';
  // Signals: written from the catalog lookup callback (see catalogItems above).
  readonly jsonError = signal<string | null>(null);
  readonly jsonBusy = signal(false);
  private jsonLookup?: Subscription;
  private readonly destroyRef = inject(DestroyRef);

  readonly jsonExample = JSON.stringify(
    { items: [{ key: 'longsword' }, { key: 'rations', qty: 10 },
              { name: 'Flametongue', category: 'weapon', valueGp: 5000, weight: 3,
                damage: '1d8 slashing + 2d6 fire', notes: 'Ignites on command.' }] }, null, 2);

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
   * Read the pasted JSON and emit every line as one batch. The text is checked
   * with the curated-loot parser, so the two boxes accept the same lines. A
   * "key" line is looked up in the catalog here (the lookup the Catalog tab
   * does by hand); one unknown key stops the whole paste and nothing is
   * emitted. The draft is kept on any error so it can be fixed and retried.
   */
  confirmJson(): void {
    if (this.jsonBusy()) return;
    const { payload, error } = parseLootImportPayload(this.jsonDraft);
    if (error || !payload) {
      this.jsonError.set(error ?? 'Could not read that JSON.');
      return;
    }
    if (payload.coinGp) {
      this.jsonError.set('"coinGp" is for loot lists — remove it, items only here.');
      return;
    }
    const lines = payload.items;
    if (!lines.length) {
      this.jsonError.set('The "items" array is empty — add at least one item.');
      return;
    }
    this.jsonError.set(null);
    if (!lines.some(l => l.key)) {
      this.emitJson(lines, new Map());
      return;
    }
    if (this.demoMode) {
      this.jsonError.set('The demo has no catalog — use "name" items instead of "key".');
      return;
    }
    // Catalog keys can come from any category, so fetch them all once.
    this.jsonBusy.set(true);
    this.jsonLookup = forkJoin(this.categories.map(c => this.shopService.getCatalog(c)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lists => {
          this.jsonBusy.set(false);
          const catalog = new Map<string, CatalogItem>();
          for (const item of lists.flat()) catalog.set(item.itemKey, item);
          const unknown = [...new Set(lines.filter(l => l.key && !catalog.has(l.key)).map(l => l.key))];
          if (unknown.length) {
            this.jsonError.set(`Unknown catalog keys: ${unknown.join(', ')}`);
            return;
          }
          this.emitJson(lines, catalog);
        },
        error: () => {
          this.jsonBusy.set(false);
          this.jsonError.set('Could not load the catalog to look up the keys. Try again.');
        },
      });
  }

  private emitJson(lines: LootImportPayload['items'], catalog: Map<string, CatalogItem>): void {
    const authored = lines.map((line): AuthoredItem => {
      const qty = Math.max(1, Math.floor(line.qty ?? 1));
      if (line.key) return { kind: 'catalog', item: catalog.get(line.key)!, qty };
      const category = line.category ?? 'gear';
      const custom: AuthoredItem = { kind: 'custom', name: line.name!, category, qty };
      if (line.valueGp != null) custom.valueGp = line.valueGp;
      if (line.weight != null) custom.weight = line.weight;
      if (category === 'weapon' && line.damage) custom.damage = line.damage;
      if (category === 'armor' && line.armorClass) custom.armorClass = line.armorClass;
      if (line.notes) custom.notes = line.notes;
      return custom;
    });
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
    // A Cancel mid-lookup must not grant anything when the catalog arrives.
    this.jsonLookup?.unsubscribe();
    this.jsonBusy.set(false);
    this.jsonDraft = '';
    this.jsonError.set(null);
  }
}
