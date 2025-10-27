import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';
import { DndResourcesService } from '../../services/dnd-resources.service';
import { MatDialog } from '@angular/material/dialog';
import { DeleteConfirmationModalComponent } from './delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent {
  pc: PC | null = null;
  isCreatingCharacter = false;
  characterClasses: string[] = [];
  newPC: PC = {} as PC;

  constructor(private route: ActivatedRoute, private router: Router, private pcService: PCService,
    private dndResourceService: DndResourcesService, private modal: MatDialog) { }

  ngOnInit() {
    this.pcService.getActivePC().subscribe((pc) => {
      this.pc = pc;
    });

    this.route.paramMap.subscribe(params => {
      this.isCreatingCharacter = this.router.url.includes('create');
    });

    if (this.isCreatingCharacter) {
      this.dndResourceService.getClassNames().subscribe(
        (data) => {
          this.characterClasses = data;
          console.log('Fetched classes:', this.characterClasses);
        },
        (error) => console.error('Error fetching classes', error)
      );
    }
  }

  submitPC() {
    if (!this.newPC.name || !this.newPC.clazz) {
      alert("Please enter a character name and select a class.");
      return;
    }

    this.pcService.addPC(this.newPC).subscribe(
      (response) => {
        console.log("Character Created Successfully:", response);
        this.router.navigate(['/charactermanager']);
      },
      (error) => {
        console.error("Error creating character", error);
        alert("Failed to create character. Please try again.");
      }
    );
  }

  openDeleteModal() {
    const dialogRef = this.modal.open(DeleteConfirmationModalComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.pc) {
        this.pcService.deletePC(this.pc.id).subscribe({
          complete: () => {
            console.log("Character deleted successfully.");
            this.router.navigate(['/charactermanager']);
          },
          error: (error) => console.error("Error deleting character:", error)
        });
      }
    });
  }
  stopCharacterCreation() {
    return null;
  }
}
