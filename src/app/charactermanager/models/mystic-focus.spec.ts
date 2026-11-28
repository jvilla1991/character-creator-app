import {
  MysticFocusChange, MysticFocusRefusal, applyMysticFocus, hasMysticFocus, mysticFocusNotice, mysticFocusView,
} from './mystic-focus';
import { PC } from './pc';
import { classSlotTable } from '../utils/spell-slots';

/**
 * Mystic Focus on the client, both ways and row by row: the same matrix as the
 * server's MysticFocusRulesTest (what is spent and gained, every 400 and 409,
 * the same wording), then what the sheet offers and says.
 */
describe('Mystic Focus', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';

  /**
   * A Mystic Arts monk whose slots of every spell level it has are spent
   * `slotsUsed` times (clamped to what it has) and who has expended `focusUsed`
   * Focus Points.
   */
  function monk(level: number, slotsUsed: number, focusUsed: number, over: Partial<PC> = {}): PC {
    const spellSlots: NonNullable<PC['spellSlots']> = {};
    for (const [spellLevel, max] of Object.entries(classSlotTable('Monk', level, MYSTIC_ARTS))) {
      spellSlots[Number(spellLevel)] = { max, used: Math.min(slotsUsed, max) };
    }
    return {
      id: 1, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level, playerName: 'Sam',
      spellSlots, classResources: focusUsed > 0 ? { focusPoints: focusUsed } : {},
      ...over,
    };
  }

  const done = (pc: PC, action: string | null | undefined, slotLevel: number | null | undefined): MysticFocusChange => {
    const outcome = applyMysticFocus(pc, action, slotLevel);
    if (!outcome.ok) throw new Error(`refused: ${outcome.message}`);
    return outcome;
  };
  const refused = (pc: PC, action: string | null | undefined, slotLevel: number | null | undefined): MysticFocusRefusal => {
    const outcome = applyMysticFocus(pc, action, slotLevel);
    if (outcome.ok) throw new Error('expected a refusal');
    return outcome;
  };
  const focusUsed = (change: MysticFocusChange): number => change.classResources['focusPoints'] ?? 0;

  describe('who has the feature', () => {
    it('is a Warrior of the Mystic Arts of Monk level 6 or higher', () => {
      expect(hasMysticFocus(monk(6, 0, 0))).toBeTrue();
      expect(hasMysticFocus(monk(20, 0, 0))).toBeTrue();
      expect(hasMysticFocus(monk(5, 0, 0))).toBeFalse();
      expect(hasMysticFocus(monk(10, 0, 0, { subclass: 'Warrior of the Open Hand' }))).toBeFalse();
      expect(hasMysticFocus(monk(10, 0, 0, { subclass: undefined }))).toBeFalse();
      expect(hasMysticFocus(monk(10, 0, 0, { clazz: 'Wizard' }))).toBeFalse();
      expect(hasMysticFocus(null)).toBeFalse();
    });
  });

  describe('spell slot to Focus Points', () => {
    it('spends the slot and regains as many points as its level, for every slot level', () => {
      for (const slotLevel of [1, 2, 3, 4]) {
        const change = done(monk(20, 0, 10), 'SLOT_TO_FOCUS', slotLevel);
        expect(change.spellSlots[slotLevel].used).withContext(`level ${slotLevel}`).toBe(1);
        expect(focusUsed(change)).withContext(`level ${slotLevel}`).toBe(10 - slotLevel);
        for (const other of [1, 2, 3, 4].filter(l => l !== slotLevel)) {
          expect(change.spellSlots[other].used).toBe(0);
        }
      }
    });

    it('never regains more than is expended, and stores nothing once nothing is used', () => {
      const change = done(monk(13, 0, 1), 'SLOT_TO_FOCUS', 3);
      expect(change.classResources).toEqual({});
      expect(change.spellSlots[3]).toEqual({ max: 2, used: 1 });
      expect(change.description)
        .toBe('turned a level 3 spell slot into 1 Focus Point (1 of 2 slots left, 13 of 13 Focus Points)');
    });

    it('words the log line as the server does', () => {
      expect(done(monk(8, 1, 5), 'SLOT_TO_FOCUS', 2).description)
        .toBe('turned a level 2 spell slot into 2 Focus Points (0 of 2 slots left, 5 of 8 Focus Points)');
    });

    it('is a 409 with no unspent slot of that level, or no slot of that level at all', () => {
      const spent = monk(7, 9, 4);
      expect(refused(spent, 'SLOT_TO_FOCUS', 1)).toEqual({ ok: false, status: 409, message: 'No level 1 slot available' });
      expect(refused(spent, 'SLOT_TO_FOCUS', 2)).toEqual({ ok: false, status: 409, message: 'No level 2 slot available' });
      expect(refused(monk(6, 0, 4), 'SLOT_TO_FOCUS', 2).message).toBe('No level 2 slot available');
      expect(refused(monk(18, 0, 4), 'SLOT_TO_FOCUS', 4).message).toBe('No level 4 slot available');
    });

    it('is a 409 with no Focus Point expended', () => {
      expect(refused(monk(7, 0, 0), 'SLOT_TO_FOCUS', 1))
        .toEqual({ ok: false, status: 409, message: 'No expended Focus Points to regain' });
    });
  });

  describe('Focus Points to spell slot', () => {
    const TABLE = [[1, 2, 6], [2, 3, 7], [3, 5, 13], [4, 6, 19]]; // slot level, cost, minimum Monk level

    it('spends the cost and restores one slot, for every row of the table', () => {
      for (const [slotLevel, cost, minLevel] of TABLE) {
        const change = done(monk(minLevel, 1, 0), 'FOCUS_TO_SLOT', slotLevel);
        expect(focusUsed(change)).withContext(`cost of a level ${slotLevel} slot`).toBe(cost);
        expect(change.spellSlots[slotLevel].used).withContext(`level ${slotLevel}`).toBe(0);
      }
    });

    it('is a 400 below the Monk level the slot level needs', () => {
      for (const [slotLevel, , minLevel] of TABLE.slice(1)) {
        expect(refused(monk(minLevel - 1, 1, 0), 'FOCUS_TO_SLOT', slotLevel)).toEqual({
          ok: false, status: 400, message: `Recovering a level ${slotLevel} spell slot needs Monk level ${minLevel}`,
        });
      }
    });

    it('holds the level gate even when the DM granted such a slot', () => {
      const pc = monk(6, 0, 0, { spellSlots: { 1: { max: 3, used: 0 }, 2: { max: 1, used: 1 } } });
      expect(refused(pc, 'FOCUS_TO_SLOT', 2).message).toBe('Recovering a level 2 spell slot needs Monk level 7');
      // The other way is open: the slot exists, so it can be spent.
      const fresh = monk(6, 0, 3, { spellSlots: { 1: { max: 3, used: 0 }, 2: { max: 1, used: 0 } } });
      expect(focusUsed(done(fresh, 'SLOT_TO_FOCUS', 2))).toBe(1);
    });

    it('is a 409 with no slot of that level expended', () => {
      expect(refused(monk(7, 0, 0), 'FOCUS_TO_SLOT', 1))
        .toEqual({ ok: false, status: 409, message: 'No spent level 1 slot to restore' });
      expect(refused(monk(7, 0, 0), 'FOCUS_TO_SLOT', 2).message).toBe('No spent level 2 slot to restore');
    });

    it('is a 409 one point short of the cost, and works with exactly the cost left', () => {
      for (const [slotLevel, cost, monkLevel] of TABLE) {
        expect(refused(monk(monkLevel, 1, monkLevel - cost + 1), 'FOCUS_TO_SLOT', slotLevel)).toEqual({
          ok: false, status: 409, message: `Recovering a level ${slotLevel} spell slot costs ${cost} Focus Points`,
        });
        expect(focusUsed(done(monk(monkLevel, 1, monkLevel - cost), 'FOCUS_TO_SLOT', slotLevel))).toBe(monkLevel);
      }
    });

    it('words the log line as the server does', () => {
      expect(done(monk(8, 2, 1), 'FOCUS_TO_SLOT', 2).description)
        .toBe('turned 3 Focus Points into a level 2 spell slot (1 of 2 slots left, 4 of 8 Focus Points)');
    });
  });

  describe('what a request must carry', () => {
    const NOT_THIS_CHARACTER = 'Mystic Focus needs a Warrior of the Mystic Arts of Monk level 6 or higher';

    it('refuses any other character with a 400', () => {
      for (const level of [1, 2, 3, 4, 5]) {
        expect(refused(monk(level, 0, 1), 'SLOT_TO_FOCUS', 1))
          .toEqual({ ok: false, status: 400, message: NOT_THIS_CHARACTER });
      }
      expect(refused(monk(10, 0, 3, { subclass: 'Warrior of the Open Hand' }), 'SLOT_TO_FOCUS', 1).message)
        .toBe(NOT_THIS_CHARACTER);
      expect(refused(monk(10, 0, 3, { subclass: undefined }), 'FOCUS_TO_SLOT', 1).message).toBe(NOT_THIS_CHARACTER);
      expect(refused(monk(10, 1, 0, { clazz: 'Wizard' }), 'SLOT_TO_FOCUS', 1).message).toBe(NOT_THIS_CHARACTER);
      expect(refused(monk(10, 0, 0, { clazz: 'Fighter', subclass: 'Eldritch Knight' }), 'SLOT_TO_FOCUS', 1).message)
        .toBe(NOT_THIS_CHARACTER);
    });

    it('refuses an unknown action or slot level with a 400', () => {
      const pc = monk(20, 1, 5);
      for (const action of [null, undefined, '', 'slot_to_focus', 'RESTORE']) {
        expect(refused(pc, action, 1))
          .toEqual({ ok: false, status: 400, message: 'action must be SLOT_TO_FOCUS or FOCUS_TO_SLOT' });
      }
      for (const slotLevel of [null, undefined, 0, -1, 5, 9, 1.5]) {
        for (const action of ['SLOT_TO_FOCUS', 'FOCUS_TO_SLOT']) {
          expect(refused(pc, action, slotLevel))
            .toEqual({ ok: false, status: 400, message: 'slotLevel must be a spell level from 1 to 4' });
        }
      }
    });

    it('never changes the character it was given', () => {
      const pc = monk(8, 1, 5);
      const before = JSON.stringify(pc);
      done(pc, 'SLOT_TO_FOCUS', 1);
      done(pc, 'FOCUS_TO_SLOT', 2);
      refused(pc, 'FOCUS_TO_SLOT', 3);
      expect(JSON.stringify(pc)).toBe(before);
    });

    it('keeps the character\'s other counters', () => {
      const pc = monk(6, 0, 3, {
        features: [{ name: 'Spell Resistant', source: 'Feat (Level 4)', desc: '' }],
        classResources: { focusPoints: 3, magicResistant: 1, secondWind: 1 },
      });
      // A feat's counter stays; a stale key the Monk does not have is cleaned away, as on every save.
      expect(done(pc, 'SLOT_TO_FOCUS', 1).classResources).toEqual({ focusPoints: 2, magicResistant: 1 });
    });
  });

  describe('what the sheet offers', () => {
    it('is nothing for a character without the feature', () => {
      expect(mysticFocusView(null)).toBeNull();
      expect(mysticFocusView(monk(5, 0, 2))).toBeNull();
      expect(mysticFocusView(monk(10, 0, 2, { subclass: 'Warrior of Shadow' }))).toBeNull();
      expect(mysticFocusView(monk(10, 0, 2, { clazz: 'Sorcerer' }))).toBeNull();
    });

    it('is one option each way for every spell level the Monk has slots for', () => {
      const view = mysticFocusView(monk(8, 1, 5))!;
      expect([view.focusLeft, view.focusMax]).toEqual([3, 8]);
      expect(view.slotToFocus.map(o => [o.action, o.slotLevel, o.label, o.amount, o.possible])).toEqual([
        ['SLOT_TO_FOCUS', 1, '1st', 1, true], ['SLOT_TO_FOCUS', 2, '2nd', 2, true],
      ]);
      expect(view.focusToSlot.map(o => [o.action, o.slotLevel, o.label, o.amount, o.possible])).toEqual([
        ['FOCUS_TO_SLOT', 1, '1st', 2, true], ['FOCUS_TO_SLOT', 2, '2nd', 3, true],
      ]);
      expect(mysticFocusView(monk(6, 0, 0))!.slotToFocus.map(o => o.slotLevel)).toEqual([1]);
      expect(mysticFocusView(monk(20, 0, 0))!.focusToSlot.map(o => o.slotLevel)).toEqual([1, 2, 3, 4]);
    });

    it('keeps an action that is not possible right now, with the reason', () => {
      // Rested and full of Focus Points: neither way is open.
      const rested = mysticFocusView(monk(8, 0, 0))!;
      expect(rested.slotToFocus.map(o => [o.possible, o.reason])).toEqual([
        [false, 'No expended Focus Points to regain'], [false, 'No expended Focus Points to regain'],
      ]);
      expect(rested.focusToSlot.map(o => [o.possible, o.reason])).toEqual([
        [false, 'No spent level 1 slot to restore'], [false, 'No spent level 2 slot to restore'],
      ]);
      // Slots spent, one Focus Point left: the 2nd-level slot is out of reach, and so is the 1st.
      const drained = mysticFocusView(monk(8, 9, 7))!;
      expect(drained.slotToFocus.every(o => !o.possible)).toBeTrue();
      expect(drained.slotToFocus[0].reason).toBe('No level 1 slot available');
      expect(drained.focusToSlot.map(o => o.reason)).toEqual([
        'Recovering a level 1 spell slot costs 2 Focus Points', 'Recovering a level 2 spell slot costs 3 Focus Points',
      ]);
      // A slot level the DM granted early stays listed, with the level it needs.
      const early = mysticFocusView(monk(6, 0, 0, { spellSlots: { 1: { max: 3, used: 1 }, 2: { max: 1, used: 1 } } }))!;
      expect(early.focusToSlot.map(o => [o.slotLevel, o.possible, o.reason])).toEqual([
        [1, true, ''], [2, false, 'Recovering a level 2 spell slot needs Monk level 7'],
      ]);
    });

    it('leaves a slot level above 4 out: Mystic Focus does not deal in it', () => {
      const pc = monk(20, 0, 5, { spellSlots: { 1: { max: 4, used: 0 }, 5: { max: 1, used: 0 } } });
      expect(mysticFocusView(pc)!.slotToFocus.map(o => o.slotLevel)).toEqual([1]);
    });

    it('says in the confirm when the rule allows it and exactly what is spent and gained', () => {
      const view = mysticFocusView(monk(8, 1, 5))!;
      expect(view.slotToFocus[1].confirm).toBe(
        'Spend one 2nd-level spell slot to regain 2 Focus Points. The rule allows this at any time, with no action.');
      expect(view.slotToFocus[0].confirm).toBe(
        'Spend one 1st-level spell slot to regain 1 Focus Point. The rule allows this at any time, with no action.');
      expect(view.focusToSlot[0].confirm).toBe(
        'Spend 2 Focus Points to recover one 1st-level spell slot. '
        + 'The rule allows this when you finish a Short Rest or use Uncanny Metabolism.');
      expect(view.focusToSlot[1].confirm).toBe(
        'Spend 3 Focus Points to recover one 2nd-level spell slot. '
        + 'The rule allows this when you finish a Short Rest or use Uncanny Metabolism.');
    });

    it('says so when fewer points come back than the slot is worth', () => {
      const view = mysticFocusView(monk(13, 0, 1))!;
      expect(view.slotToFocus[2].confirm).toBe(
        'Spend one 3rd-level spell slot to regain 1 Focus Point (only 1 is expended). '
        + 'The rule allows this at any time, with no action.');
      expect(mysticFocusView(monk(13, 0, 2))!.slotToFocus[2].confirm)
        .toContain('to regain 2 Focus Points (only 2 are expended).');
    });

    it('tells the slot strip what happened', () => {
      expect(mysticFocusNotice({ action: 'SLOT_TO_FOCUS', slotLevel: 2 }))
        .toEqual({ level: 2, text: 'One 2nd-level slot turned into Focus Points.' });
      expect(mysticFocusNotice({ action: 'FOCUS_TO_SLOT', slotLevel: 1 }))
        .toEqual({ level: 1, text: 'One 1st-level slot recovered with Focus Points.' });
    });
  });
});
