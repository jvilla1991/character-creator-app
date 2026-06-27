import { Component, EventEmitter, Input, Output } from '@angular/core';

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
})
export class IdentityStepComponent {
  /** Hero name (two-way bound: [(name)] on the parent). */
  @Input() name = '';
  /** Signed-in player's username — display only. */
  @Input() player = '';

  @Output() nameChange = new EventEmitter<string>();
  /** Advance to the next step (Enter key). */
  @Output() next = new EventEmitter<void>();
  /** Close the wizard (Escape key). */
  @Output() cancel = new EventEmitter<void>();
}
