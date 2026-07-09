import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import {
  SUPPLY_KEYS,
  SUPPLY_LABELS,
  SupplyKey,
  normalizeSupplies,
  supplyCapacity,
  supplyChargeLine,
  supplyCharges,
} from '../../../../utils/survival';

/** One pip in a supply track: filled = a serving in hand. */
interface SupplyPip {
  filled: boolean;
}

/** A single supply row as rendered: label, charges/capacity, and the pip track. */
interface SupplyRow {
  key: SupplyKey;
  label: string;
  charges: number;
  /** Total servings the containers can hold (containers × 5). */
  capacity: number;
  /** One entry per pip — the track IS the capacity. Empty when the capacity is
   *  too large to draw as pips (the numeric count is always shown too). */
  pips: SupplyPip[];
}

/** Beyond this many pips we stop drawing them and lean on the numeric count. */
const MAX_PIPS = 15;

/**
 * Travel supplies under the container model: ration boxes and waterskins are
 * containers (bought at the shop) whose count sets each track's capacity —
 * 5 servings per container. The charges live as `qty` on the rations/water
 * inventory lines (so the survival clock can auto-consume them); this pane
 * reads them and, when editable, lets the owner/DM spend or restock a serving.
 * Restock is capped at capacity — buy another container to raise it. Legacy
 * supply data is container-normalized on read and on the first edit. Shown
 * only in campaigns with the survivalConditions variant (gated by the host).
 */
@Component({
  selector: 'app-supplies-panel',
  templateUrl: './supplies-panel.component.html',
})
export class SuppliesPanelComponent {
  @Input() pc!: PC;
  /** Reveals the spend/restock steppers (own sheet, session, or DM cross-link). */
  @Input() editable = false;
  @Output() pcChange = new EventEmitter<PC>();

  get rows(): SupplyRow[] {
    // Read through the normalizer so legacy data displays under the container
    // model without waiting for a server write.
    const inventory = normalizeSupplies(this.pc?.inventory ?? []);
    return SUPPLY_KEYS.map(key => {
      const charges = supplyCharges(inventory, key);
      const capacity = supplyCapacity(inventory, key);
      const track = Math.max(capacity, charges); // odd data: still show every serving
      const pips = track <= MAX_PIPS
        ? Array.from({ length: track }, (_, i) => ({ filled: i < charges }))
        : [];
      return { key, label: SUPPLY_LABELS[key], charges, capacity, pips };
    });
  }

  /**
   * Spend (−1) or restock (+1) a serving. Restock stops at capacity (containers
   * × 5); spending floors at 0 and keeps the line (an empty box persists).
   */
  adjust(key: SupplyKey, delta: number): void {
    const inventory = normalizeSupplies(this.pc.inventory ?? []);
    const capacity = supplyCapacity(inventory, key);
    const line = inventory.find(i => i.catalogKey === key && i.status !== 'dropped');
    const current = Math.max(0, line?.qty ?? 0);
    const next = Math.min(capacity, Math.max(0, current + delta));
    if (next === current && line) return; // at a bound — nothing to persist
    if (line) {
      line.qty = next;
    } else {
      inventory.push(supplyChargeLine(key, next));
    }
    this.pcChange.emit({ ...this.pc, inventory });
  }
}
