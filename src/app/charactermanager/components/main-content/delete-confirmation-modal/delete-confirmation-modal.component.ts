import { Component, input, output } from '@angular/core';
import { PC } from '../../../models/pc';
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({
    selector: 'app-delete-confirmation-modal',
    templateUrl: './delete-confirmation-modal.component.html',
    styleUrls: ['./delete-confirmation-modal.component.scss'],
    imports: [CdkTrapFocus]
})
export class DeleteConfirmationModalComponent {
  readonly pc = input.required<PC>();
  readonly confirm = output<void>();
  readonly close = output<void>();

  confirmDelete(): void { this.confirm.emit(); }
  cancel(): void        { this.close.emit();   }
}
