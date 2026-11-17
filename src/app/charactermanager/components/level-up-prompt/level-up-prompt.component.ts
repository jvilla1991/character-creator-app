import { Component, OnDestroy, inject } from '@angular/core';
import { LevelUpPromptService } from '../../services/level-up-prompt.service';
import { SessionService } from '../../services/session.service';
import { UiStateService } from '../../services/ui-state.service';
import { ModalComponent } from '../modal/modal.component';
import { LevelUpModalComponent } from '../level-up-modal/level-up-modal.component';

/**
 * Shell-level host for the level-up experience, mounted once beside the dice
 * roller so it works on every screen — the standalone sheet and the live
 * session alike:
 *
 * - the gold viewport glow (always in the DOM so it can fade in and out);
 * - the "Level up" prompt dialog ("Level Up Now" / "Later");
 * - the app's single level-up modal, opened by the prompt or by the sheet's
 *   Level Up button.
 *
 * State lives in LevelUpPromptService; this component only renders it.
 */
@Component({
  selector: 'app-level-up-prompt',
  templateUrl: './level-up-prompt.component.html',
  styleUrls: ['./level-up-prompt.component.scss'],
  imports: [ModalComponent, LevelUpModalComponent],
})
export class LevelUpPromptComponent implements OnDestroy {
  protected readonly levelUp = inject(LevelUpPromptService);
  private readonly sessionService = inject(SessionService);
  private readonly uiState = inject(UiStateService);

  /**
   * The modal closed (committed or cancelled). Inside a live session, the
   * level-up went through the PC endpoint, which doesn't bump the session
   * version — so the poll's sinceVersion short-circuit would keep showing the
   * old level/HP. Force one refetch, as the inspiration spend does.
   */
  closeLevelUp(): void {
    this.levelUp.closeLevelUp();
    if (this.uiState.activeSessionId() !== null) this.sessionService.refresh();
  }

  ngOnDestroy(): void {
    this.levelUp.reset();
  }
}
