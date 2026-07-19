import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore, fmtMod, SKILL_DEFS } from '../../../../utils/character-math';

interface SkillRow {
  name: string;
  abil: string;
  profLevel: 'prof' | 'expert' | null;
  modStr: string;
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
    standalone: false
})
export class SkillsListComponent implements OnChanges {
  @Input() pc!: PC;
  /** DM cross-link: makes each proficiency dot click-to-cycle (none → prof → expertise). */
  @Input() editable = false;
  @Output() skillChanged = new EventEmitter<SkillProfChange>();

  skillRows: SkillRow[] = [];

  ngOnChanges(): void {
    const prof = this.pc.prof ?? 2;
    this.skillRows = SKILL_DEFS.map(([name, abil]) => {
      const lvl     = this.levelFor(name);
      const baseMod = modFromScore(this.pc.stats?.[abil as keyof typeof this.pc.stats] ?? 10);
      const bonus   = lvl === 'expert' ? prof * 2 : lvl === 'prof' ? prof : 0;
      return {
        name,
        abil,
        profLevel: lvl,
        modStr:    fmtMod(baseMod + bonus),
      };
    });
  }

  /**
   * Cycle one skill's proficiency: none → prof → expert → none. Emits an
   * updated PC (never mutates the input — demo mode hands out the live store
   * object) plus a log description; the sheet persists via the DM path. The
   * template only wires clicks when `editable`, but guard anyway so a stray
   * call can never fire a player-side save.
   */
  cycleSkill(name: string): void {
    if (!this.editable) return;
    const current = this.levelFor(name);
    const next: 'prof' | 'expert' | null =
      current === null ? 'prof' : current === 'prof' ? 'expert' : null;

    // Stored keys may use either the full name or its first word ("Animal" for
    // "Animal Handling") — drop both variants, then write the canonical name.
    const skills = { ...(this.pc.skills ?? {}) };
    delete skills[name];
    delete skills[name.split(' ')[0]];
    if (next) skills[name] = next;

    const label = next === 'expert' ? 'expertise' : next === 'prof' ? 'proficient' : 'none';
    this.skillChanged.emit({
      pc: { ...this.pc, skills },
      description: `Skill proficiency changed: ${name} (${label})`,
    });
  }

  /** Look up by first word then full name to match prototype data key conventions. */
  private levelFor(name: string): 'prof' | 'expert' | null {
    const shortKey = name.split(' ')[0];
    return this.pc.skills?.[shortKey] ?? this.pc.skills?.[name] ?? null;
  }
}
