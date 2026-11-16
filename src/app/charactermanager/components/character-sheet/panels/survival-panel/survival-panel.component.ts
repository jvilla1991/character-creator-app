import { ChangeDetectionStrategy, Component, Input, output } from '@angular/core';
import { PC, PcSurvival } from '../../../../models/pc';
import {
  SURVIVAL_KEYS,
  SURVIVAL_LABELS,
  SurvivalAction,
  SurvivalKey,
  clampStage,
  survivalExhaustion,
  survivalOf,
} from '../../../../utils/survival';

/**
 * Darker Dungeons survival tracker — shown only in campaigns with the
 * survivalConditions variant (gated by the host, like the slot-inventory
 * view). Three stage rows plus the improvement actions.
 *
 * Every write here is the DM's: the player reads their stages, the DM decides
 * when the character eats, drinks or slips a stage. Two write paths, following
 * the sell/inventory precedent:
 *  - the steppers emit `pcChange` (the sheet persists via updatePC/AsDm);
 *  - Eat/Drink emit `actionRequested` — the HOST decides: on the plain sheet
 *    it applies the reducer locally, in Session Mode it calls the
 *    server-authoritative consume endpoint so every viewer sees the change.
 *    (Sleep relief is the DM's Long Rest.)
 *
 * The exhaustion badge is computed live and never written to pc.conditions.
 */
@Component({
    selector: 'app-survival-panel',
    templateUrl: './survival-panel.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SurvivalPanelComponent {
  @Input() pc!: PC;
  /** Steppers and Eat/Drink active (the DM's cross-link view). */
  @Input() editable = false;
  readonly pcChange = output<PC>();
  /** The DM clicked Eat/Drink — the host applies it (locally or via the session). */
  readonly actionRequested = output<SurvivalAction>();

  readonly keys = SURVIVAL_KEYS;

  get survival(): PcSurvival {
    return survivalOf(this.pc);
  }

  get exhaustion(): number {
    return survivalExhaustion(this.survival);
  }

  stage(key: SurvivalKey): number {
    return this.survival[key];
  }

  label(key: SurvivalKey): string {
    return SURVIVAL_LABELS[key][this.stage(key)];
  }

  adjust(key: SurvivalKey, delta: number): void {
    const survival = { ...this.survival, [key]: clampStage(this.stage(key) + delta) };
    this.pcChange.emit({ ...this.pc, survival });
  }
}
