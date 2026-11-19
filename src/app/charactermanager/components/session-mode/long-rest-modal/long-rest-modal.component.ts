import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModalComponent } from '../../modal/modal.component';
import { LongRestView } from '../../../models/session';
import { PC } from '../../../models/pc';
import { longRestPreview, ordinal } from '../../../utils/long-rest';

/**
 * A seated player's long rest screen, shown while the session's long rest
 * phase is open. BLOCKING like the rest vote (no close button, no Escape):
 * the table is resting together, and the only way on is Ready, the DM
 * finishing the rest, or the DM interrupting it.
 *
 * Nothing here has happened yet. Recovery is applied for the whole party when
 * the rest finishes, so the numbers are what the rest WILL restore, worked
 * out from the hero's sheet as it stands ({@link longRestPreview}).
 *
 * Two projection slots keep the later slices out of this file:
 * `[longRestRestored]` appends to the recovery summary (slice 3: class
 * features), and `[longRestChoices]` sits between the summary and Ready
 * (slice 2: prepared spells, rune weapon).
 */
@Component({
  selector: 'app-long-rest-modal',
  templateUrl: './long-rest-modal.component.html',
  styleUrls: ['./long-rest-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
})
export class LongRestModalComponent {
  readonly longRest = input.required<LongRestView>();
  /** The viewer's own seated hero, with the live HP/slot values overlaid. */
  readonly pc = input.required<PC>();
  readonly myParticipantId = input<number | null>(null);
  /**
   * Why Ready is not available yet (a choice the hero still has to make), or
   * null. Shown beside the disabled button.
   */
  readonly readyBlocked = input<string | null>(null);
  /** Temporary Hit Points the rest will leave the hero with (the Blood Rune's). */
  readonly tempHpAfter = input(0);

  /** The viewer marks their hero ready (true) or takes it back (false). */
  readonly readyChange = output<boolean>();

  readonly preview = computed(() => longRestPreview(this.pc()));

  private readonly mine = computed(() => {
    const id = this.myParticipantId();
    return id == null ? null : this.longRest().readiness.find(r => r.participantId === id) ?? null;
  });

  readonly ready = computed(() => this.mine()?.ready === true);

  /** The server's word wins; the sheet is the fallback before the first poll. */
  readonly cannotRest = computed(() => this.mine()?.cannotRest ?? this.preview().cannotRest);

  /** Width of the bar's "now" segment, as a percentage of maximum. */
  readonly hpNowPercent = computed(() => {
    const p = this.preview();
    return p.hpMax > 0 ? Math.min(100, Math.round((p.hpNow / p.hpMax) * 100)) : 0;
  });

  readonly hpBarLabel = computed(() => {
    const p = this.preview();
    return p.hpGain > 0
      ? `Hit Points go from ${p.hpNow} to ${p.hpMax}`
      : `Hit Points are full at ${p.hpMax}`;
  });

  readonly ordinal = ordinal;
}
