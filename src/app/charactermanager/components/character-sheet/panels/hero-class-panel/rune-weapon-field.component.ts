import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { isRuneforger, meleeWeapons, runeName, runeWeaponOf } from '../../../../utils/rune-weapon';

/**
 * The Death Knight's rune weapon on the hero-class panel (Runeforging, Paladin
 * level 3+): which melee weapon carries the rune, and — for the sheet's owner
 * or the DM — a select to set it. The usual moment to move the rune is the end
 * of a long rest; this is here for the first inscription on an existing
 * character and for fixing a mistake. Renders nothing for anyone else.
 */
@Component({
  selector: 'app-rune-weapon-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown()) {
      <div class="feature">
        <div class="feature-head">
          <span class="feature-name">{{ name() }} Weapon</span>
          <span class="feature-source">Runeforging</span>
        </div>
        @if (editable() && weapons().length) {
          <select class="rune-weapon-select" [attr.aria-label]="'Weapon that carries the ' + name()"
            [value]="current() ?? ''" (change)="choose($event)">
            @if (!current()) {
              <option value="" disabled>Choose a melee weapon</option>
            }
            @for (w of weapons(); track w.name) {
              <option [value]="w.name" [selected]="w.name === current()">{{ w.name }}</option>
            }
          </select>
        } @else {
          <div class="feature-desc">
            {{ current() ?? (weapons().length ? 'Not inscribed on a weapon yet.' : 'No melee weapon to inscribe.') }}
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .rune-weapon-select { margin-top: 6px; max-width: 100%; }
  `],
})
export class RuneWeaponFieldComponent {
  readonly pc = input.required<PC>();
  readonly editable = input(false);

  /** The weapon the user picked. */
  readonly runeWeaponChange = output<string>();

  readonly shown = computed(() => isRuneforger(this.pc()));
  readonly name = computed(() => runeName(this.pc()));
  readonly weapons = computed(() => meleeWeapons(this.pc()));
  readonly current = computed(() => runeWeaponOf(this.pc()));

  choose(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value && value !== this.current()) this.runeWeaponChange.emit(value);
  }
}
