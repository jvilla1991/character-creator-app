import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { AdjustableStat, signed, skillStat } from '../../../../models/stat-adjustment';
import { SKILL_DEFS, skillFullName, skillLevel, skillModifier } from '../../../../utils/character-math';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

interface SkillRow {
  name: string;
  abil: string;
  profLevel: 'prof' | 'expert' | null;
  mod: number;
}

/** A DM cycled a skill's proficiency marker: the fully-updated PC plus a
 *  DM-authored activity-log line describing the change. */
export interface SkillProfChange {
  pc: PC;
  description: string;
}

@Component({
    selector: 'app-skills-list',
    templateUrl: './skills-list.component.html',
    styleUrls: ['./skills-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ModifierPipe]
})
export class SkillsListComponent {
  readonly pc = input.required<PC>();
  /** DM cross-link: makes each proficiency dot click-to-cycle (none → prof → expertise). */
  readonly editable = input(false);
  /** Each skill's modifier opens its breakdown. Off for a follower, whose
   *  skills are typed stat-block values with no lines. */
  readonly breakdownEnabled = input(false);
  /** The viewer may change the lines in that breakdown (the DM, or the owner of a
   *  character that is in no campaign). Only changes the affordance here; the
   *  parent decides what the dialog allows. */
  readonly canAdjust = input(false);
  readonly skillChanged = output<SkillProfChange>();
  /** Anyone clicked a skill's modifier — the parent opens the breakdown dialog. */
  readonly breakdownRequested = output<AdjustableStat>();

  /** Derived skill rows — recompute whenever the PC input changes. The
   *  modifier includes any lines the DM added to the skill. */
  readonly skillRows = computed<SkillRow[]>(() => {
    const pc = this.pc();
    return SKILL_DEFS.map(([name, abil]) => ({
      name,
      abil,
      profLevel: skillLevel(pc, name),
      mod:       skillModifier(pc, name, abil as Ability),
    }));
  });

  /** Spoken name of a modifier's button: the skill and value, then what activating it does. */
  modButtonLabel(row: SkillRow): string {
    const what = `${skillFullName(row.name)} ${signed(row.mod)}. Show how it is worked out`;
    return this.canAdjust() ? `${what} and adjust it` : what;
  }

  openBreakdown(row: SkillRow): void {
    if (!this.breakdownEnabled()) return;
    this.breakdownRequested.emit(skillStat(row.name));
  }

  /**
   * Cycle one skill's proficiency: none → prof → expert → none. Emits an
   * updated PC (never mutates the input — demo mode hands out the live store
   * object) plus a log description; the sheet persists via the DM path. The
   * template only wires clicks when `editable`, but guard anyway so a stray
   * call can never fire a player-side save.
   */
  cycleSkill(name: string): void {
    if (!this.editable()) return;
    const pc = this.pc();
    const current = skillLevel(pc, name);
    const next: 'prof' | 'expert' | null =
      current === null ? 'prof' : current === 'prof' ? 'expert' : null;

    // Stored keys may use either the full name or its first word ("Animal" for
    // "Animal Handling") — drop both variants, then write the canonical name.
    const skills = { ...(pc.skills ?? {}) };
    delete skills[name];
    delete skills[name.split(' ')[0]];
    if (next) skills[name] = next;

    const label = next === 'expert' ? 'expertise' : next === 'prof' ? 'proficient' : 'none';
    this.skillChanged.emit({
      pc: { ...pc, skills },
      description: `Skill proficiency changed: ${name} (${label})`,
    });
  }
}
