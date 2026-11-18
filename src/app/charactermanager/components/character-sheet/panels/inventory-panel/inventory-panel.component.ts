import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';
import { PC, PcItem } from '../../../../models/pc';
import { categoryLabelFor, formatCp } from '../../../../models/shop';
import { AuthoredItem, pcItemFromAuthored } from '../../../item-composer/authored-item';
import { withRecomputedAc } from '../../../../utils/armor-math';
import { legacyEquipmentLines } from '../../../../utils/legacy-equipment';
import {
  ENCUMBERED_PENALTY,
  isEncumbered,
  itemBulk,
  slotCapacity,
  usedSlots,
} from '../../../../utils/slot-inventory';
import { isSupplyItem } from '../../../../utils/survival';
import { ItemComposerComponent } from '../../../item-composer/item-composer.component';
import { GiveItemModalComponent } from './give-item-modal.component';
import { InventoryTransferResult } from '../../../../services/inventory-transfer.service';

/**
 * Displays and manages everything a character carries: the structured
 * inventory (`pc.inventory` — shop purchases, DM grants, loot) followed by the
 * starting equipment the creation wizard wrote to the legacy `pc.weapons` /
 * `pc.gear` arrays, shown as ordinary lines (see legacy-equipment.ts). The
 * owner — or a DM via the cross-link — manages what is already owned:
 * equip/unequip, drop a whole stack (all of it at once), or discard a dropped
 * stack one unit at a time. The first such edit folds the legacy lines into
 * `pc.inventory` for good and empties the legacy arrays. The panel itself
 * never adds items; a DM grant goes out through `itemGranted`.
 *
 * Mirrors {@link CoinPurseComponent}: emits a modified PC via `pcChange` when
 * `editable`; read-only otherwise (e.g. the in-session embed). `equipped` is a
 * display flag only — it does not recompute AC or any derived stat.
 */
/** How long a Give waits for the starting-gear fold-in save before giving up. */
const PENDING_GIVE_MS = 10_000;

