import { Component, Input } from '@angular/core';
import { ParticipantView } from '../../../models/session';
import { SessionService } from '../../../services/session.service';
import { NotificationService } from '../../../services/notification.service';
import { tintFor } from '../../../utils/character-math';

/**
 * Initiative order — one row per combatant in server-computed turn order, with
 * an Init column, HP bar, AC and conditions. Reuses the Party Vitals Board
 * markup/classes (party-board.component) and adds a current-turn highlight.
 *
 * When the viewer is the DM, the Init cell becomes editable and a per-row
 * damage/heal control appears; both call the server (state stays
 * authoritative — the service updates the snapshot the panel re-renders from).
 */
@Component({
  selector: 'app-initiative-panel',
  templateUrl: './initiative-panel.component.html',
  styleUrls: ['./initiative-panel.component.scss'],
})
export class InitiativePanelComponent {
  @Input() participants: ParticipantView[] = [];
  @Input() sessionId!: number | string;
  @Input() dm = false;

  /** Per-row amount typed into the DM's damage/heal box, keyed by participant id. */
  amounts: { [participantId: number]: number | null } = {};

  /** Per-row XP amount typed into the DM's award box, keyed by participant id. */
  xpAmounts: { [participantId: number]: number | null } = {};

  /** Amount typed into the panel-level "award XP to all" box. */
  xpAll: number | null = null;

  constructor(
    private sessionService: SessionService,
    private notifications: NotificationService,
  ) {}

  // 5 columns read-only; a 6th DM "Adjust" column appears for the DM.
  get columns(): string {
    const base = '44px minmax(140px, 1.6fr) 150px 56px minmax(110px, 1.2fr)';
    return this.dm ? `${base} 184px` : base;
  }

  onInitiative(p: ParticipantView, raw: string): void {
    const value = parseInt(raw, 10);
    if (isNaN(value)) return;
    this.sessionService.setInitiative(this.sessionId, p.participantId, value).subscribe({
      error: err => console.error('Failed to set initiative', err),
    });
  }

  /** Apply the row's typed amount as damage (sign +1) or healing (sign -1). */
  adjustHp(p: ParticipantView, sign: 1 | -1): void {
    const amt = this.amounts[p.participantId];
    if (amt == null || amt <= 0) return;
    this.sessionService.applyDamage(this.sessionId, p.participantId, sign * amt).subscribe({
      next: () => (this.amounts[p.participantId] = null),
      error: err => console.error('Failed to adjust HP', err),
    });
  }

  /** Award the row's typed XP to that PC, then toast the new total. */
  giveXp(p: ParticipantView): void {
    const amt = this.xpAmounts[p.participantId];
    if (amt == null || amt === 0) return;
    this.sessionService.awardXp(this.sessionId, p.participantId, amt).subscribe({
      next: result => {
        this.xpAmounts[p.participantId] = null;
        const e = result.awarded[0];
        if (e) this.notifications.notify(`${e.name}: ${e.xp} XP (${this.signed(e.delta)})`);
      },
      error: err => console.error('Failed to award XP', err),
    });
  }

  /** Award the same XP amount to every seated PC, then toast the count. */
  giveXpToAll(): void {
    const amt = this.xpAll;
    if (amt == null || amt === 0) return;
    this.sessionService.awardXpToAll(this.sessionId, amt).subscribe({
      next: result => {
        this.xpAll = null;
        const n = result.awarded.length;
        this.notifications.notify(`Awarded ${this.signed(amt)} XP to ${n} character${n === 1 ? '' : 's'}`);
      },
      error: err => console.error('Failed to award XP to all', err),
    });
  }

  /** Format a delta with an explicit sign for the toast (e.g. +500, -100). */
  private signed(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  tintFor(p: ParticipantView): string {
    return tintFor({ portraitTint: p.portraitTint } as any);
  }

  initialsFor(p: ParticipantView): string {
    return (p.portraitInitials || p.name.slice(0, 2)).toUpperCase();
  }

  hpPct(p: ParticipantView): number {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  }

  bloodied(p: ParticipantView): boolean {
    const max = p.hpMax ?? 0;
    const cur = p.hpCurrent ?? 0;
    return max > 0 && cur <= max / 2;
  }

  trackByParticipant(_: number, p: ParticipantView): number {
    return p.participantId;
  }
}
