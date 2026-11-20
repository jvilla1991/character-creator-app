import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CampaignFaction, factionPickerRows } from '../../../models/renown';
import { ParticipantView } from '../../../models/session';
import { NotificationService } from '../../../services/notification.service';
import { RenownService } from '../../../services/renown.service';
import { SessionService } from '../../../services/session.service';

export type RewardType = 'xp' | 'renown';

/**
 * DM-only reward bar under the initiative board: "Reward [XP | Renown]
 * [faction] [amount] to the following characters", with one checkbox per
 * seated player character. It replaces the old "Award XP to all" box; the
 * per-row +XP boxes on the board are untouched.
 *
 * Everyone starts ticked, so rewarding the whole party is still one amount and
 * one click. The bar remembers who was UNticked rather than who was ticked:
 * a character who joins mid-session is then ticked by default, and one who
 * leaves simply drops off the list.
 *
 * Renown reads the campaign's factions each time the DM switches to it, so a
 * faction created a moment ago on a character's Renown tab is already there.
 * A reward changes only the faction picked, never its parent or subfactions.
 */
@Component({
  selector: 'app-reward-bar',
  templateUrl: './reward-bar.component.html',
  styleUrls: ['./reward-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class RewardBarComponent {
  readonly sessionId = input.required<number | string>();
  readonly campaignId = input.required<number | string>();
  /** Every combatant in the session; enemies are filtered out here. */
  readonly participants = input<ParticipantView[]>([]);

  private readonly sessionService = inject(SessionService);
  private readonly renownService = inject(RenownService);
  private readonly notifications = inject(NotificationService);

  readonly type = signal<RewardType>('xp');
  readonly factionId = signal<number | null>(null);
  readonly amount = signal<number | null>(null);
  readonly busy = signal(false);

  readonly factions = signal<CampaignFaction[]>([]);
  /** False until the first faction read answers, so "No factions yet" never flashes. */
  readonly factionsLoaded = signal(false);
  private factionRead: Subscription | null = null;

  /** Participant ids the DM has unticked. */
  readonly unticked = signal<ReadonlySet<number>>(new Set());

  /** The seated player characters: the only rows that can be rewarded. */
  readonly characters = computed(() => this.participants().filter(p => !p.npc && p.pcId != null));
  readonly ticked = computed(() => this.characters().filter(p => !this.unticked().has(p.participantId)));
  /** Picker rows: a subfaction is indented under its parent with
   *  non-breaking spaces (an option's text cannot be styled). */
  readonly factionRows = computed(() => factionPickerRows(this.factions()).map(row => ({
    id: row.faction.id,
    label: (row.child ? '\u00a0\u00a0\u00a0\u00a0' : '') + row.faction.name,
  })));

  /** The typed amount when it can be sent: a whole number other than 0, and
   *  for renown no further than 200 either way (the server's own limit). */
  readonly validAmount = computed(() => {
    const amount = this.amount();
    if (amount == null || !Number.isInteger(amount) || amount === 0) return null;
    if (this.type() === 'renown' && Math.abs(amount) > 200) return null;
    return amount;
  });

  readonly chosenFaction = computed(() => this.factions().find(f => f.id === this.factionId()) ?? null);

  readonly ready = computed(() =>
    !this.busy() && this.ticked().length > 0 && this.validAmount() != null
    && (this.type() === 'xp' || this.chosenFaction() != null));

  readonly buttonLabel = computed(() => {
    const count = this.ticked().length;
    return count ? `Reward ${this.people(count)}` : 'Reward';
  });

  setType(type: RewardType): void {
    this.type.set(type);
    if (type === 'renown') this.loadFactions();
  }

  toggle(participantId: number): void {
    const next = new Set(this.unticked());
    if (!next.delete(participantId)) next.add(participantId);
    this.unticked.set(next);
  }

  selectAll(): void {
    this.unticked.set(new Set());
  }

  clear(): void {
    this.unticked.set(new Set(this.characters().map(p => p.participantId)));
  }

  give(): void {
    const amount = this.validAmount();
    if (!this.ready() || amount == null) return;
    if (this.type() === 'xp') this.giveXp(amount);
    else this.giveRenown(amount);
  }

  private giveXp(amount: number): void {
    const ids = this.ticked().map(p => p.participantId);
    this.busy.set(true);
    this.sessionService.awardXpToMany(this.sessionId(), amount, ids).subscribe({
      next: result => {
        this.done();
        this.notifications.notify(this.summary(amount, 'XP', result.awarded.length));
      },
      // The typed amount and the ticks stay, ready to resend.
      error: err => {
        this.busy.set(false);
        this.notifications.error('Could not reward the XP. Try again.', err);
      },
    });
  }

  private giveRenown(amount: number): void {
    const faction = this.chosenFaction();
    if (!faction) return;
    const recipients = this.ticked()
      .map(p => ({ participantId: p.participantId, pcId: p.pcId as number, name: p.name }));
    this.busy.set(true);
    this.renownService
      .awardInSession(this.sessionId(), String(this.campaignId()), faction.id, amount, recipients)
      .subscribe({
        next: result => {
          this.done();
          this.notifications.notify(this.summary(amount, `${faction.name} renown`, result.awarded.length));
        },
        error: err => {
          this.busy.set(false);
          this.notifications.error('Could not reward the renown. Try again.', err);
          // The faction may have been removed since the list was read.
          this.loadFactions();
        },
      });
  }

  /** After a reward lands: empty the amount, keep the type, faction and ticks. */
  private done(): void {
    this.busy.set(false);
    this.amount.set(null);
  }

  private loadFactions(): void {
    this.factionRead?.unsubscribe();
    this.factionRead = this.renownService
      .campaignFactions(this.sessionId(), String(this.campaignId()))
      .subscribe({
        next: factions => {
          this.factions.set(factions);
          this.factionsLoaded.set(true);
          // Forget a pick that is no longer in the campaign.
          if (!factions.some(f => f.id === this.factionId())) this.factionId.set(null);
        },
        error: err => {
          this.factions.set([]);
          this.factionsLoaded.set(false);
          this.notifications.error('Could not load the factions. Try again.', err);
        },
      });
  }

  /** "Awarded 50 XP to 3 characters" / "Removed 2 Kirin Tor renown from 1 character". */
  private summary(amount: number, what: string, count: number): string {
    return amount > 0
      ? `Awarded ${amount} ${what} to ${this.people(count)}`
      : `Removed ${Math.abs(amount)} ${what} from ${this.people(count)}`;
  }

  private people(count: number): string {
    return `${count} character${count === 1 ? '' : 's'}`;
  }
}
