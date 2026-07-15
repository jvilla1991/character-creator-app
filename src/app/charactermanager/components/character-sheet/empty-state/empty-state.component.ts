import { Component, EventEmitter, Output } from '@angular/core';

@Component({
    selector: 'app-empty-state',
    templateUrl: './empty-state.component.html',
    styleUrls: ['./empty-state.component.scss'],
    standalone: false
})
export class EmptyStateComponent {
  @Output() forgeHero = new EventEmitter<void>();
}
