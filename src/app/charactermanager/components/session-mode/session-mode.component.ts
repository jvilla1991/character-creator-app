import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';

/**
 * Session Mode screen — a full-width overlay (chosen in the sidenav over the
 * Player/DM views via UiState.activeSessionId$) showing the live initiative
 * order. Subscribes to the server-authoritative snapshot and polls while open.
 *
 * This feature renders the read-only order; DM controls (initiative entry,
 * damage) arrive in a later feature.
 */
@Component({
  selector: 'app-session-mode',
  templateUrl: './session-mode.component.html',
  styleUrls: ['./session-mode.component.scss'],
})
export class SessionModeComponent implements OnInit, OnDestroy {
  @Input() sessionId!: string;

  state$ = this.sessionService.state$;

  constructor(
    private sessionService: SessionService,
    private uiState: UiStateService,
  ) {}

  ngOnInit(): void {
    this.sessionService.startPolling(this.sessionId);
  }

  ngOnDestroy(): void {
    this.sessionService.stopPolling();
  }

  /** Leave the session screen (does not end the session server-side). */
  close(): void {
    this.sessionService.clear();
    this.uiState.closeSession();
  }
}
