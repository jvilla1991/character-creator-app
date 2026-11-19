import { classSlotTable, ordinal, slotLevels, slotsLeftText, startingSlots } from './spell-slots';

describe('spell slots', () => {
  describe('ordinal', () => {
    it('names the nine spell levels', () => {
      expect([1, 2, 3, 4, 9].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '9th']);
    });
  });

  describe('slotLevels', () => {
    it('lists the levels a character has slots for, lowest first, with what is left', () => {
      expect(slotLevels({ 3: { max: 2, used: 2 }, 1: { max: 4, used: 1 } })).toEqual([
        { level: 1, max: 4, used: 1, left: 3 },
        { level: 3, max: 2, used: 2, left: 0 },
      ]);
    });

    it('has nothing for a character with no slots', () => {
      expect(slotLevels(undefined)).toEqual([]);
      expect(slotLevels(null)).toEqual([]);
      expect(slotLevels({})).toEqual([]);
    });

    it('leaves out a level with no maximum, and anything that is not a spell level 1-9', () => {
      const slots = { 0: { max: 3, used: 0 }, 1: { max: 0, used: 0 }, 2: { max: 2, used: 0 }, 10: { max: 1, used: 0 } };
      expect(slotLevels(slots).map(l => l.level)).toEqual([2]);
    });

    it('keeps the used count within 0..max', () => {
      expect(slotLevels({ 1: { max: 2, used: 5 }, 2: { max: 2, used: -1 } })).toEqual([
        { level: 1, max: 2, used: 2, left: 0 },
        { level: 2, max: 2, used: 0, left: 2 },
      ]);
    });
  });

  describe('slotsLeftText', () => {
    it('says what is left in words', () => {
      expect(slotsLeftText({ max: 4, used: 2 })).toBe('2 of 4 left');
      expect(slotsLeftText({ max: 4, used: 0 })).toBe('4 of 4 left');
      expect(slotsLeftText({ max: 4, used: 4 })).toBe('None left');
    });
  });

  // The server's ClassProgression.spellSlotsFor is the authority; these pin the copy.
  describe('classSlotTable', () => {
    it('gives the full casters the full-caster table', () => {
      for (const clazz of ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard']) {
        expect(classSlotTable(clazz, 1)).withContext(clazz).toEqual({ 1: 2 });
        expect(classSlotTable(clazz, 5)).withContext(clazz).toEqual({ 1: 4, 2: 3, 3: 2 });
      }
      expect(classSlotTable('wizard', 17)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 });
      expect(classSlotTable('wizard', 20)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
    });

    it('gives Paladin and Ranger the half-caster table at every level', () => {
      const expected: Record<number, number[]> = {
        1: [2], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
        9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1],
        15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1],
        19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
      };
      for (const clazz of ['Paladin', 'ranger']) {
        for (let level = 1; level <= 20; level++) {
          const row = Object.fromEntries(expected[level].map((max, i) => [i + 1, max]));
          expect(classSlotTable(clazz, level)).withContext(`${clazz} ${level}`).toEqual(row);
        }
      }
    });

    it('gives the Warlock one pact slot level', () => {
      expect(classSlotTable('Warlock', 1)).toEqual({ 1: 1 });
      expect(classSlotTable('Warlock', 5)).toEqual({ 3: 2 });
      expect(classSlotTable('Warlock', 17)).toEqual({ 5: 4 });
    });

    it('gives a class with no slots nothing, and clamps the level into 1-20', () => {
      expect(classSlotTable('Fighter', 10)).toEqual({});
      expect(classSlotTable('Rogue', 5)).toEqual({});
      expect(classSlotTable(undefined, 3)).toEqual({});
      expect(classSlotTable('Wizard', 0)).toEqual({ 1: 2 });
      expect(classSlotTable('Wizard', 99)).toEqual(classSlotTable('Wizard', 20));
    });
  });

  describe('startingSlots', () => {
    it('is the class table with nothing spent', () => {
      expect(startingSlots('Wizard')).toEqual({ 1: { max: 2, used: 0 } });
      expect(startingSlots('Paladin')).toEqual({ 1: { max: 2, used: 0 } });
      expect(startingSlots('Ranger')).toEqual({ 1: { max: 2, used: 0 } });
      expect(startingSlots('Warlock')).toEqual({ 1: { max: 1, used: 0 } });
      expect(startingSlots('Fighter')).toEqual({});
    });
  });
});
