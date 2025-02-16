import { Component, OnInit } from '@angular/core';
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

  constructor(private pcService: PCService) {
    this.pcService.getPCs().subscribe(data =>
      {
       this.pcs = data;
       this.pcService.setPCs(this.pcs);
      }
    );
  }

  ngOnInit(): void {
  }
}
