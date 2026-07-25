import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore, SKILL_DEFS } from '../../../../utils/character-math';
import { ModifierPipe } from '../../../../pipes/modifier.pipe';

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
  readonly skillChanged = output<SkillProfChange>();

  /** Derived skill rows — recompute whenever the PC input changes. */
  readonly skillRows = computed<SkillRow[]>(() => {
    const pc = this.pc();
    const prof = pc.prof ?? 2;
    return SKILL_DEFS.map(([name, abil]) => {
      const lvl     = this.levelFor(name);
      const baseMod = modFromScore(pc.stats?.[abil as keyof typeof pc.stats] ?? 10);
      const bonus   = lvl === 'expert' ? prof * 2 : lvl === 'prof' ? prof : 0;
      return {
        name,
        abil,
        profLevel: lvl,
        mod:       baseMod + bonus,
      };
    });
  });

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
    const current = this.levelFor(name);
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

  /** Look up by first word then full name to match prototype data key conventions. */
  private levelFor(name: string): 'prof' | 'expert' | null {
    const skills = this.pc().skills;
    const shortKey = name.split(' ')[0];
    return skills?.[shortKey] ?? skills?.[name] ?? null;
  }
}