@Component({
    selector: 'app-inventory-panel',
    templateUrl: './inventory-panel.component.html',
    styleUrls: ['./inventory-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ItemComposerComponent, GiveItemModalComponent]
})
export class InventoryPanelComponent {
  /** A setter so a Give that had to wait for the starting-gear fold-in can
   *  resume the moment the saved character comes back (see openGive). */
  @Input()
  get pc(): PC { return this._pc; }
  set pc(value: PC) {
    this._pc = value;
    this.resumePendingGive();
  }
  private _pc!: PC;
  /** When true, shows the manage controls (equip / reduce qty / drop) and emits pcChange. */
  @Input() editable = false;
  @Input() giveAllowed = false;
  readonly inventoryTransferred = output<InventoryTransferResult>();
  giveSelection: { pc: PC; index: number } | null = null;
  transferMessage = '';

  openGive(item: PcItem): void {
    if (!this.editable || !this.giveAllowed || item.status === 'dropped') return;
    const index = (this.pc.inventory ?? []).indexOf(item);
    if (index < 0) {
      // A starting-gear line is not in pc.inventory yet, and the transfer
      // endpoint addresses an item by its position there. Fold the legacy
      // lines in first (an ordinary save through pcChange); the dialog opens
      // when the saved character comes back — see resumePendingGive.
      const at = this.items.indexOf(item);
      if (at < 0) return;
      this.transferMessage = '';
      this.pendingGive = { at, name: item.name, until: Date.now() + PENDING_GIVE_MS };
      this.emit(this.items.map(i => ({ ...i })));
      return;
    }
    this.transferMessage = '';
    this.giveSelection = { pc: structuredClone(this.pc), index };
  }

  /** A Give clicked on a starting-gear line, waiting for the fold-in save:
   *  where the line sits in `items`, its name (a sanity check), and a deadline
   *  so a save that failed cannot pop the dialog open much later. */
  private pendingGive: { at: number; name: string; until: number } | null = null;

  private resumePendingGive(): void {
    const pending = this.pendingGive;
    if (!pending) return;
    if (Date.now() > pending.until) { this.pendingGive = null; return; }
    // Still unfolded: this is some other update (a session poll, say) that
    // arrived before the save did. Keep waiting.
    if (this._pc?.weapons?.length || this._pc?.gear?.length) return;
    this.pendingGive = null;
    const line = this.items[pending.at];
    if (line && line.name === pending.name) this.openGive(line);
  }

  onTransferred(result: InventoryTransferResult): void {
    this.giveSelection = null;
    this.transferMessage = 'Item transferred.';
    this.inventoryTransferred.emit(result);
  }
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
  readonly pcChange = output<PC>();
  /** Player sells the item at this inventory index; the host owns the actual
   *  sell transaction (it needs the session/shop context this panel doesn't have). */
  readonly sellRequested = output<number>();
  /** DM grants this (already-denormalized) item; emitted as a bare payload so the
   *  host can route it through GrantService's refetch-merge-save rather than
   *  PUTting this panel's possibly-stale PC copy. */
  readonly itemGranted = output<PcItem>();

  readonly formatCp = formatCp;

  /** The lines shown/managed here: everything in `pc.inventory` except travel
   *  supplies (the Supplies pane owns those), FOLLOWED BY the legacy starting
   *  equipment as inventory lines. Legacy lines go last so the position of every
   *  real inventory line is the same as before they were listed. Index-based
   *  edits below run over this merged list and re-merge the supply lines in
   *  {@link emit}, so supplies are never dropped.
   *
   *  Memoized on the three source arrays: the legacy lines are built objects,
   *  and the template tracks rows by identity, so a fresh list per read would
   *  re-create those rows on every change-detection pass. Keyed on the arrays
   *  rather than the PC because hosts hand over a new PC object for unrelated
   *  changes (HP, conditions) while the arrays themselves stay the same. */
  get items(): PcItem[] {
    const pc = this.pc;
    const src = this.itemsSource;
    if (!src || src.inventory !== pc?.inventory || src.weapons !== pc?.weapons || src.gear !== pc?.gear) {
      this.itemsSource = { inventory: pc?.inventory, weapons: pc?.weapons, gear: pc?.gear };
      this.itemsMemo = [
        ...(pc?.inventory ?? []).filter(i => !isSupplyItem(i)),
        ...(pc ? legacyEquipmentLines(pc) : []),
      ];
    }
    return this.itemsMemo;
  }
  private itemsSource: Pick<PC, 'inventory' | 'weapons' | 'gear'> | null = null;
  private itemsMemo: PcItem[] = [];

  get totalWeight(): number {
    return this.items.reduce((sum, i) => sum + (i.weight ?? 0) * (i.qty ?? 0), 0);
  }

  // ── Slot-based inventory (Darker Dungeons variant) ─────────────────────────

  readonly encumberedPenalty = ENCUMBERED_PENALTY;

  get usedSlots(): number {
    // Full inventory, not `items` — supplies are hidden from the list but their
    // containers (ration boxes / waterskins, 1 bulk each) still count toward slots.
    return usedSlots(this.pc?.inventory ?? []);
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
      case 'transport': return 'Transport';
      case 'treasure': return 'Treasure';
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

  /**
   * Second click (only available once dropped): destroy ONE unit of the stack.
   * Dropping is all-or-nothing — the whole stack leaves your hands at once —
   * but discarding is per-unit, so a dropped stack can be whittled down (and
   * the remainder picked back up) instead of being annihilated by one click.
   * The line itself is removed only when the last unit goes.
   */
  discardItem(index: number): void {
    const inventory = this.items.map(i => ({ ...i }));
    if (index < 0 || index >= inventory.length) return;
    const line = inventory[index];
    const qty = line.qty ?? 1;
    if (qty > 1) line.qty = qty - 1;
    else inventory.splice(index, 1);
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
    // The managed list already carries the legacy starting equipment as real
    // lines, so the legacy arrays are emptied in the same save — otherwise the
    // next read would list (and then persist) those items a second time.
    const updated: PC = { ...this.pc, inventory: merged, weapons: [], gear: [] };
    // Equipping/unequipping (or losing) armor recomputes AC; unrelated edits
    // leave a hand-set AC untouched. The pre-edit pc.inventory is the right
    // baseline even though it lacks the legacy lines: only equipped armor lines
    // with an armorClass formula count, and a legacy line never has one.
    this.pcChange.emit(withRecomputedAc(updated, this.pc.inventory));
  }

  // ── DM grant form ──────────────────────────────────────────────────────────
  // The shared ItemComposerComponent authors the item (catalog pick or custom
  // homebrew with the full attribute set); this panel only maps its payload
  // onto the unchanged `itemGranted: PcItem` contract via pcItemFromAuthored —
  // the same denormalization every catalog→inventory path uses. No coins are
  // deducted — it's a grant.

  grantFormOpen = false;

  openGrantForm(): void {
    this.grantFormOpen = true;
  }

  onAuthored(item: AuthoredItem): void {
    this.itemGranted.emit(pcItemFromAuthored(item));
    this.grantFormOpen = false;
  }

  onGrantCancelled(): void {
    this.grantFormOpen = false;
  }
}
