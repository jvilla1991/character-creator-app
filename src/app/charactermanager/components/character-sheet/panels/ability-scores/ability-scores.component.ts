import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore } from '../../../../utils/character-math';
import { DmEditRequest } from '../../dm-edit-modal/dm-edit-request';
import { EditableNumberComponent } from '../../editable-number/editable-number.component';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';

interface AbilityRow {
  key: string;
  label: string;
  score: number;
  mod: number;
  isSaveProf: boolean;
}

@Component({
    selector: 'app-ability-scores',
    templateUrl: './ability-scores.component.html',
    styleUrls: ['./ability-scores.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [EditableNumberComponent, ModifierPipe]
})
export class AbilityScoresComponent {
  readonly pc = input.required<PC>();
  /** DM cross-link: makes each ability score click-to-edit. */
  readonly editable = input(false);
  readonly pcChange = output<PC>();
  /** A DM clicked an intercepted ability score — the parent opens the DM edit modal. */
  readonly editRequested = output<DmEditRequest>();

  private static readonly ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
  private static readonly LABELS: Record<string, string> = {
    STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
    INT: 'Intelligence', WIS: 'Wisdom',   CHA: 'Charisma',
  };

  /** Derived per-ability rows — recompute whenever the PC input changes. */
  readonly rows = computed<AbilityRow[]>(() => {
    const pc = this.pc();
    return AbilityScoresComponent.ORDER.map(key => {
      const score = pc.stats?.[key] ?? 10;
      return {
        key,
        label:      AbilityScoresComponent.LABELS[key],
        score,
        mod:        modFromScore(score),
        isSaveProf: pc.saves?.includes(key) ?? false,
      };
    });
  });

  /** Pure builder: apply one ability score. */
  private buildScore(key: string, value: number): PC {
    const pc = this.pc();
    const stats = {
      STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10,
      ...(pc.stats ?? {}),
    } as NonNullable<PC['stats']>;
    stats[key as keyof typeof stats] = value;
    return { ...pc, stats };
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
