import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC, PcItem } from '../../../../models/pc';
import { CatalogItem, ShopCategory, categoryLabelFor, formatCp } from '../../../../models/shop';
import { ShopService } from '../../../../services/shop.service';
import { environment } from '../../../../../../environments/environment';
import { withRecomputedAc } from '../../../../utils/armor-math';
import {
  ENCUMBERED_PENALTY,
  isEncumbered,
  itemBulk,
  slotCapacity,
  usedSlots,
} from '../../../../utils/slot-inventory';
import { isSupplyItem } from '../../../../utils/survival';

/**
 * Displays and manages a character's structured inventory (`pc.inventory`).
 * Items are acquired only by buying them at a session shop (which writes them
 * through to `pc.inventory`); this panel lets the owner — or a DM via the
 * cross-link — manage what they already own: equip/unequip, reduce quantity
 * (use one / drop one), or drop a whole stack. It never adds new items.
 *
 * Mirrors {@link CoinPurseComponent}: emits a modified PC via `pcChange` when
 * `editable`; read-only otherwise (e.g. the in-session embed). `equipped` is a
 * display flag only — it does not recompute AC or any derived stat.
 */
@Component({
  selector: 'app-inventory-panel',
  templateUrl: './inventory-panel.component.html',
  styleUrls: ['./inventory-panel.component.scss']
})
export class InventoryPanelComponent {
  @Input() pc!: PC;
  /** When true, shows the manage controls (equip / reduce qty / drop) and emits pcChange. */
  @Input() editable = false;
  /** True while a shop is open and this PC is targeted — reveals the Sell button. */
  @Input() shopOpenForMe = false;
  /** The open shop's category (backend format, e.g. 'WEAPON'), or null for a
   *  curated shop (buys any category) or when no shop is open. */
  @Input() shopCategory: string | null = null;
  /** True when the PC's campaign runs Darker Dungeons slot-based inventory —
   *  the header shows slots used vs capacity and an Encumbered badge instead
   *  of raw weight, and each line shows its bulk. Display-only: the encumbered
   *  state is computed live and never written into pc.conditions. */
  @Input() slotInventory = false;
  /** DM cross-link: reveals the "Grant item" control. Distinct from `editable`
   *  (which also drives the in-session sell/equip embed). */
  @Input() addAllowed = false;
  @Output() pcChange = new EventEmitter<PC>();
  /** Player sells the item at this inventory index; the host owns the actual
   *  sell transaction (it needs the session/shop context this panel doesn't have). */
  @Output() sellRequested = new EventEmitter<number>();
  /** DM grants this (already-denormalized) item; emitted as a bare payload so the
   *  host can route it through GrantService's refetch-merge-save rather than
   *  PUTting this panel's possibly-stale PC copy. */
  @Output() itemGranted = new EventEmitter<PcItem>();

  constructor(private shopService: ShopService) {}

  readonly formatCp = formatCp;

  /** The lines shown/managed here: everything except travel supplies, which the
   *  Supplies pane owns. Index-based edits below run over this filtered list and
   *  re-merge the supply lines in {@link emit}, so supplies are never dropped. */
  get items(): PcItem[] {
    return (this.pc?.inventory ?? []).filter(i => !isSupplyItem(i));
  }

  get totalWeight(): number {
    return this.items.reduce((sum, i) => sum + (i.weight ?? 0) * (i.qty ?? 0), 0);
  }

  // ── Slot-based inventory (Darker Dungeons variant) ─────────────────────────

  readonly encumberedPenalty = ENCUMBERED_PENALTY;

  get usedSlots(): number {
    return usedSlots(this.items);
  }

  get slotCapacity(): number {
    return slotCapacity(this.pc);
  }

  get encumbered(): boolean {
    return isEncumbered(this.pc);
  }

