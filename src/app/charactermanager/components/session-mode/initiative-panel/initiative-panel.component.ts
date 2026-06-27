import { Component, Input } from '@angular/core';
import { ParticipantView } from '../../../models/session';
import { SessionService } from '../../../services/session.service';
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

  constructor(private sessionService: SessionService) {}

  // 5 columns read-only; a 6th DM "Adjust" column appears for the DM.
  get columns(): string {
    const base = '44px minmax(140px, 1.6fr) 150px 56px minmax(110px, 1.2fr)';
    return this.dm ? `${base} 168px` : base;
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
