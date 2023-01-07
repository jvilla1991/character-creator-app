import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Pc } from '../../models/pc';
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
  PCs: Pc[] = [];

  ngOnInit(): void {
    // this.breakpointObserver
    // .observe([ '(max-width: $(SMALL_WIDTH_BREAKPOINT)px' ])
    // .subscribe((state: BreakpointState) => {
    //   this.isScreenSmall = state.matches;
    // });

    //this.user = this.userService.getUser();
    this.userService.getUser().subscribe(data =>
      { this.PCs = data.pcs }
    );
  }
}
