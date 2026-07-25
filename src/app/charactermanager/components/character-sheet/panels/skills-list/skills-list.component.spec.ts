import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkillsListComponent, SkillProfChange } from './skills-list.component';
import { PC } from '../../../../models/pc';

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
});
