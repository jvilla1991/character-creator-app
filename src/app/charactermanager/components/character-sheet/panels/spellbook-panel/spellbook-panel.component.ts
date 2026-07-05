import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PC, PcSpell } from '../../../../models/pc';
import { castWarning, castableLevels } from '../../../../utils/spellcasting';

export interface SpellLevel {
  lvl: number;
  label: string;
  spells: NonNullable<PC['spells']>;
  slots: { max: number; used: number } | null;
  slotIndices: number[];
}

/** A cast the panel wants to make, resolved to a concrete slot level (0 = cantrip). */
export interface CastRequest {
  spellName: string;
  atLevel: number;
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
  /** Campaign runs strict material components: a missing costly component blocks the cast. */
  @Input() strictComponents = false;
  @Output() slotToggled = new EventEmitter<{ level: number; index: number }>();
  @Output() pcChange = new EventEmitter<PC>();
  /** A cast resolved to a slot level — the host decides local vs. live-session handling. */
  @Output() castRequested = new EventEmitter<CastRequest>();

  hasSpells   = false;
  spellsByLevel: SpellLevel[] = [];

  ngOnChanges(): void {
    // A new PC snapshot (including the one a cast produces) closes any open
    // picker/confirm so stale cast UI never survives a data change.
    this.pickerFor = null;
    this.pendingCast = null;
    this.blockedFor = null;

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

  // ── Casting ──────────────────────────────────────────────────────────────
  // Cast resolves to a slot level, warns (or, in strict campaigns, blocks)
  // when a costly material component is missing, then emits — the host owns
  // the actual state change (local reducer or live-session endpoint).

  /** Spell whose upcast level picker is open. */
  pickerFor: string | null = null;
  /** Cast awaiting a "component missing — cast anyway?" confirmation. */
  pendingCast: { spellName: string; atLevel: number; message: string } | null = null;
  /** Strict-campaign block message for a spell. */
  blockedFor: { spellName: string; message: string } | null = null;

  levelsFor(spell: PcSpell): number[] {
    return castableLevels(this.pc, spell);
  }

  canCast(spell: PcSpell): boolean {
    return spell.lvl === 0 || this.levelsFor(spell).length > 0;
  }

  castTitle(spell: PcSpell): string {
    return this.canCast(spell) ? `Cast ${spell.name}` : 'No slots available';
  }

  onCastClick(spell: PcSpell, event: Event): void {
    event.stopPropagation(); // don't toggle the detail expand
    this.pickerFor = null;
    this.pendingCast = null;
    this.blockedFor = null;

    const warning = castWarning(this.pc, spell);
    if (warning && this.strictComponents) {
      this.blockedFor = { spellName: spell.name, message: `${warning} — this campaign requires it to cast.` };
      return;
    }

    if (spell.lvl === 0) {
      this.resolveCast(spell.name, 0, warning);
      return;
    }
    const levels = this.levelsFor(spell);
    if (!levels.length) return; // button is disabled; belt and braces
    if (levels.length === 1) {
      this.resolveCast(spell.name, levels[0], warning);
    } else {
      this.pickerFor = spell.name;
    }
  }

  pickLevel(spell: PcSpell, atLevel: number, event: Event): void {
    event.stopPropagation();
    this.pickerFor = null;
    this.resolveCast(spell.name, atLevel, castWarning(this.pc, spell));
  }

  /** Emit the cast, or park it behind the missing-component confirmation. */
  private resolveCast(spellName: string, atLevel: number, warning: string | null): void {
    if (warning) {
      this.pendingCast = { spellName, atLevel, message: warning };
      return;
    }
    this.castRequested.emit({ spellName, atLevel });
  }

  confirmPendingCast(event: Event): void {
    event.stopPropagation();
    if (!this.pendingCast) return;
    const { spellName, atLevel } = this.pendingCast;
    this.pendingCast = null;
    this.castRequested.emit({ spellName, atLevel });
  }

  cancelPendingCast(event: Event): void {
    event.stopPropagation();
    this.pendingCast = null;
  }

  /** 1 → "1st", 2 → "2nd" … for the upcast level picker. */
  ordinal(lvl: number): string {
    const suffix = lvl === 1 ? 'st' : lvl === 2 ? 'nd' : lvl === 3 ? 'rd' : 'th';
    return `${lvl}${suffix}`;
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
