import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { HttpParams } from '@angular/common/http';
import { Component, EventEmitter, OnInit, Output, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { PC } from '../../models/pc';
import { User } from '../../models/user';
import { PCService } from '../../services/pc.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
  pc: PC | undefined;
  @Input() user!: any;

  constructor() {}

  events: string[] = [];
  opened?: boolean = true;
  public isScreenSmall!: boolean;
  pcs: PC[] = [];
  pcId!: number;

  ngAfterContentInit(): void {
    console.log('OUTPUT: ');
    console.log(this.user);
    this.pcs = this.user.pcs;
  }

  // sendPC() {
  //   this.pc = this.PCs.find(pc => pc.id === this.pcId)

  //   this.router.navigate(['/MainContentComponent',
  //   { pc: JSON.stringify(this.pc) }]);
  // }

  // sendPc() {
  //   this.pc = this.PCs.find(pc => pc.id === this.pcId)

  //   this.pcEvent.emit(this.pc);
  // }
}
