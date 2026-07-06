import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import {
  SUPPLY_KEYS,
  SUPPLY_LABELS,
  SUPPLY_FREE_CHARGES,
  SupplyKey,
  SURVIVAL_STARTING_CHARGES,
} from '../../../../utils/survival';

/** One pip in a supply track: filled = a serving in hand; extra = a bought
 *  serving beyond the free box/skin, so it costs an inventory slot. */
interface SupplyPip {
  filled: boolean;
  extra: boolean;
}

/** A single supply row as rendered: label, remaining charges, and the pip track. */
interface SupplyRow {
  key: SupplyKey;
  label: string;
  charges: number;
  /** Servings beyond the free box/skin — each costs one inventory slot. */
  slots: number;
  /** One entry per pip. Empty when the count is too large to draw as pips
   *  (the numeric count is always shown too). */
  pips: SupplyPip[];
}

/** Beyond this many charges we stop drawing pips and lean on the numeric count. */
const MAX_PIPS = 12;

/**
 * Travel supplies as charges — the Ration box and Water skin, shown like spell
 * slots. The charges live as `qty` on the rations/waterskin inventory lines (so
 * the survival clock can auto-consume them); this pane just reads them and,
 * when editable, lets the owner/DM spend or restock a serving. Display-only
 * otherwise — matching how players see spell slots. Shown only in campaigns
 * with the survivalConditions variant (gated by the host).
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

  private chargesFor(key: SupplyKey): number {
    const line = (this.pc?.inventory ?? []).find(i => i.catalogKey === key && i.status !== 'dropped');
    return Math.max(0, line?.qty ?? 0);
  }

  get rows(): SupplyRow[] {
    return SUPPLY_KEYS.map(key => {
      const charges = this.chargesFor(key);
      const capacity = Math.max(charges, SURVIVAL_STARTING_CHARGES);
      const pips = capacity <= MAX_PIPS
        ? Array.from({ length: capacity }, (_, i) => ({ filled: i < charges, extra: i >= SUPPLY_FREE_CHARGES }))
        : [];
      return {
        key,
        label: SUPPLY_LABELS[key],
        charges,
        slots: Math.max(0, charges - SUPPLY_FREE_CHARGES),
        pips,
      };
    });
  }

  /** Spend (−1) or restock (+1) a serving. Creates the line on the first +. */
  adjust(key: SupplyKey, delta: number): void {
    const inventory = (this.pc.inventory ?? []).map(i => ({ ...i }));
    const line = inventory.find(i => i.catalogKey === key && i.status !== 'dropped');
    const next = Math.max(0, (line?.qty ?? 0) + delta);
    if (line) {
      line.qty = next;
    } else {
      if (next === 0) return;
      inventory.push({ catalogKey: key, name: SUPPLY_LABELS[key], category: 'gear', qty: next });
    }
    this.pcChange.emit({ ...this.pc, inventory });
  }
}
