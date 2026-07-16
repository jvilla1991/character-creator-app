import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../models/pc';

@Component({
    selector: 'app-delete-confirmation-modal',
    templateUrl: './delete-confirmation-modal.component.html',
    styleUrls: ['./delete-confirmation-modal.component.scss'],
    standalone: false
})
export class DeleteConfirmationModalComponent {
  @Input()  pc!: PC;
  @Output() confirm = new EventEmitter<void>();
  @Output() close   = new EventEmitter<void>();

  confirmDelete(): void { this.confirm.emit(); }
  cancel(): void        { this.close.emit();   }
}
