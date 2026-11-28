import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { CONDITIONS_LIST } from '../../../../utils/character-math';

let nextVitalsId = 0;

/**
 * What play changes on a server-owned companion (a Vestige Patron's vestige):
 * its current Hit Points, its temporary Hit Points and its conditions. On a
 * companion's sheet this panel stands where the Conditions panel does on any
 * other, and it is the only place that sheet can be edited besides the name:
 * the server works everything else out from the companion's character and
 * ignores it in a save.
 *
 * The owning player and the DM both get the controls (`canEdit`); anyone else
 * sees the same numbers and chips, inert. A condition the companion is immune
 * to shows green and cannot be set. Each change is emitted as the whole
 * updated sheet, like the other panels do.
 */
@Component({
  selector: 'app-companion-vitals',
  templateUrl: './companion-vitals.component.html',
  styleUrls: ['./companion-vitals.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanionVitalsComponent {
  /** The companion, as the sheet-shaped PC its follower sheet renders. */
  readonly pc = input.required<PC>();
  /** The viewer is the owning player or the DM. */
  readonly canEdit = input(false);
  /** The sheet with one of the three values changed. */
  readonly pcChange = output<PC>();

  readonly conditions = CONDITIONS_LIST;
  private readonly id = ++nextVitalsId;
  readonly currentId = `companion-hp-${this.id}`;
  readonly temporaryId = `companion-temp-hp-${this.id}`;

  readonly max = computed(() => this.pc().hp?.max ?? 0);
  readonly current = computed(() => this.pc().hp?.cur ?? 0);
  readonly temporary = computed(() => this.pc().hp?.temp ?? 0);

  isActive(condition: string): boolean {
    return this.pc().conditions?.includes(condition) ?? false;
  }

  isImmune(condition: string): boolean {
    return this.pc().conditionImmunities?.includes(condition) ?? false;
  }

  /** Read after the chip's name by a screen reader, since the colour carries the state. */
  stateLabel(condition: string): string {
    return this.isImmune(condition) ? ', immune' : this.isActive(condition) ? ', has it' : '';
  }

  /** Put a condition on the companion or take it off; one it is immune to stays as it is. */
  toggle(condition: string): void {
    if (!this.canEdit() || this.isImmune(condition)) return;
    const without = (this.pc().conditions ?? []).filter(c => c !== condition);
    this.pcChange.emit({
      ...this.pc(), conditions: this.isActive(condition) ? without : [...without, condition],
    });
  }

  /** A number typed into one of the two fields: kept whole, never negative, never above the maximum. */
  setHp(which: 'cur' | 'temp', event: Event): void {
    const field = event.target as HTMLInputElement;
    const hp = this.pc().hp ?? { max: 0, cur: 0, temp: 0 };
    // An emptied field is not a zero: it goes back to the stored value.
    const typed = field.value.trim() === '' ? NaN : Math.trunc(Number(field.value));
    const floor = Number.isFinite(typed) ? Math.max(0, typed) : hp[which];
    const value = which === 'cur' ? Math.min(floor, hp.max) : floor;
    // Show what was kept, whether or not it differs from what is stored.
    field.value = String(value);
    if (!this.canEdit() || value === hp[which]) return;
    this.pcChange.emit({ ...this.pc(), hp: { ...hp, [which]: value } });
  }
}
