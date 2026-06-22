import { Component, Input } from '@angular/core';
import { ParticipantView } from '../../../models/session';
import { tintFor } from '../../../utils/character-math';

/**
 * Read-only initiative order — one row per combatant in server-computed turn
 * order, with an Init column, HP bar, AC and conditions. Reuses the Party Vitals
 * Board markup/classes (party-board.component) and adds a current-turn highlight.
 * DM inline controls are layered on in a later feature.
 */
@Component({
  selector: 'app-initiative-panel',
  templateUrl: './initiative-panel.component.html',
  styleUrls: ['./initiative-panel.component.scss'],
})
export class InitiativePanelComponent {
  @Input() participants: ParticipantView[] = [];

  // Same 5-column grid for the header and each row.
  readonly columns = '44px minmax(140px, 1.6fr) 150px 56px minmax(110px, 1.2fr)';

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
