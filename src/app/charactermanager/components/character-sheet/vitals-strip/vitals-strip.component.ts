import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';
import { PC } from '../../../models/pc';
import { AdjustableStat, adjustmentsFor, removalLabel } from '../../../models/stat-adjustment';
import { breakdownOf, describeAdjustment } from '../../../utils/stat-breakdown';
import { hitDieFor } from '../../../utils/character-math';
import { DmEditRequest } from '../dm-edit-modal/dm-edit-request';
import { EditableNumberComponent } from '../editable-number/editable-number.component';
import { ModifierPipe } from '../../../pipes/modifier.pipe';

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
    styleUrls: ['./vitals-strip.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EditableNumberComponent, ModifierPipe]
})
export class VitalsStripComponent {
  @Input() pc!: PC;
  /** DM cross-link: turns the vitals into click-to-edit numbers. */
  @Input() editable = false;
  /** True while the DM's short-rest window is open on the player's own live
   *  session sheet — reveals the Spend Hit Die button under the Hit Dice tile. */
  @Input() canSpendHitDie = false;
  /** Armor Class, initiative, speed and proficiency bonus open their breakdowns
   *  instead of the plain number editor. Off for a follower, whose vitals are
   *  typed stat-block values with no lines. */
  @Input() breakdownEnabled = false;
  /** The viewer may change the adjustment lines in that breakdown (the DM, or the
   *  owner of a character that is in no campaign). Only changes the affordance
   *  here; the parent decides what the dialog allows. */
  @Input() canAdjust = false;
  /** Emits the full updated PC for the parent to persist. */
  readonly pcChange = output<PC>();
  /** The player spends a hit die (short rest) — the host owns the server call. */
  readonly spendHitDie = output<void>();
  /** A DM clicked an intercepted vital — the parent opens the DM edit modal. */
  readonly editRequested = output<DmEditRequest>();
  /** Anyone clicked a number that has a breakdown — the parent opens the dialog. */
  readonly breakdownRequested = output<AdjustableStat>();

  get hpPct(): number {
    if (!this.pc.hp) return 0;
    return Math.max(0, Math.min(100, (this.pc.hp.cur / this.pc.hp.max) * 100));
  }

  get hitDie(): number { return hitDieFor(this.pc.clazz); }

  /** Unspent hit dice: level minus the server-tracked spent count, floored at 0. */
  get hitDiceRemaining(): number {
    return Math.max(0, (this.pc.level ?? 0) - (this.pc.hitDiceUsed ?? 0));
  }

  /** Names of the currently-equipped armor/shield lines, then the DM's adjustment
   *  lines, then any calculated line the DM took out of the total ("Chain Shirt,
   *  +1 Taunka, Shield not counted") — the caption shown under the AC value.
   *  Empty when nothing is worn, adjusted or removed, so the caption is hidden. */
  get armorLabel(): string {
    const notCounted = breakdownOf(this.pc, 'ac').auto.filter(line => line.removed).map(line => line.label);
    // Worn gear whose line is out of the total is named once, as not counted.
    const out = notCounted.map(removalLabel);
    const worn = (this.pc.inventory ?? [])
      .filter(i => i.category === 'armor' && i.equipped && i.status !== 'dropped')
      .map(i => i.name)
      .filter(name => {
        const at = out.indexOf(removalLabel(name));
        if (at < 0) return true;
        out.splice(at, 1);
        return false;
      });
    const adjusted = adjustmentsFor(this.pc, 'ac').map(describeAdjustment);
    return [
      ...(worn.length ? [worn.join(' & ')] : []),
      ...adjusted,
      ...notCounted.map(label => `${label} not counted`),
    ].join(', ');
  }

  /** Spoken name of the AC button: the value, then what activating it does. */
  get acButtonLabel(): string {
    return this.breakdownButtonLabel('Armor class', this.pc.ac != null ? String(this.pc.ac) : null);
  }

  /** Spoken name of a breakdown button: the number and its value, then what activating it does. */
  breakdownButtonLabel(name: string, value: string | null): string {
    const what = `${name} ${value ?? 'not set'}. Show how it is worked out`;
    return this.canAdjust ? `${what} and adjust it` : what;
  }

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
