import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PC } from './models/pc';
import { PCService } from './services/pc.service';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [pcs]="pcs" *ngIf="pcs" ></app-sidenav>
  `,
  styles: [
  ]
})
export class CharactermanagerAppComponent implements OnInit {
  pcs!: PC[];

  constructor(private pcService: PCService, private router: Router) {
    this.loadPCs();
    
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url.includes('/charactermanager')) {
          this.loadPCs();
        }
      });
  }

  ngOnInit(): void {
  }

  private loadPCs(): void {
    this.pcService.getPCs().subscribe(data => {
      this.pcs = data;
      this.pcService.setPCs(this.pcs);
    });
  }
}
