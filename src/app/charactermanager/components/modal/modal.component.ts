import { Component, inject, input } from '@angular/core';
import { DialogDirective } from './dialog.directive';

let nextId = 0;

/**
 * The shared modal shell: the `.modal` box, a real `<h2>` title that names the
 * dialog, a close button, and — through `DialogDirective` — Escape, focus-in,
 * the Tab trap and focus return.
 *
 * ```html
 * <app-modal title="Strike From The Record" tone="crimson" dialogRole="alertdialog"
 *   (dismiss)="cancel()">
 *   …body and .modal-actions…
 * </app-modal>
 * ```
 *
 * The backdrop stays with the host that opens the dialog (it owns
 * click-outside-to-close). Clicks inside the shell never reach it.
 *
 * `closable = false` drops the close button; pair it with
 * `[dialogDismissible]="false"` for a dialog whose only exits are its own
 * actions (the players' rest vote).
 */
@Component({
  selector: 'app-modal',
  hostDirectives: [{
    directive: DialogDirective,
    inputs: ['dialogRole', 'dialogDismissible'],
    outputs: ['dismiss'],
  }],
  host: {
    class: 'modal',
    '[class.tone-celestial]': 'tone() === "celestial"',
    '[class.tone-crimson]': 'tone() === "crimson"',
    '[attr.aria-labelledby]': 'titleId',
    '(click)': '$event.stopPropagation()',
  },
  styles: [':host { display: block; }'],
  template: `
    <div class="modal-head" [class.has-close]="closable()">
      <h2 class="modal-title" [id]="titleId">{{ title() }}</h2>
      @if (closable()) {
        <button type="button" class="modal-close" data-dialog-close
          [attr.aria-label]="closeLabel()" (click)="dialog.requestDismiss()">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8"/>
          </svg>
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  /** Border + title accent. Gold is the house default. */
  readonly tone = input<'gold' | 'celestial' | 'crimson'>('gold');
  readonly closable = input(true);
  readonly closeLabel = input('Close');

  protected readonly dialog = inject(DialogDirective);
  protected readonly titleId = `modal-title-${++nextId}`;
}
