import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { PC } from '../../models/pc';
import { User } from '../../models/user';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent implements OnInit {
  constructor(private breakpointObserver: BreakpointObserver,
    private userService: UserService) { }

  events: string[] = [];
  opened?: boolean = true;
  public isScreenSmall!: boolean;
  PCs: PC[] = [];

  ngOnInit(): void {
    this.userService.getUser().subscribe(data =>
      { this.PCs = data.pcs }
    );
  }
}
