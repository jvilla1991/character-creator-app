import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LongRestReadiness, LongRestView, ParticipantView } from '../../../models/session';
import { longRestClassName } from '../../../utils/long-rest';

/** One party row: who, what the rest gives them, and where they are. */
interface HeroRow {
  participantId: number;
  name: string;
  detail: string;
  status: 'ready' | 'waiting' | 'down';
  statusLabel: string;
}

/**
 * The DM's side of an open long rest: who is ready, the rest's options, and
 * the two ways it ends. Sits in the normal panel flow like the DM's rest-vote
 * banner (non-blocking — the DM keeps running the table).
 *
 * Presentational: every change is emitted, and the next snapshot redraws it.
 */
@Component({
  selector: 'app-long-rest-panel',
  templateUrl: './long-rest-panel.component.html',
  styleUrls: ['./long-rest-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongRestPanelComponent {
  readonly longRest = input.required<LongRestView>();
  /** The session's combatants, for each hero's class, level and Hit Points. */
  readonly participants = input<ParticipantView[]>([]);
  /** Survival campaigns choose whether the rest was undisturbed. */
  readonly survivalConditions = input(false);

  /** Only the option that changed is sent. */
  readonly optionsChange = output<{ advanceClock?: boolean; undisturbed?: boolean }>();
  readonly finish = output<void>();
  readonly interrupt = output<void>();

  readonly rows = computed<HeroRow[]>(() => {
    const byId = new Map(this.participants().map(p => [p.participantId, p]));
    return this.longRest().readiness.map(r => this.toRow(r, byId.get(r.participantId)));
  });

  private toRow(r: LongRestReadiness, p: ParticipantView | undefined): HeroRow {
    const parts: string[] = [];
    // The hero's class by its short name (Death Knight, not Paladin); the seat's
    // own class is the fallback for a backend that does not send the details.
    const clazz = r.clazz ? longRestClassName(r.clazz, r.subclass, r.specialization) : p?.clazz;
    const level = r.level ?? p?.level;
    if (clazz) parts.push(level != null ? `${clazz} ${level}` : clazz);
    if (!r.cannotRest && p?.hpMax != null && p.hpCurrent != null && p.hpMax > p.hpCurrent) {
      parts.push(`+${p.hpMax - p.hpCurrent} HP`);
    }
    const status = r.cannotRest ? 'down' : r.ready ? 'ready' : 'waiting';
    return {
      participantId: r.participantId,
      name: r.displayName,
      detail: parts.join(' · '),
      status,
      statusLabel: status === 'down' ? 'At 0 Hit Points' : status === 'ready' ? '✓ Ready' : 'Getting ready',
    };
  }

  onAdvanceClock(event: Event): void {
    this.optionsChange.emit({ advanceClock: (event.target as HTMLInputElement).checked });
  }

  setUndisturbed(undisturbed: boolean): void {
    if (undisturbed !== this.longRest().undisturbed) this.optionsChange.emit({ undisturbed });
  }
}
