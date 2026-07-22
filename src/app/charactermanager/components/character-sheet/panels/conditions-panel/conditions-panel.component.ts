import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { CONDITIONS_LIST } from '../../../../utils/character-math';

@Component({
    selector: 'app-conditions-panel',
    templateUrl: './conditions-panel.component.html',
    styleUrls: ['./conditions-panel.component.scss'],
    standalone: false
})
export class ConditionsPanelComponent {
  @Input() pc!: PC;
  /** DM cross-link view — only the DM awards or removes inspiration pips. */
  @Input() editable = false;
  /** The viewer owns this sheet — lets a player spend their own Heroic Inspiration. */
  @Input() ownSheet = false;
  /** An inspiration write is in flight (host-owned); disables the meter. */
  @Input() inspirationBusy = false;
  @Output() conditionToggled = new EventEmitter<string>();
  /** New exhaustion level (0–6) picked on the tracker; the host clamps and
   *  persists it through the same owner/DM path as a condition toggle. */
  @Output() exhaustionChanged = new EventEmitter<number>();
  /** New inspiration pip count (0–5) picked on the meter; the host persists it
   *  through the server-owned inspiration endpoint. */
  @Output() inspirationChanged = new EventEmitter<number>();
  /** Owner (or DM) spends the Heroic Inspiration badge. */
  @Output() inspirationUsed = new EventEmitter<void>();

  readonly conditions = CONDITIONS_LIST;

  /** Pip values for the 2024 PHB exhaustion tracker. */
  readonly exhaustionLevels = [1, 2, 3, 4, 5, 6] as const;

  /** Pip values for the Heroic Inspiration meter (filling it grants the badge). */
  readonly inspirationSlots = [1, 2, 3, 4, 5] as const;

  isActive(condition: string): boolean {
    return this.pc.conditions?.includes(condition) ?? false;
  }

  // ── Exhaustion (2024 PHB: 6 levels; −2 d20 Tests / −5 ft Speed per level;
  //    death at level 6) ─────────────────────────────────────────────────────

  /** Current level; a PC saved before the field existed reads as 0. */
  get exhaustion(): number {
    return this.pc.exhaustion ?? 0;
  }

  /** True at level 6 — the character is dead (drives the panel's death cue). */
  get exhaustionFatal(): boolean {
    return this.exhaustion >= 6;
  }

  /** Tooltip: the per-level rule plus the current cumulative effect. */
  get exhaustionTooltip(): string {
    const rule = '−2 to all d20 Tests and −5 ft Speed per level; death at level 6.';
    const lvl = this.exhaustion;
    if (lvl <= 0) return 'Exhaustion: ' + rule;
    if (lvl >= 6) return 'Exhaustion level 6 — the character dies. ' + rule;
    return 'Exhaustion level ' + lvl + ': −' + 2 * lvl + ' to all d20 Tests, −'
      + 5 * lvl + ' ft Speed. ' + rule;
  }

  /** Clicking pip N sets level N; re-clicking the current top pip steps back
   *  to N−1, so the tracker can always be walked back down to 0. */
  setExhaustion(level: number): void {
    const next = level === this.exhaustion ? level - 1 : level;
    this.exhaustionChanged.emit(Math.max(0, Math.min(6, next)));
  }

  // ── Heroic Inspiration meter (5 pips; filling it grants the badge) ──────────

  /** Current pip count; a PC saved before the field existed reads as 0. */
  get inspirationPips(): number {
    return this.pc.inspirationPips ?? 0;
  }

  /** Only the campaign's DM moves the meter (the sheet's own player never does). */
  get canAwardInspiration(): boolean {
    return this.editable;
  }

  /** The badge is spent by the character's player, or by the DM on their behalf. */
  get canUseInspiration(): boolean {
    return this.ownSheet || this.editable;
  }

  get inspirationTooltip(): string {
    const rule = 'Filling the meter grants Heroic Inspiration — reroll any d20 Test.';
    return this.pc.heroicInspiration
      ? 'Has Heroic Inspiration. ' + rule
      : this.inspirationPips + ' / 5 pips. ' + rule;
  }

  /** Same gesture as the exhaustion tracker: clicking pip N sets the meter to N,
   *  and re-clicking the current top pip steps back to N−1 so the DM can take a
   *  pip away. Filling it (5) is what grants the badge, server-side. */
  setInspiration(pips: number): void {
    const next = pips === this.inspirationPips ? pips - 1 : pips;
    this.inspirationChanged.emit(Math.max(0, Math.min(5, next)));
  }
}
