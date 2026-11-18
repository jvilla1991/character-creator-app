import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SpellEli5Service } from '../../services/spell-eli5.service';

/**
 * Compact inline "ELI5" switch placed at the top of spell areas (the sheet's
 * spellbook, the level-up spell pickers) so a player can flip between the
 * one-sentence summaries and the full rules text without opening settings.
 * It drives the same saved preference as the settings-panel row, and renders
 * nothing outside the Player view (see SpellEli5Service.available).
 */
@Component({
    selector: 'app-eli5-toggle',
    templateUrl: './eli5-toggle.component.html',
    styleUrls: ['./eli5-toggle.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Eli5ToggleComponent {
  constructor(readonly eli5: SpellEli5Service) {}
}
