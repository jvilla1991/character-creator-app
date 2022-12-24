import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent implements OnInit {
  events: string[] = [];
  opened?: boolean = true;
  public isScreenSmall!: boolean;

  constructor(private breakpointObserver: BreakpointObserver) { }

  ngOnInit(): void {
    this.breakpointObserver
    .observe([ '(max-width: $(SMALL_WIDTH_BREAKPOINT)px' ])
    .subscribe((state: BreakpointState) => {
      this.isScreenSmall = state.matches;
    });
  }

}
