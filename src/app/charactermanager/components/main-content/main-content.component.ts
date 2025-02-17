import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { PC } from '../../models/pc';
import { PCService } from '../../services/pc.service';

@Component({
  selector: 'app-main-content',
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.scss']
})
export class MainContentComponent {
  pc: PC | null = null;

  constructor(private route: ActivatedRoute, private pcService: PCService) {}

  ngOnInit() {
    this.pcService.getActivePC().subscribe((pc) => {
      this.pc = pc;
    });
  }
}
