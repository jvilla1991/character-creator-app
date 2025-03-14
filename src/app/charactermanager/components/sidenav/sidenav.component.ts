import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Output() createPCEvent = new EventEmitter<void>();

  constructor(private pcService: PCService) {}

  events: string[] = [];
  opened?: boolean = true;
  public isScreenSmall!: boolean;

  setActivePC(pc: PC) {
    this.pcService.setActivePC(pc);
  }

  addCharacter() {
    this.createPCEvent.emit()
  }

}
