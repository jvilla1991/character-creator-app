import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiStateService, Role } from '../../../services/ui-state.service';

/**
 * Segmented Player / Dungeon Master control. This is the ONLY place the
 * app-level role is switched (per the DM-mode handoff).
 */
@Component({
    selector: 'app-role-switch',
    templateUrl: './role-switch.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleSwitchComponent {
  readonly isPlayer = this.uiState.isPlayer;
  readonly isDm = this.uiState.isDm;

  constructor(private uiState: UiStateService) {}

  setRole(role: Role): void {
    this.uiState.setRole(role);
  }
}
