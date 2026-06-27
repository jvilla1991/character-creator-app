import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PC } from '../../../../models/pc';

export interface SpellLevel {
  lvl: number;
  label: string;
  spells: NonNullable<PC['spells']>;
  slots: { max: number; used: number } | null;
  slotIndices: number[];
}

@Component({
  selector: 'app-spellbook-panel',
  templateUrl: './spellbook-panel.component.html',
  styleUrls: ['./spellbook-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpellbookPanelComponent implements OnChanges {
  @Input() pc!: PC;
  /** DM cross-link: replaces the slot pips with editable used/max numbers. */
  @Input() editable = false;
  @Output() slotToggled = new EventEmitter<{ level: number; index: number }>();
  @Output() pcChange = new EventEmitter<PC>();

  hasSpells   = false;
  spellsByLevel: SpellLevel[] = [];

  ngOnChanges(): void {
    const spells = this.pc.spells ?? [];
    this.hasSpells = spells.length > 0;

    if (!this.hasSpells) { this.spellsByLevel = []; return; }

    const map = new Map<number, NonNullable<PC['spells']>>();
    for (const s of spells) {
      if (!map.has(s.lvl)) map.set(s.lvl, []);
      map.get(s.lvl)!.push(s);
    }
    this.spellsByLevel = Array.from(map.keys())
      .sort((a, b) => a - b)
      .map(lvl => {
        const slots = this.pc.spellSlots?.[lvl] ?? null;
        return {
          lvl,
          label:       lvl === 0 ? 'Cantrips' : `Level ${lvl}`,
          spells:      map.get(lvl)!,
          slots,
          slotIndices: slots ? Array.from({ length: slots.max }, (_, i) => i) : [],
        };
      });
  }

  trackByLvl(_: number, row: SpellLevel): number { return row.lvl; }

  // ── Expand/collapse spell detail ─────────────────────────────────────────
  expandedSpells: Record<string, boolean> = {};

  toggleExpand(name: string): void {
    // New object reference required for OnPush change detection
    this.expandedSpells = { ...this.expandedSpells, [name]: !this.expandedSpells[name] };
  }

  // ── DM slot editing ──────────────────────────────────────────────────────
  // Edit a spell level's used/max slot counts, keeping used within [0, max].

  setSlot(level: number, field: 'used' | 'max', value: number): void {
    const slots = { ...(this.pc.spellSlots ?? {}) };
    const existing = slots[level] ?? { max: 0, used: 0 };
    const next = { ...existing, [field]: value };
    next.used = Math.max(0, Math.min(next.used, next.max));
    slots[level] = next;
    this.pcChange.emit({ ...this.pc, spellSlots: slots });
  }
}
