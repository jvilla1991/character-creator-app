import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
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

  readonly selected = signal<RestType>('SHORT');
}
