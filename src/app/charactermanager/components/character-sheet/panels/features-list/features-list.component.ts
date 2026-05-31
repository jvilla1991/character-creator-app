import { Component, Input } from '@angular/core';
import { PC } from '../../../../models/pc';

@Component({
  selector: 'app-features-list',
  templateUrl: './features-list.component.html',
  styleUrls: ['./features-list.component.scss']
})
export class FeaturesListComponent {
  @Input() pc!: PC;
}
