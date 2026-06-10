import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PC } from '../../../models/pc';
import { passiveScore, tintFor } from '../../../utils/character-math';

/**
 * Party Vitals Board — one row per campaign member with HP bar, AC, passive
 * Perception/Insight and conditions. Clicking a row opens that hero's sheet.
 */
@Component({
  selector: 'app-party-board',
  templateUrl: './party-board.component.html',
})
export class PartyBoardComponent {
  @Input() members: PC[] = [];
  @Output() openHero = new EventEmitter<PC>();

  tintFor(pc: PC): string { return tintFor(pc); }

  initialsFor(pc: PC): string {
    return (pc.portraitInitials || pc.name.slice(0, 2)).toUpperCase();
  }

  hpPct(pc: PC): number {
    const max = pc.hp?.max ?? 0;
    const cur = pc.hp?.cur ?? 0;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (cur / max) * 100));
  }

  bloodied(pc: PC): boolean {
    const max = pc.hp?.max ?? 0;
    const cur = pc.hp?.cur ?? 0;
    return max > 0 && cur <= max / 2;
  }

  passivePerception(pc: PC): number { return passiveScore(pc, 'Perception', 'WIS'); }
  passiveInsight(pc: PC): number { return passiveScore(pc, 'Insight', 'WIS'); }
}
