import {
  allSlotsRestoredNotice, classSlotTable, ordinal, restoreAllSlots, restoreSlot, slotCastNotice, slotLevels,
  slotMaxOf, slotRestoredNotice, slotSpentNotice, slotsLeftText, spendSlot, startingSlots, withSlotMax,
} from './spell-slots';

describe('spell slots', () => {
  describe('ordinal', () => {
    it('names the nine spell levels', () => {
      expect([1, 2, 3, 4, 9].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '9th']);
    });

    it('handles the teens, for anything else that counts', () => {
      expect([11, 12, 13, 21, 22, 113].map(ordinal)).toEqual(['11th', '12th', '13th', '21st', '22nd', '113th']);
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

  // The same rules as the server's spend and restore endpoints (SpellSlotState).
  describe('spending and restoring by hand', () => {
    const slots = { 1: { max: 4, used: 1 }, 2: { max: 3, used: 3 }, 3: { max: 2, used: 0 } };

    it('spends one slot of the level and leaves the others alone', () => {
      expect(spendSlot(slots, 1)).toEqual({ 1: { max: 4, used: 2 }, 2: { max: 3, used: 3 }, 3: { max: 2, used: 0 } });
    });

    it('refuses to spend where no slot is free, or where the character has no slots', () => {
      expect(spendSlot(slots, 2)).toBeNull();
      expect(spendSlot(slots, 4)).toBeNull();
      expect(spendSlot(undefined, 1)).toBeNull();
      expect(spendSlot({ 1: { max: 0, used: 0 } }, 1)).toBeNull();
    });

    it('restores one spent slot of the level', () => {
      expect(restoreSlot(slots, 2)).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 3, used: 2 }, 3: { max: 2, used: 0 } });
    });

    it('refuses to restore where nothing is spent', () => {
      expect(restoreSlot(slots, 3)).toBeNull();
      expect(restoreSlot(slots, 9)).toBeNull();
      expect(restoreSlot(null, 1)).toBeNull();
    });

    it('restores every spent slot, and is never refused', () => {
      expect(restoreAllSlots(slots)).toEqual({ 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } });
      expect(restoreAllSlots({ 1: { max: 2, used: 0 } })).toEqual({ 1: { max: 2, used: 0 } });
      expect(restoreAllSlots(undefined)).toEqual({});
    });

    it('is pure: the slots passed in are untouched', () => {
      const before = JSON.stringify(slots);
      spendSlot(slots, 1);
      restoreSlot(slots, 2);
      restoreAllSlots(slots);
      expect(JSON.stringify(slots)).toBe(before);
    });

    it('counts from a used count that is out of range as the server would', () => {
      expect(spendSlot({ 1: { max: 2, used: 7 } }, 1)).toBeNull();                       // read as 2 of 2 used
      expect(restoreSlot({ 1: { max: 2, used: 7 } }, 1)).toEqual({ 1: { max: 2, used: 1 } });
    });
  });

  describe('a level\'s maximum', () => {
    it('reads the saved maximum, 0 where there are no slots', () => {
      expect(slotMaxOf({ 3: { max: 2, used: 1 } }, 3)).toBe(2);
      expect(slotMaxOf({ 3: { max: 2, used: 1 } }, 4)).toBe(0);
      expect(slotMaxOf(undefined, 1)).toBe(0);
    });

    it('raises a maximum without touching what is spent', () => {
      expect(withSlotMax({ 3: { max: 2, used: 1 } }, 3, 3)).toEqual({ 3: { max: 3, used: 1 } });
    });

    it('brings the used count down with a maximum that shrank', () => {
      expect(withSlotMax({ 3: { max: 3, used: 3 } }, 3, 1)).toEqual({ 3: { max: 1, used: 1 } });
    });

    it('adds a level the character did not have, nothing spent', () => {
      expect(withSlotMax({ 1: { max: 2, used: 0 } }, 2, 1)).toEqual({ 1: { max: 2, used: 0 }, 2: { max: 1, used: 0 } });
      expect(withSlotMax(undefined, 1, 1)).toEqual({ 1: { max: 1, used: 0 } });
    });

    it('drops a level whose maximum comes to zero or less', () => {
      expect(withSlotMax({ 1: { max: 4, used: 0 }, 6: { max: 1, used: 1 } }, 6, 0)).toEqual({ 1: { max: 4, used: 0 } });
      expect(withSlotMax({ 6: { max: 1, used: 0 } }, 6, -2)).toEqual({});
    });
  });

  describe('what the strip says after a change', () => {
    it('words a cast by the slot that paid for it', () => {
      expect(slotCastNotice('Misty Step', 2)).toEqual({ level: 2, text: 'Misty Step cast with a 2nd-level slot.' });
      expect(slotCastNotice('Shield', 3)).toEqual({ level: 3, text: 'Shield cast with a 3rd-level slot.' });
    });

    it('words a hand spend, a restore and a restore of everything', () => {
      expect(slotSpentNotice(3)).toEqual({ level: 3, text: 'One 3rd-level slot spent by hand.' });
      expect(slotRestoredNotice(1)).toEqual({ level: 1, text: 'One 1st-level slot restored.' });
      expect(allSlotsRestoredNotice()).toEqual({ level: null, text: 'All slots restored.' });
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
