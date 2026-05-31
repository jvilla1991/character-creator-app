import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PC } from '../models/pc';
import { PCService } from './pc.service';

/** Controls visibility of the create-character modal without MatDialog. */
@Injectable()
export class CharacterModalService {
  private openSubject = new BehaviorSubject<boolean>(false);
  isOpen$ = this.openSubject.asObservable();

  constructor(private pcService: PCService) {}

  openCreateModal(): void  { this.openSubject.next(true);  }
  closeCreateModal(): void { this.openSubject.next(false); }

  onCreated(draft: Partial<PC>): void {
    this.closeCreateModal();
    this.pcService.addPC(draft as PC).subscribe(pc => {
      this.pcService.setActivePC(pc);
      this.pcService.refreshPCs();
    });
  }
}
