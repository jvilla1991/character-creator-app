import { SkillsListComponent, SkillProfChange } from './skills-list.component';
import { PC } from '../../../../models/pc';

describe('SkillsListComponent', () => {
  let component: SkillsListComponent;
  let emitted: SkillProfChange[];

  const basePc = (skills: PC['skills'] = {}): PC =>
    ({
      id: 1, name: 'X', clazz: 'Rogue', level: 4, playerName: 'P', prof: 2,
      stats: { STR: 10, DEX: 16, CON: 12, INT: 8, WIS: 14, CHA: 10 },
      skills,
    } as PC);

  beforeEach(() => {
    component = new SkillsListComponent();
    component.pc = basePc();
    component.editable = true;
    component.ngOnChanges();
    emitted = [];
    component.skillChanged.subscribe(ev => emitted.push(ev));
  });

  describe('cycleSkill', () => {
    it('cycles none -> prof', () => {
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills?.['Stealth']).toBe('prof');
    });

    it('cycles prof -> expert', () => {
      component.pc = basePc({ Stealth: 'prof' });
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills?.['Stealth']).toBe('expert');
    });

    it('cycles expert -> none (key removed entirely)', () => {
      component.pc = basePc({ Stealth: 'expert' });
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills).toEqual({});
    });

    it('reads a short-form key and rewrites it under the canonical name', () => {
      component.pc = basePc({ Animal: 'prof' });
      component.cycleSkill('Animal Handling');
      expect(emitted[0].pc.skills).toEqual({ 'Animal Handling': 'expert' });
    });

    it('never mutates the input PC (demo mode hands out the live store object)', () => {
      const pc = basePc({ Insight: 'prof' });
      component.pc = pc;
      component.cycleSkill('Insight');
      expect(pc.skills).toEqual({ Insight: 'prof' });
      expect(emitted[0].pc).not.toBe(pc);
    });

    it('preserves unrelated skills', () => {
      component.pc = basePc({ Perception: 'prof', Deception: 'expert' });
      component.cycleSkill('Stealth');
      expect(emitted[0].pc.skills).toEqual({ Perception: 'prof', Deception: 'expert', Stealth: 'prof' });
    });

    it('describes the change for the DM activity log', () => {
      component.pc = basePc({ Stealth: 'prof' });
      component.cycleSkill('Stealth');
      expect(emitted[0].description).toBe('Skill proficiency changed: Stealth (expertise)');
    });

    it('does nothing when not editable (player viewing their own sheet)', () => {
      component.editable = false;
      component.cycleSkill('Stealth');
      expect(emitted.length).toBe(0);
    });
  });

  describe('ngOnChanges modifier math', () => {
    it('applies prof and expertise bonuses to the displayed modifier', () => {
      component.pc = basePc({ Stealth: 'expert', Acrobatics: 'prof' });
      component.ngOnChanges();
      const row = (name: string) => component.skillRows.find(r => r.name === name)!;
      expect(row('Stealth').modStr).toBe('+7');    // DEX +3, expertise +4
      expect(row('Acrobatics').modStr).toBe('+5'); // DEX +3, prof +2
      expect(row('Athletics').modStr).toBe('+0');  // STR +0, no prof
    });
  });
});
