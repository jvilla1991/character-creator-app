import { PC } from '../models/pc';
import { longRestClassName, longRestPreview, ordinal } from './long-rest';

describe('long rest util', () => {
  const pc = (over: Partial<PC> = {}): PC => ({
    id: 1, name: 'Bex', clazz: 'Fighter', level: 5, playerName: 'Sam', ...over,
  } as PC);

  describe('longRestPreview', () => {
    it('works out what comes back for a worn-down hero', () => {
      const p = longRestPreview(pc({
        hp: { cur: 18, max: 44, temp: 5 }, hitDiceUsed: 4, exhaustion: 2,
      }));

      expect(p.cannotRest).toBeFalse();
      expect(p.hpNow).toBe(18);
      expect(p.hpMax).toBe(44);
      expect(p.hpGain).toBe(26);
      expect(p.tempHp).toBe(5);
      expect(p.hitDie).toBe(10);
      expect(p.hitDiceTotal).toBe(5);
      expect(p.hitDiceBack).toBe(4); // every spent die, not half
      expect(p.exhaustionNow).toBe(2);
      expect(p.exhaustionAfter).toBe(1);
      expect(p.slots).toEqual([]);
    });

    it('gains nothing for a hero already at full strength, and never drops Exhaustion below 0', () => {
      const p = longRestPreview(pc({ hp: { cur: 44, max: 44, temp: 0 } }));

      expect(p.hpGain).toBe(0);
      expect(p.hitDiceBack).toBe(0);
      expect(p.exhaustionNow).toBe(0);
      expect(p.exhaustionAfter).toBe(0);
    });

    it('flags a hero at 0 Hit Points, but not one whose Hit Points were never set', () => {
      expect(longRestPreview(pc({ hp: { cur: 0, max: 44, temp: 0 } })).cannotRest).toBeTrue();
      expect(longRestPreview(pc()).cannotRest).toBeFalse();
    });

    it('lists spell levels with slots in order, with how many come back', () => {
      const p = longRestPreview(pc({
        clazz: 'Wizard',
        spellSlots: { 3: { max: 2, used: 2 }, 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 4: { max: 0, used: 0 } },
      }));

      expect(p.slots).toEqual([
        { level: 1, max: 4, back: 1 },
        { level: 2, max: 3, back: 0 },
        { level: 3, max: 2, back: 2 },
      ]);
    });

    it('never counts more dice or slots back than the hero has', () => {
      const p = longRestPreview(pc({ level: 3, hitDiceUsed: 9, spellSlots: { 1: { max: 2, used: 5 } } }));

      expect(p.hitDiceBack).toBe(3);
      expect(p.slots[0].back).toBe(2);
    });
  });

  it('names a hero class by its short name, and anyone else by their class', () => {
    expect(longRestClassName('Paladin', 'Oath of the Ebon Blade', 'Blood')).toBe('Death Knight');
    expect(longRestClassName('Ranger', 'Demon Hunter', 'Havoc')).toBe('Demon Hunter');
    expect(longRestClassName('Druid', 'Circle of the Moon', 'Guardian')).toBe('Druid'); // a WoW variant
    expect(longRestClassName('Paladin', 'Oath of Devotion', null)).toBe('Paladin');
    expect(longRestClassName('Fighter')).toBe('Fighter');
    expect(longRestClassName(null)).toBe('');
  });

  it('ordinal handles the teens', () => {
    expect([1, 2, 3, 4, 9].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '9th']);
    expect([11, 12, 13, 21].map(ordinal)).toEqual(['11th', '12th', '13th', '21st']);
  });
});
