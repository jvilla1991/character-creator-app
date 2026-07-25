import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { SessionRollView } from '../../../models/session';
import { DatePipe } from '@angular/common';

/**
 * Session Mode's "Roll Log" panel — a collapsible, newest-first feed of dice
 * rolls made this session. Rendered for both the DM and players; the server
 * has already filtered `rolls` per viewer (DM sees every roll, a player sees
 * only their own), so this component does zero additional filtering — no
 * client-side trust boundary to get wrong.
 */
@Component({
    selector: 'app-roll-log-panel',
    templateUrl: './roll-log-panel.component.html',
    styleUrls: ['./roll-log-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DatePipe]
})
export class RollLogPanelComponent {
  readonly rolls = input<SessionRollView[]>([]);
  readonly dm = input(false);

  /** Starts open; the DM or a player can collapse it to reclaim vertical space. */
  readonly collapsed = signal(false);

  toggle(): void {
    this.collapsed.update(collapsed => !collapsed);
  }
}
