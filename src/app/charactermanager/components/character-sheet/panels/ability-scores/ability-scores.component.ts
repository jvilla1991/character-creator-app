import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore, fmtMod } from '../../../../utils/character-math';

interface AbilityRow {
  key: string;
  label: string;
  score: number;
  mod: string;
  isSaveProf: boolean;
}

@Component({
  selector: 'app-ability-scores',
  templateUrl: './ability-scores.component.html',
  styleUrls: ['./ability-scores.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbilityScoresComponent implements OnChanges {
  @Input() pc!: PC;

  rows: AbilityRow[] = [];

  private static readonly ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  private static readonly LABELS: Record<string, string> = {
    STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
    INT: 'Intelligence', WIS: 'Wisdom',   CHA: 'Charisma',
  };

  ngOnChanges(): void {
    this.rows = AbilityScoresComponent.ORDER.map(key => {
      const score = this.pc.stats?.[key as keyof typeof this.pc.stats] ?? 10;
      return {
        key,
        label:      AbilityScoresComponent.LABELS[key],
        score,
        mod:        fmtMod(modFromScore(score)),
        isSaveProf: this.pc.saves?.includes(key as any) ?? false,
      };
    });
  }
}
