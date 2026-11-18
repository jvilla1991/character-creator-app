import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ModalComponent } from './modal.component';
import { ConfirmService } from './confirm.service';

/**
 * Renders the open `ConfirmService` request: a crimson `alertdialog` on the
 * shared modal shell. Cancel comes first in the DOM, so it is what focus lands
 * on — Enter on a dialog that just opened never destroys anything. Escape, the
 * close button and the backdrop all cancel.
 */
@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  template: `
    @if (confirmations.request(); as req) {
      <div class="modal-backdrop" (click)="req.settle(false)">
        <app-modal [title]="req.title" tone="crimson" dialogRole="alertdialog"
          [closeLabel]="req.cancelLabel ?? 'Cancel'" (dismiss)="req.settle(false)">
          <p class="modal-sub confirm-message">
            @if (req.subject) {
              <em class="confirm-subject">{{ req.subject }}</em>
            }
            {{ req.message }}
          </p>
          <div class="modal-actions">
            <button class="btn" type="button" (click)="req.settle(false)">{{ req.cancelLabel ?? 'Cancel' }}</button>
            <button class="btn danger" type="button" (click)="req.settle(true)">{{ req.confirmLabel }}</button>
          </div>
        </app-modal>
      </div>
    }
  `,
  styles: [`
    .confirm-message { margin-top: 0; overflow-wrap: anywhere; }
    .confirm-subject { color: var(--text); font-style: normal; }
  `],
})
export class ConfirmHostComponent {
  protected readonly confirmations = inject(ConfirmService);
}
