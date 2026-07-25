import { Component, Input, input, output } from '@angular/core';
import { DndBackground } from '../../../../models/dnd-api.types';
import { FormsModule } from '@angular/forms';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/**
 * Step 6: assign ability scores (Standard Array or Point Buy) and apply the
 * background's +2/+1 bonus. Presentational — the parent owns all the scoring
 * math and the canonical state. The display helpers (finalScore /
 * availableFor / can*Score) are passed in as bound functions so the formulas
 * stay single-sourced on the parent; interactions are reported via events.
 * Modifiers render via the shared `modifier` pipe rather than a passed-in formatter.
 *
 * The `assignments` Record is the parent's own object (shared by reference), so
 * the Standard-Array [(ngModel)] writes land directly on parent state.
 */
@Component({
    selector: 'app-ability-scores-step',
    templateUrl: './ability-scores-step.component.html',
    styleUrls: ['./ability-scores-step.component.scss'],
    imports: [FormsModule, ModifierPipe]
})
export class AbilityScoresStepComponent {
  readonly abilityMethod = input<'standard' | 'point-buy'>('standard');
  readonly abilities = input<readonly Ability[]>([]);
  @Input() assignments: Record<Ability, number | null> =
    { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null };
  readonly pointBuyScores = input<Record<Ability, number>>({ STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 });
  readonly bonusPlus2 = input<Ability | ''>('');
  readonly bonusPlus1 = input<Ability | ''>('');
  @Input() bonusAbilities: Ability[] = [];
  readonly backgroundDetail = input<DndBackground | null>(null);
  readonly background = input('');
  readonly pointBuyBudget = input(27);
  readonly pointBuySpent = input(0);
  readonly pointBuyRemaining = input(27);

  // Math provided by the parent (single source of truth).
  readonly finalScore = input<(a: Ability) => number>(() => 0);
  readonly availableFor = input<(a: Ability) => number[]>(() => []);
  readonly canIncreaseScore = input<(a: Ability) => boolean>(() => false);
  readonly canDecreaseScore = input<(a: Ability) => boolean>(() => false);

  readonly abilityMethodChange = output<'standard' | 'point-buy'>();
  readonly increase = output<Ability>();
  readonly decrease = output<Ability>();
  readonly bonusPlus2Change = output<Ability | ''>();
  readonly bonusPlus1Change = output<Ability | ''>();
}
