import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PC } from './models/pc';
import { PCService } from './services/pc.service';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [pcs]="pcs" *ngIf="pcs" ></app-sidenav>
  `,
  styles: []
})
export class CharactermanagerAppComponent implements OnInit, OnDestroy {
  pcs: PC[] = [];

  private pcsSub!: Subscription;

  constructor(private pcService: PCService, private router: Router) {}

  ngOnInit(): void {
    // Drive sidenav from the shared reactive stream so any service call
    // (delete, add, refresh) automatically updates the list without navigation
    this.pcsSub = this.pcService.pcs$.subscribe(pcs => {
      this.pcs = pcs;
    });

    // Initial load
    this.pcService.refreshPCs();

    // Reload when navigating back into the character manager (e.g. after create)
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url.includes('/charactermanager')) {
          this.pcService.refreshPCs();
        }
      });
  }

  ngOnDestroy(): void {
    this.pcsSub.unsubscribe();
  }
}