  bulkFor(item: PcItem): number {
    return itemBulk(item);
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

  // ── Manage owned items (emit a new PC; host persists via updatePC/updatePCAsDm) ──

  /** First click: flag the whole line as dropped (kept, shown, no longer "owned"). */
  dropItem(index: number): void {
    const inventory = this.items.map(i => ({ ...i }));
    const line = inventory[index];
    if (!line) return;
    line.status = 'dropped';
    this.emit(inventory);
  }

  /** Second click (only available once dropped): remove the line for good. */
  discardItem(index: number): void {
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

  /**
   * Whether this line can be sold to the open shop right now — best-effort
   * client-side gating (mirrors the server's rules) so a doomed sell request
   * never gets sent. The server is still authoritative.
   */
  canSell(item: PcItem): boolean {
    if (!this.shopOpenForMe) return false;
    if (item.status === 'dropped') return false;
    if (this.shopCategory != null && categoryLabelFor(this.shopCategory) !== item.category) return false;
    return !!item.catalogKey || (item.unitCostCp != null && item.unitCostCp > 0);
  }

  sell(index: number): void {
    this.sellRequested.emit(index);
  }

  private emit(inventory: PcItem[]): void {
    // `inventory` is the managed (non-supply) list; re-append the supply lines
    // the Supplies pane owns so an inventory edit never discards them.
    const supplies = (this.pc.inventory ?? []).filter(isSupplyItem);
    const merged = [...inventory, ...supplies];
    // Equipping/unequipping (or losing) armor recomputes AC; unrelated edits
    // leave a hand-set AC untouched.
    this.pcChange.emit(withRecomputedAc({ ...this.pc, inventory: merged }, this.pc.inventory));
  }

  // ── DM grant form ──────────────────────────────────────────────────────────
  // Two ways to grant: pick a real SRD catalog item (denormalized exactly like a
  // shop purchase, but with no coin deduction), or type an ad-hoc homebrew line.
  // Demo mode has no catalog, so only the custom tab is offered there.

  readonly demoMode = environment.demoMode;
  readonly grantCategories: ShopCategory[] = ['WEAPON', 'ARMOR', 'MATERIAL_COMPONENT', 'GEAR'];
  readonly categoryLabelFor = categoryLabelFor;

  grantFormOpen = false;
  grantTab: 'catalog' | 'custom' = 'catalog';

  // Catalog tab
  grantCategory: ShopCategory = 'WEAPON';
  catalogItems: CatalogItem[] = [];
  catalogSearch = '';
  catalogSelectedKey: string | null = null;
  catalogQty = 1;
  loadingCatalog = false;

  // Custom tab
  customName = '';
  customCategory: PcItem['category'] = 'gear';
  customQty = 1;

  openGrantForm(): void {
    this.grantFormOpen = true;
    this.grantTab = this.demoMode ? 'custom' : 'catalog';
    if (!this.demoMode) this.loadCatalog();
  }

  cancelGrant(): void {
    this.resetGrantForm();
  }

  setGrantTab(tab: 'catalog' | 'custom'): void {
    this.grantTab = tab;
    if (tab === 'catalog' && !this.catalogItems.length) this.loadCatalog();
  }

  loadCatalog(): void {
    this.loadingCatalog = true;
    this.catalogSelectedKey = null;
    this.shopService.getCatalog(this.grantCategory).subscribe({
      next: items => { this.catalogItems = items; this.loadingCatalog = false; },
      error: () => { this.catalogItems = []; this.loadingCatalog = false; },
    });
  }

  get filteredCatalog(): CatalogItem[] {
    const q = this.catalogSearch.trim().toLowerCase();
    return q ? this.catalogItems.filter(i => i.name.toLowerCase().includes(q)) : this.catalogItems;
  }

  /** Grant the selected catalog item, denormalized like the backend's
   *  ShopService#newInventoryEntry (base fields first, then the catalog details
   *  flattened in without overwriting them). No coins are deducted — it's a grant. */
  grantCatalogItem(): void {
    const item = this.catalogItems.find(i => i.itemKey === this.catalogSelectedKey);
    if (!item) return;
    const qty = Math.max(1, Math.floor(this.catalogQty || 1));
    const entry: PcItem = {
      catalogKey: item.itemKey,
      name: item.name,
      category: categoryLabelFor(item.category),
      qty,
      unitCostCp: item.costCp, // catalog price snapshot; no coins are deducted (grant)
      ...(item.weight != null ? { weight: item.weight } : {}),
      bulk: item.bulk,
    };
    for (const [k, v] of Object.entries(item.details ?? {})) {
      if (!(k in entry)) (entry as any)[k] = v; // putIfAbsent — base fields win
    }
    this.itemGranted.emit(entry);
    this.resetGrantForm();
  }

  /** Grant an ad-hoc homebrew line (no catalog key, cost, or bulk). */
  grantCustomItem(): void {
    const name = this.customName.trim();
    if (!name) return;
    this.itemGranted.emit({
      name,
      category: this.customCategory,
      qty: Math.max(1, Math.floor(this.customQty || 1)),
    });
    this.resetGrantForm();
  }

  private resetGrantForm(): void {
    this.grantFormOpen = false;
    this.grantTab = 'catalog';
    this.grantCategory = 'WEAPON';
    this.catalogItems = [];
    this.catalogSearch = '';
    this.catalogSelectedKey = null;
    this.catalogQty = 1;
    this.customName = '';
    this.customCategory = 'gear';
    this.customQty = 1;
  }
}
