import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { RestVoteBallot, RestVoteView } from '../../../models/session';

/**
 * The short-rest vote, in both of its faces (shared countdown + ballot grid):
 *
 * - Player (`dm` false): a deliberately BLOCKING modal — no backdrop-click
 *   close and no escape-close, because the whole table is being asked and the
 *   only exits are voting or the 60s window ending. Yes/No buttons render
 *   while the viewer's own ballot is still unanswered.
 * - DM (`dm` true): a non-blocking inline panel with the same live grid and
 *   the override buttons (Allow = pass now, Deny = fail now) — the DM holds
 *   no ballot, so their word ends the vote instead.
 *
 * The countdown derives from the server-authoritative `expiresAt` on every
 * tick (never a local 60-count), so a backgrounded tab snaps correct on
 * return — same reasoning as the poll-written signals in session-live-banner.
 */
@Component({
    selector: 'app-rest-vote-modal',
    templateUrl: './rest-vote-modal.component.html',
    styleUrls: ['./rest-vote-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CdkTrapFocus]
})
export class RestVoteModalComponent {
  readonly restVote = input.required<RestVoteView>();
  readonly dm = input(false);
  readonly myParticipantId = input<number | null>(null);

  /** The viewer's ballot answer (player face). */
  readonly voteCast = output<boolean>();
  /** The DM's override: true = pass the vote now, false = fail it now. */
  readonly overrideCast = output<boolean>();

  private readonly now = signal(Date.now());

  readonly secondsLeft = computed(() => {
    const deadline = Date.parse(this.restVote().expiresAt);
    return Math.max(0, Math.ceil((deadline - this.now()) / 1000));
  });

  readonly myBallot = computed<RestVoteBallot | null>(() => {
    const id = this.myParticipantId();
    if (id == null) return null;
    return this.restVote().votes.find(b => b.participantId === id) ?? null;
  });

  /** True while the viewer still owes the table an answer. */
  readonly awaitingMyVote = computed(() => this.myBallot()?.vote == null && this.myBallot() != null);

  constructor(destroyRef: DestroyRef) {
    interval(500).pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.now.set(Date.now()));
  }

  /** ✓ / ✕ / ? — the three ballot faces the grid renders. */
  glyph(b: RestVoteBallot): string {
    if (b.vote === true) return '✓';
    if (b.vote === false) return '✕';
    return '?';
  }

  glyphClass(b: RestVoteBallot): string {
    if (b.vote === true) return 'yes';
    if (b.vote === false) return 'no';
    return 'pending';
  }
}
