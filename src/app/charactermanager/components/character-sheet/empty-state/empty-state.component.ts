import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PCService } from '../../../services/pc.service';

@Component({
    selector: 'app-empty-state',
    templateUrl: './empty-state.component.html',
    styleUrls: ['./empty-state.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly forgeHero = output<void>();

  private readonly pcService = inject(PCService);
  private readonly pcs = toSignal(this.pcService.pcs$, { initialValue: [] });
  /** Whether there is anything to pick: decides between "pick one" and
   *  "you have none yet". */
  readonly hasCharacters = computed(() => this.pcs().length > 0);
  readonly loadFailed = this.pcService.loadFailed;

  retry(): void {
    this.pcService.refreshPCs();
  }
}
