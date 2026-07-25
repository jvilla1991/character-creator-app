import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Step 1 of the create-character wizard: hero name + (read-only) player.
 *
 * Presentational only — all wizard state and logic live on the parent
 * CreateCharacterModalComponent. This child receives the current values via
 * @Input and reports edits/navigation via @Output. Shared modal/form styling
 * (.modal-title, .modal-sub, .field) is global in src/styles.css, so this
 * component needs no styles of its own.
 */
@Component({
    selector: 'app-identity-step',
    templateUrl: './identity-step.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule]
})
export class IdentityStepComponent {
  /** Hero name (two-way bound: [(name)] on the parent). */
  readonly name = input('');
  /** Signed-in player's username — display only. */
  readonly player = input('');

  readonly nameChange = output<string>();
  /** Advance to the next step (Enter key). */
  readonly next = output<void>();
  /** Close the wizard (Escape key). */
  readonly cancel = output<void>();
}
