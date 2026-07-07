import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore, fmtMod } from '../../../../utils/character-math';
import { DmEditRequest } from '../../dm-edit-modal/dm-edit-request';

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
  /** DM cross-link: makes each ability score click-to-edit. */
  @Input() editable = false;
  @Output() pcChange = new EventEmitter<PC>();
  /** A DM clicked an intercepted ability score — the parent opens the DM edit modal. */
  @Output() editRequested = new EventEmitter<DmEditRequest>();

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

  /** Pure builder: apply one ability score. */
  private buildScore(key: string, value: number): PC {
    const stats = {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
      ...(this.pc.stats ?? {}),
    } as NonNullable<PC['stats']>;
    stats[key as keyof typeof stats] = value;
    return { ...this.pc, stats };
  }

  /** Edit one ability score; the modifier display recomputes on the refresh. */
  setScore(key: string, value: number): void {
    this.pcChange.emit(this.buildScore(key, value));
  }

  /** DM clicked (intercepted) an ability score — request the edit modal instead of
   *  the inline editor. Label is the ability key itself (STR/DEX/…), matching the
   *  backend's own diff vocabulary. */
  requestScore(key: string, score: number): void {
    this.editRequested.emit({
      label: key,
      value: score,
      min: 1,
      max: 30,
      apply: v => this.buildScore(key, v),
    });
  }
}
