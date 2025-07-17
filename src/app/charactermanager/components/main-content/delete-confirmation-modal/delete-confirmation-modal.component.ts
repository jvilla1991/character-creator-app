import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { PCService } from 'src/app/charactermanager/services/pc.service';

@Component({
  selector: 'app-delete-confirmation-modal',
  templateUrl: './delete-confirmation-modal.component.html',
  styleUrls: ['./delete-confirmation-modal.component.scss']
})
export class DeleteConfirmationModalComponent {
  userInput: string = '';

  constructor(public dialogRef: MatDialogRef<DeleteConfirmationModalComponent>, private pcService: PCService ) {}

  confirmDelete() {
    if (this.userInput.toLowerCase() === 'delete') {
      this.dialogRef.close(true);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
