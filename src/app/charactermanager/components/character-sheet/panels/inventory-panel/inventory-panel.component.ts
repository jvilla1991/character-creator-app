import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC, PcItem } from '../../../../models/pc';
import { formatCp } from '../../../../models/shop';

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
  @Output() pcChange = new EventEmitter<PC>();

  readonly formatCp = formatCp;

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

  private emit(inventory: PcItem[]): void {
    this.pcChange.emit({ ...this.pc, inventory });
  }
}
