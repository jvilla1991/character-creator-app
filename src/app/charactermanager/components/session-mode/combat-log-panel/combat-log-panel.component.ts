import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { CombatLogPage } from '../../../models/session';
import { COMBAT_LOG_PAGE_SIZE, SessionService } from '../../../services/session.service';
import { combatLogPageCount } from '../../../utils/combat-log';

/**
 * Session Mode's "Combat Log" panel, at the bottom of the DM's screen: the
 * health and condition changes made this session, newest first, a page of
 * rows at a time. DM only — the parent renders it for the DM, and the server
 * refuses the read to anyone else (the log names hidden enemies).
 *
 * The rows are written by the server as each change happens and are worded
 * there, so this panel only pages through them. They are not on the poll
 * snapshot: the panel reads its page again whenever the snapshot's `version`
 * moves, because every change worth a row bumps it. Nothing is kept once the
 * session ends — the server empties the log then.
 */
@Component({
  selector: 'app-combat-log-panel',
  templateUrl: './combat-log-panel.component.html',
  styleUrls: ['./combat-log-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
})
export class CombatLogPanelComponent {
  readonly sessionId = input.required<number | string>();
  /** The session snapshot's version — the cue to read the page again. */
  readonly version = input(0);

  private readonly sessionService = inject(SessionService);

  /** The page being shown, zero-based (0 is the newest rows). */
  readonly page = signal(0);
  /** The last page the server gave us; null until the first answer. */
  readonly log = signal<CombatLogPage | null>(null);
  /** The last read failed. The rows already on screen stay there. */
  readonly failed = signal(false);

  readonly entries = computed(() => this.log()?.entries ?? []);
  readonly total = computed(() => this.log()?.total ?? 0);
  readonly pageCount = computed(() =>
    combatLogPageCount(this.total(), this.log()?.size ?? COMBAT_LOG_PAGE_SIZE));

  private readonly requests = new Subject<{ sessionId: number | string; page: number }>();

  constructor() {
    // switchMap: a newer request (a page turn, the next version) drops the
    // answer to an older one, so a slow read can never overwrite a fresh page.
    this.requests.pipe(
      switchMap(request => this.sessionService.getCombatLog(request.sessionId, request.page).pipe(
        map(log => ({ log, failed: false })),
        catchError(() => of({ log: null, failed: true })),
      )),
      takeUntilDestroyed(),
    ).subscribe(result => {
      this.failed.set(result.failed);
      if (!result.log) return;
      // The page we asked for is past the end (the log got shorter): step back
      // to the last real page, which the effect below then reads.
      const lastPage = combatLogPageCount(result.log.total, result.log.size) - 1;
      if (result.log.page > lastPage) {
        this.page.set(lastPage);
        return;
      }
      this.log.set(result.log);
    });

    effect(() => {
      const request = { sessionId: this.sessionId(), page: this.page() };
      this.version(); // read only to run again when it moves
      untracked(() => this.requests.next(request));
    });
  }

  /** Towards the present: the page before this one. */
  newer(): void {
    this.page.update(page => Math.max(0, page - 1));
  }

  /** Back in time: the page after this one. */
  older(): void {
    this.page.update(page => Math.min(this.pageCount() - 1, page + 1));
  }
}
