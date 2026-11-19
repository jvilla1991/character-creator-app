import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../modal/modal.component';
import { RestType } from '../../../models/session';

/**
 * The player's "Rest" dialog: pick a short or a long rest, then call the
 * party vote for it. Choosing only selects; the vote opens on the primary
 * button, so a mis-tap on a card costs nothing.
 */
@Component({
  selector: 'app-rest-chooser',
  templateUrl: './rest-chooser.component.html',
  styleUrls: ['./rest-chooser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
})
export class RestChooserComponent {
  /** The rest the player called a vote for. */
  readonly chosen = output<RestType>();
  /** Cancel, the close button, Escape or a backdrop click. */
  readonly dismissed = output<void>();

  /**
   * Why a long rest cannot be called right now (one every 24 hours on the
   * campaign clock), or null. The Long Rest card is then disabled and shows
   * this instead of what the rest does.
   */
  readonly longRestBlocked = input<string | null>(null);

  private readonly picked = signal<RestType>('SHORT');
  /** The chosen rest — never the long rest while it is unavailable. */
  readonly selected = computed<RestType>(() =>
    (this.picked() === 'LONG' && this.longRestBlocked() ? 'SHORT' : this.picked()));

  select(rest: RestType): void {
    if (rest === 'LONG' && this.longRestBlocked()) return;
    this.picked.set(rest);
  }
}
