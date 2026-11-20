import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsListComponent, SkillProfChange } from './skills-list.component';
import { PC } from '../../../../models/pc';
import { AdjustableStat } from '../../../../models/stat-adjustment';

describe('SkillsListComponent', () => {
  let fixture: ComponentFixture<SkillsListComponent>;
  let component: SkillsListComponent;
  let emitted: SkillProfChange[];

  const basePc = (skills: PC['skills'] = {}): PC =>
    ({
      id: 1, name: 'X', clazz: 'Rogue', level: 4, playerName: 'P', prof: 2,
      stats: { STR: 10, DEX: 16, CON: 12, INT: 8, WIS: 14, CHA: 10 },
      skills,
    } as PC);

  const setPc = (pc: PC) => fixture.componentRef.setInput('pc', pc);

  beforeEach(() => {
    fixture = TestBed.createComponent(SkillsListComponent);
    component = fixture.componentInstance;
    setPc(basePc());
    fixture.componentRef.setInput('editable', true);
    emitted = [];
    component.skillChanged.subscribe(ev => emitted.push(ev));
  });

  describe('cycleSkill', () => {
    it('cycles none -> prof', () => {
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills?.['Stealth']).toBe('prof');
    });

    it('cycles prof -> expert', () => {
      setPc(basePc({ Stealth: 'prof' }));
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills?.['Stealth']).toBe('expert');
    });

    it('cycles expert -> none (key removed entirely)', () => {
      setPc(basePc({ Stealth: 'expert' }));
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills).toEqual({});
    });

    it('reads a short-form key and rewrites it under the canonical name', () => {
      setPc(basePc({ Animal: 'prof' }));
      component.cycleSkill('Animal Handling');
      expect(emitted[0].pc.skills).toEqual({ 'Animal Handling': 'expert' });
    });

    it('never mutates the input PC (demo mode hands out the live store object)', () => {
      const pc = basePc({ Insight: 'prof' });
      setPc(pc);
      component.cycleSkill('Insight');
      expect(pc.skills).toEqual({ Insight: 'prof' });
      expect(emitted[0].pc).not.toBe(pc);
    });

    it('preserves unrelated skills', () => {
      setPc(basePc({ Perception: 'prof', Deception: 'expert' }));
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills).toEqual({ Perception: 'prof', Deception: 'expert', Stealth: 'prof' });
    });

    it('describes the change for the DM activity log', () => {
      setPc(basePc({ Stealth: 'prof' }));
      component.cycleSkill('Stealth');
      expect(emitted[0].description).toBe('Skill proficiency changed: Stealth (expertise)');
    });

    it('does nothing when not editable (player viewing their own sheet)', () => {
      fixture.componentRef.setInput('editable', false);
      component.cycleSkill('Stealth');
      expect(emitted.length).toBe(0);
    });
  });

  describe('skillRows modifier math', () => {
    it('applies prof and expertise bonuses to the displayed modifier', () => {
      setPc(basePc({ Stealth: 'expert', Acrobatics: 'prof' }));
      const row = (name: string) => component.skillRows().find(r => r.name === name)!;
      expect(row('Stealth').mod).toBe(7);    // DEX +3, expertise +4
      expect(row('Acrobatics').mod).toBe(5); // DEX +3, prof +2
      expect(row('Athletics').mod).toBe(0);  // STR +0, no prof
    });
  });

  describe('modifier breakdown', () => {
    let requested: AdjustableStat[];
    const rowNamed = (name: string): HTMLElement =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.skill'))
        .find(row => row.querySelector('.skill-name')?.textContent?.trim() === name)!;

    beforeEach(() => {
      requested = [];
      component.breakdownRequested.subscribe(stat => requested.push(stat));
    });

    it('includes the DM lines on a skill in its modifier', () => {
      setPc({ ...basePc({ Perception: 'prof' }), statAdjustments: { skillPerception: [{ value: 1, label: 'Observant' }] } });
      expect(component.skillRows().find(r => r.name === 'Perception')!.mod).toBe(5); // WIS +2, prof +2, +1
    });

    it('opens the skill breakdown from the modifier, for a player who cannot change it', () => {
      fixture.componentRef.setInput('editable', false);
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.detectChanges();
      const button: HTMLButtonElement = rowNamed('Animal Handling').querySelector('.skill-mod button')!;
      expect(button.textContent?.trim()).toBe('+2');
      expect(button.getAttribute('aria-label')).toBe('Animal Handling +2. Show how it is worked out');
      button.click();
      expect(requested).toEqual(['skillAnimalHandling']);
    });

    it('names Sleight of Hand in full and says the DM can adjust it', () => {
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.componentRef.setInput('canAdjust', true);
      fixture.detectChanges();
      const button: HTMLButtonElement = rowNamed('Sleight').querySelector('.skill-mod button')!;
      expect(button.getAttribute('aria-label')).toBe('Sleight of Hand +3. Show how it is worked out and adjust it');
      expect(button.classList).toContain('adjustable');
    });

    it('keeps the DM proficiency toggle and the breakdown on separate buttons', () => {
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.detectChanges();
      const row = rowNamed('Stealth');
      const toggle: HTMLButtonElement = row.querySelector('.skill-toggle')!;
      expect(toggle.getAttribute('aria-label')).toBe('Cycle Stealth proficiency');
      toggle.click();
      expect(emitted.map(e => e.pc.skills?.['Stealth'])).toEqual(['prof']);
      expect(requested).toEqual([]);

      (row.querySelector('.skill-mod button') as HTMLButtonElement).click();
      expect(requested).toEqual(['skillStealth']);
      expect(emitted.length).toBe(1);
    });

    it('has no toggle for a viewer who may not change proficiency', () => {
      fixture.componentRef.setInput('editable', false);
      fixture.componentRef.setInput('breakdownEnabled', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.skill-toggle')).toBeNull();
      expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
    });

    it('shows a plain modifier with no breakdown for a follower', () => {
      fixture.componentRef.setInput('breakdownEnabled', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.skill-mod button')).toBeNull();
      expect(rowNamed('Stealth').querySelector('.skill-mod')?.textContent?.trim()).toBe('+3');
      component.openBreakdown(component.skillRows()[0]);
      expect(requested).toEqual([]);
    });
  });
});
