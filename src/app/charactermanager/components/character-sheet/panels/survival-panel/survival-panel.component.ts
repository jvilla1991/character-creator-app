import { Component, EventEmitter, Input, Output } from '@angular/core';
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
 * Two write paths, following the sell/inventory precedent:
 *  - DM steppers emit `pcChange` (the sheet persists via updatePC/AsDm);
 *  - the owner's Eat/Drink buttons emit `actionRequested` — the HOST decides:
 *    on the plain sheet it applies the reducer locally, in Session Mode it
 *    calls the server-authoritative consume endpoint so every viewer sees the
 *    change. (Sleep relief is the DM's Long Rest, not a player button.)
 *
 * The exhaustion badge is computed live and never written to pc.conditions.
 */
@Component({
  selector: 'app-survival-panel',
  templateUrl: './survival-panel.component.html',
})
export class SurvivalPanelComponent {
  @Input() pc!: PC;
  /** Steppers active (the DM's cross-link view). */
  @Input() editable = false;
  /** The viewing player owns this sheet — reveals the Eat/Drink actions. */
  @Input() ownControls = false;
  @Output() pcChange = new EventEmitter<PC>();
  /** Owner clicked Eat/Drink — the host applies it (locally or via the session). */
  @Output() actionRequested = new EventEmitter<SurvivalAction>();

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
