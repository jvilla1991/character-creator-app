import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { PC } from '../../../models/pc';
import { MysticFocusOption, MysticFocusRequest, mysticFocusView } from '../../../models/mystic-focus';

let nextId = 0;

/**
 * Mystic Focus on the Spells tab, under the slot strip: the Warrior of the
 * Mystic Arts' trade between spell slots and Focus Points, both ways, one
 * button per spell level the Monk has slots for. A button whose trade the rule
 * refuses right now stays, disabled. Pressing one asks first: the confirm says
 * when the rule allows the trade and exactly what is spent and gained.
 *
 * Presentational: it reads the character it is given and emits the conversion
 * the viewer confirmed; the host sends it to the server. Renders nothing for a
 * character without the feature (anyone but this subclass at Monk level 6+).
 */
@Component({
  selector: 'app-mystic-focus',
  templateUrl: './mystic-focus.component.html',
  styleUrls: ['./mystic-focus.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MysticFocusComponent {
  readonly pc = input.required<PC>();
  /** A conversion is on its way to the server; further presses wait for it. */
  readonly busy = input(false);

  /** The conversion the viewer confirmed. */
  readonly convert = output<MysticFocusRequest>();

  readonly headingId = `mystic-focus-heading-${++nextId}`;

  readonly view = computed(() => mysticFocusView(this.pc()));

  /** The conversion waiting for its confirm, as `action|slotLevel`; null when none is. */
  private readonly pendingKey = signal<string | null>(null);

  /** The option behind {@link pendingKey}, read fresh; null once it is gone or no longer possible. */
  readonly pending = computed<MysticFocusOption | null>(() => {
    const key = this.pendingKey();
    const view = this.view();
    if (!key || !view) return null;
    const option = [...view.slotToFocus, ...view.focusToSlot].find(o => keyOf(o) === key);
    return option?.possible ? option : null;
  });

  /** Whose sheet this is. A computed, so a new but equal character object (every session poll) is not a change. */
  private readonly characterId = computed(() => this.pc().id);

  constructor() {
    // Another character took over the sheet: a confirm left open does not carry.
    effect(() => {
      this.characterId();
      untracked(() => this.pendingKey.set(null));
    });
  }

  isPending(option: MysticFocusOption): boolean {
    return this.pending() === option;
  }

  /** Ask before converting; a second press on the same button takes the question back. */
  ask(option: MysticFocusOption): void {
    if (!option.possible || this.busy()) return;
    this.pendingKey.set(this.pendingKey() === keyOf(option) ? null : keyOf(option));
  }

  confirm(): void {
    const option = this.pending();
    if (!option || this.busy()) return;
    this.pendingKey.set(null);
    this.convert.emit({ action: option.action, slotLevel: option.slotLevel });
  }

  cancel(): void {
    this.pendingKey.set(null);
  }

  /** "Spend a 1st-level slot for 1 Focus Point" / "Spend 2 Focus Points for a 1st-level slot". */
  ariaLabel(option: MysticFocusOption): string {
    const pointsText = `${option.amount} Focus Point${option.amount === 1 ? '' : 's'}`;
    return option.action === 'SLOT_TO_FOCUS'
      ? `Spend a ${option.label}-level slot for ${pointsText}`
      : `Spend ${pointsText} for a ${option.label}-level slot`;
  }
}

const keyOf = (option: MysticFocusRequest): string => `${option.action}|${option.slotLevel}`;
