import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../models/pc';
import { hitDieFor, fmtMod } from '../../../utils/character-math';
import { DmEditRequest } from '../dm-edit-modal/dm-edit-request';

// 'AC' matches the backend's own diff vocabulary (PcActivityLogService.buildDmDiff);
// initiative/speed/proficiency bonus aren't in that diff at all (DM edits to them
// aren't auto-summarized server-side), so their labels are free text for the modal.
const VITAL_LABELS: Record<'ac' | 'init' | 'speed' | 'prof', string> = {
  ac: 'AC',
  init: 'initiative',
  speed: 'speed',
  prof: 'proficiency bonus',
};

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
  /** A DM clicked an intercepted vital — the parent opens the DM edit modal. */
  @Output() editRequested = new EventEmitter<DmEditRequest>();

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

  /** Pure builder: apply one HP field, keeping current within [0, max]. */
  private buildHp(field: 'cur' | 'max' | 'temp', value: number): PC {
    const hp = { cur: 0, max: 0, temp: 0, ...(this.pc.hp ?? {}) };
    hp[field] = value;
    if (field === 'max' || field === 'cur') {
      hp.cur = Math.max(0, Math.min(hp.cur, hp.max));
    }
    return { ...this.pc, hp };
  }

  /** Pure builder: apply a flat numeric vital (AC, initiative, speed, proficiency bonus). */
  private buildVital(field: 'ac' | 'init' | 'speed' | 'prof', value: number): PC {
    return { ...this.pc, [field]: value };
  }

  /** Edit one of the HP fields, keeping current within [0, max]. */
  setHp(field: 'cur' | 'max' | 'temp', value: number): void {
    this.pcChange.emit(this.buildHp(field, value));
  }

  /** Edit a flat numeric vital (AC, initiative, speed, proficiency bonus). */
  setVital(field: 'ac' | 'init' | 'speed' | 'prof', value: number): void {
    this.pcChange.emit(this.buildVital(field, value));
  }

  /** DM clicked (intercepted) an HP field — request the edit modal instead of the inline editor. */
  requestHp(field: 'cur' | 'max' | 'temp'): void {
    const label = field === 'cur' ? 'current HP' : field === 'max' ? 'max HP' : 'temporary HP';
    const value = field === 'cur' ? this.pc.hp?.cur ?? 0
      : field === 'max' ? this.pc.hp?.max ?? 0
      : this.pc.hp?.temp ?? 0;
    const min = 0;
    const max = field === 'cur' ? this.pc.hp?.max ?? null : null;
    this.editRequested.emit({ label, value, min, max, apply: v => this.buildHp(field, v) });
  }

  /** DM clicked (intercepted) a flat vital — request the edit modal instead of the inline editor. */
  requestVital(field: 'ac' | 'init' | 'speed' | 'prof'): void {
    const label = VITAL_LABELS[field];
    const value = (this.pc[field] as number | undefined) ?? null;
    const min = field === 'init' ? null : 0;
    this.editRequested.emit({ label, value, min, max: null, apply: v => this.buildVital(field, v) });
  }
}
