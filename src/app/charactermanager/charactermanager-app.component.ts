import { Component, OnInit } from '@angular/core';
import { PC } from './models/pc';
import { User } from './models/user';
import { UserService } from './services/user.service';
import { PCService } from './services/pc.service';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [user]="user" *ngIf="user" ></app-sidenav>
  `,
  styles: [
  ]
})
export class CharactermanagerAppComponent implements OnInit {
  user!: User;

  constructor(private userService: UserService, private pcService: PCService) {
    this.userService.getUser().subscribe(data =>
      {
       this.user = data;
       pcService.setPCs(this.user.pcs);
      }
    );
  }

  ngOnInit(): void {
  }
}
