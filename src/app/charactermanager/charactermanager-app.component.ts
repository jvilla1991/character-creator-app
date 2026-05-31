import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PC } from './models/pc';
import { PCService } from './services/pc.service';
import { CharacterModalService } from './services/character-modal.service';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [pcs]="pcs"></app-sidenav>

    <!-- Create-character overlay — position: fixed, inset 0, blurred backdrop -->
    <div *ngIf="isCreateModalOpen"
         class="modal-backdrop"
         (click)="closeCreate()">
      <app-create-character-modal
        (click)="$event.stopPropagation()"
        (confirm)="onCreate($event)"
        (close)="closeCreate()">
      </app-create-character-modal>
    </div>
  `,
  styles: []
})
export class CharactermanagerAppComponent implements OnInit, OnDestroy {
  pcs: PC[] = [];
  isCreateModalOpen = false;

  private subs: Subscription[] = [];

  constructor(
    private pcService: PCService,
    private characterModal: CharacterModalService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.pcService.pcs$.subscribe(pcs => { this.pcs = pcs; }),

      this.characterModal.isOpen$.subscribe(open => { this.isCreateModalOpen = open; }),

      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe(() => {
          if (this.router.url.includes('/charactermanager')) {
            this.pcService.refreshPCs();
          }
        })
    );

    this.pcService.refreshPCs();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  closeCreate(): void  { this.characterModal.closeCreateModal(); }
  onCreate(draft: Partial<PC>): void { this.characterModal.onCreated(draft); }
}
