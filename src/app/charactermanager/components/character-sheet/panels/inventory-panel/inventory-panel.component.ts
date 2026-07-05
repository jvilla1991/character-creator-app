import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC, PcItem } from '../../../../models/pc';
import { formatCp } from '../../../../models/shop';
import { withRecomputedAc } from '../../../../utils/armor-math';
import {
  ENCUMBERED_PENALTY,
  isEncumbered,
  itemBulk,
  slotCapacity,
  usedSlots,
} from '../../../../utils/slot-inventory';

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
  @Output() pcChange = new EventEmitter<PC>();
  /** Player sells the item at this inventory index; the host owns the actual
   *  sell transaction (it needs the session/shop context this panel doesn't have). */
  @Output() sellRequested = new EventEmitter<number>();

  readonly formatCp = formatCp;

  get items(): PcItem[] {
    return this.pc?.inventory ?? [];
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
    if (this.shopCategory != null && this.categoryLabelFor(this.shopCategory) !== item.category) return false;
    return !!item.catalogKey || (item.unitCostCp != null && item.unitCostCp > 0);
  }

  sell(index: number): void {
    this.sellRequested.emit(index);
  }

  /** Mirrors the backend's ShopService#categoryLabel mapping. */
  private categoryLabelFor(backendCategory: string): string {
    switch (backendCategory) {
      case 'WEAPON': return 'weapon';
      case 'ARMOR': return 'armor';
      case 'MATERIAL_COMPONENT': return 'material-component';
      default: return backendCategory.toLowerCase();
    }
  }

  private emit(inventory: PcItem[]): void {
    // Equipping/unequipping (or losing) armor recomputes AC; unrelated edits
    // leave a hand-set AC untouched.
    this.pcChange.emit(withRecomputedAc({ ...this.pc, inventory }, this.pc.inventory));
  }
}
