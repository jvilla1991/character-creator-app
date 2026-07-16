import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { PC } from '../../../../models/pc';
import { modFromScore, fmtMod, SKILL_DEFS } from '../../../../utils/character-math';

interface SkillRow {
  name: string;
  abil: string;
  profLevel: 'prof' | 'expert' | null;
  modStr: string;
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

  skillRows: SkillRow[] = [];

  ngOnChanges(): void {
    const prof = this.pc.prof ?? 2;
    this.skillRows = SKILL_DEFS.map(([name, abil]) => {
      // Look up by first word then full name to match prototype data key conventions
      const shortKey  = name.split(' ')[0];
      const lvl       = this.pc.skills?.[shortKey] ?? this.pc.skills?.[name] ?? null;
      const baseMod   = modFromScore(this.pc.stats?.[abil as keyof typeof this.pc.stats] ?? 10);
      const bonus     = lvl === 'expert' ? prof * 2 : lvl === 'prof' ? prof : 0;
      return {
        name,
        abil,
        profLevel: lvl as 'prof' | 'expert' | null,
        modStr:    fmtMod(baseMod + bonus),
      };
    });
  }
}
