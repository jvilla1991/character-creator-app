import { Component, Input } from '@angular/core';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
  pc: PC | undefined;
  @Input() pcs!: any;

  constructor(private pcService: PCService) {}

  events: string[] = [];
  opened?: boolean = true;
  public isScreenSmall!: boolean;

  ngAfterContentInit(): void {

    // This is going to display the first character is there is one available
    // if (this.pcs.length > 0) this.router.navigate(['/charactermanager', this.pcs[0].id]);
  }

  setActivePC(pc: PC) {
    this.pcService.setActivePC(pc);
  }

}
