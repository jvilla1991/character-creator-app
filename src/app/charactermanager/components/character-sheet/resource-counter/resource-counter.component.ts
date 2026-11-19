import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ClassResourceState, recoveryLabel } from '../../../utils/class-resources';

let nextId = 0;

/**
 * One limited-use class feature on the sheet: what is left of it, when it
 * comes back, and — for whoever may edit the sheet — the controls to spend
 * and regain it.
 *
 * A handful of uses (Second Wind, Rage) shows a pip per use and steps one at a
 * time. A pool (Lay On Hands, Focus Points, Sorcery Points, Death Coil dice)
 * adds an amount field, so twenty points are one entry, not twenty taps.
 *
 * Presentational: it emits the new USED amount; the host saves the character.
 */
@Component({
  selector: 'app-resource-counter',
  templateUrl: './resource-counter.component.html',
  styleUrls: ['./resource-counter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceCounterComponent {
  readonly resource = input.required<ClassResourceState>();
  readonly editable = input(false);
  /** Leave the name out when the counter sits under a feature of the same name. */
  readonly hideName = input(false);

  /** The new used amount after a spend or a regain. */
  readonly usedChange = output<number>();

  readonly amountId = `resource-amount-${++nextId}`;

  /** How many to spend or regain at once (pools only); always at least 1. */
  private readonly amount = signal(1);
  readonly step = computed(() => (this.resource().pool ? this.amount() : 1));

  readonly pips = computed(() =>
    Array.from({ length: this.resource().pool ? 0 : this.resource().max }, (_, i) => i));

  readonly recovery = computed(() => recoveryLabel(this.resource()));

  /** " points left" / " left" after the count; a plain use count needs no unit. The
   *  leading space is part of the text, so it reads "2 / 3 left" aloud as well as on screen. */
  readonly countSuffix = computed(() => (this.resource().pool ? ` ${this.resource().unit} left` : ' left'));

  readonly spendLabel = computed(() => (this.resource().pool ? 'Spend' : 'Use'));

  onAmount(event: Event): void {
    const value = Math.floor(Number((event.target as HTMLInputElement).value));
    this.amount.set(Number.isFinite(value) && value >= 1 ? Math.min(value, this.resource().max) : 1);
  }

  spend(): void {
    const r = this.resource();
    if (!this.editable() || r.remaining === 0) return;
    this.usedChange.emit(Math.min(r.max, r.used + this.step()));
  }

  regain(): void {
    const r = this.resource();
    if (!this.editable() || r.used === 0) return;
    this.usedChange.emit(Math.max(0, r.used - this.step()));
  }
}
