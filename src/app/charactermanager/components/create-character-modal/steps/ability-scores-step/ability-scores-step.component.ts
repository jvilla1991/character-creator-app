import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() abilityMethod: 'standard' | 'point-buy' = 'standard';
  @Input() abilities: readonly Ability[] = [];
  @Input() assignments: Record<Ability, number | null> =
    { STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null };
  @Input() pointBuyScores: Record<Ability, number> =
    { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 };
  @Input() bonusPlus2: Ability | '' = '';
  @Input() bonusPlus1: Ability | '' = '';
  @Input() bonusAbilities: Ability[] = [];
  @Input() backgroundDetail: DndBackground | null = null;
  @Input() background = '';
  @Input() pointBuyBudget = 27;
  @Input() pointBuySpent = 0;
  @Input() pointBuyRemaining = 27;

  // Math provided by the parent (single source of truth).
  @Input() finalScore: (a: Ability) => number = () => 0;
  @Input() availableFor: (a: Ability) => number[] = () => [];
  @Input() canIncreaseScore: (a: Ability) => boolean = () => false;
  @Input() canDecreaseScore: (a: Ability) => boolean = () => false;

  @Output() abilityMethodChange = new EventEmitter<'standard' | 'point-buy'>();
  @Output() increase = new EventEmitter<Ability>();
  @Output() decrease = new EventEmitter<Ability>();
  @Output() bonusPlus2Change = new EventEmitter<Ability | ''>();
  @Output() bonusPlus1Change = new EventEmitter<Ability | ''>();
}
