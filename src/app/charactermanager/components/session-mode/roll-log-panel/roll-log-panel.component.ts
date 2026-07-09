import { Component, Input } from '@angular/core';
import { SessionRollView } from '../../../models/session';

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
})
export class RollLogPanelComponent {
  @Input() rolls: SessionRollView[] = [];
  @Input() dm = false;

  /** Starts open; the DM or a player can collapse it to reclaim vertical space. */
  collapsed = false;

  toggle(): void {
    this.collapsed = !this.collapsed;
  }
}
