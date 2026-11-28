import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  ARCANE_SHOTS, ArcaneShotRule, arcaneShotBlocked, arcaneShotDamage, arcaneShotSaveName, toggleArcaneShot,
} from '../../models/arcane-shots';

/** One option as a row of the list. */
export interface ArcaneShotRow {
  name: string;
  summary: string;
  /** The damage at the level shown, and the save if there is one: '2d6 Psychic · Wisdom save'. */
  meta: string;
  /** The character knew it before this choice. */
  known: boolean;
  selected: boolean;
  /** Ticking or unticking it would break the rule. */
  blocked: boolean;
}

let nextId = 0;

/**
 * The eight Arcane Shot options as a tick list: an Arcane Archer's choice at
 * a level-up, and the same choice made from the character sheet.
 *
 * Presentational. The rule says what may be ticked (how many options, which
 * are known already, how many of those may be swapped out); a box whose change
 * would break it is disabled, so the list can never hold a selection the
 * server refuses. The host keeps the selection and decides when it is sent.
 */
@Component({
  selector: 'app-arcane-shot-picker',
  templateUrl: './arcane-shot-picker.component.html',
  styleUrls: ['./arcane-shot-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArcaneShotPickerComponent {
  readonly rule = input.required<ArcaneShotRule>();
  /** The options ticked, by name. */
  readonly selected = input.required<readonly string[]>();
  /** The Fighter level the damage is shown for. */
  readonly level = input.required<number>();
  /** The selection after a box was ticked or unticked. */
  readonly selectedChange = output<string[]>();

  /** Keeps the boxes of two lists on one page apart. */
  readonly groupName = `arcane-shots-${++nextId}`;

  readonly rows = computed<ArcaneShotRow[]>(() => {
    const rule = this.rule();
    const selected = this.selected();
    const level = this.level();
    return ARCANE_SHOTS.map(shot => {
      const save = arcaneShotSaveName(shot);
      return {
        name: shot.name,
        summary: shot.summary,
        meta: save ? `${arcaneShotDamage(shot, level)} · ${save}` : arcaneShotDamage(shot, level),
        known: rule.known.includes(shot.name),
        selected: selected.includes(shot.name),
        blocked: arcaneShotBlocked(rule, selected, shot.name),
      };
    });
  });

  toggle(name: string): void {
    const selected = this.selected();
    const next = toggleArcaneShot(this.rule(), selected, name);
    if (next.length !== selected.length) this.selectedChange.emit(next);
  }
}
