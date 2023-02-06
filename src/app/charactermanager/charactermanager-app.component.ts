import { Component, OnInit } from '@angular/core';
import { PC } from './models/pc';
import { User } from './models/user';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-charactermanager-app',
  template: `
    <app-sidenav [user]="user" *ngIf="user" ngDefaultControl></app-sidenav>
  `,
  styles: [
  ]
})
export class CharactermanagerAppComponent implements OnInit {
  user!: User;

  constructor(private userService: UserService) {
    this.userService.getUser().subscribe(data =>
      {
       this.user = data;
      }
    );
  }

  ngOnInit(): void {
  }
}
