import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../models/pc';
import { hitDieFor, fmtMod } from '../../../utils/character-math';

@Component({
  selector: 'app-vitals-strip',
  templateUrl: './vitals-strip.component.html',
  styleUrls: ['./vitals-strip.component.scss']
})
export class VitalsStripComponent {
  @Input() pc!: PC;
  /** DM cross-link: turns the vitals into click-to-edit numbers. */
  @Input() editable = false;
  /** Emits the full updated PC for the parent to persist. */
  @Output() pcChange = new EventEmitter<PC>();

  get hpPct(): number {
    if (!this.pc.hp) return 0;
    return Math.max(0, Math.min(100, (this.pc.hp.cur / this.pc.hp.max) * 100));
  }

  get hitDie(): number { return hitDieFor(this.pc.clazz); }

  /** Names of the currently-equipped armor/shield lines, or "unarmored" when
   *  nothing is worn — the caption shown under the AC value. */
  get armorLabel(): string {
    const worn = (this.pc.inventory ?? [])
      .filter(i => i.category === 'armor' && i.equipped && i.status !== 'dropped')
      .map(i => i.name);
    return worn.length ? worn.join(' & ') : 'unarmored';
  }

  fmtMod(n: number): string { return fmtMod(n); }

  /** Edit one of the HP fields, keeping current within [0, max]. */
  setHp(field: 'cur' | 'max' | 'temp', value: number): void {
    const hp = { cur: 0, max: 0, temp: 0, ...(this.pc.hp ?? {}) };
    hp[field] = value;
    if (field === 'max' || field === 'cur') {
      hp.cur = Math.max(0, Math.min(hp.cur, hp.max));
    }
    this.pcChange.emit({ ...this.pc, hp });
  }

  /** Edit a flat numeric vital (AC, initiative, speed, proficiency bonus). */
  setVital(field: 'ac' | 'init' | 'speed' | 'prof', value: number): void {
    this.pcChange.emit({ ...this.pc, [field]: value });
  }
}
