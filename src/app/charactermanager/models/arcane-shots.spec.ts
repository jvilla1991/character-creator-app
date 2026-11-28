import {
  ARCANE_SHOTS, ArcaneShotDraft, ArcaneShotRule, arcaneShotBlocked, arcaneShotDamage, arcaneShotDie,
  arcaneShotDraftStart, arcaneShotLevelUpRule, arcaneShotListRule, arcaneShotOption, arcaneShotSaveDc,
  arcaneShotSaveLine, arcaneShotSaveName, arcaneShotSheetRule, arcaneShotStart, arcaneShotsComplete,
  swapArcaneShot, toggleArcaneShot, withArcaneShotPicks,
} from './arcane-shots';
import {
  ARCANE_ARCHER, ARCANE_SHOT_OPTIONS, ChoiceOwner, arcaneShotCount, arcaneShotsOwed, hasArcaneShots,
  knownArcaneShots, subclassChoicesProblem,
} from './arcana-subclasses';

describe('arcane-shots', () => {
  const fighter = (over: Partial<ChoiceOwner> = {}): ChoiceOwner => ({ clazz: 'Fighter', ...over });
  const archer = (...arcaneShots: string[]): ChoiceOwner => fighter({ subclassChoices: { skills: [], arcaneShots } });
  const shot = (name: string) => arcaneShotOption(name)!;

  describe('the eight options', () => {
    it('are the options the server knows, in the same order', () => {
      expect(ARCANE_SHOTS.map(s => s.name)).toEqual([...ARCANE_SHOT_OPTIONS]);
    });

    it('carry how many Arcane Shot Dice they deal, of what damage, and the save they call for', () => {
      expect(ARCANE_SHOTS.map(s => [s.name, s.dice, s.damageType, s.save])).toEqual([
        ['Banishing Shot', 1, 'Psychic', 'CHA'],
        ['Beguiling Shot', 2, 'Psychic', 'WIS'],
        ['Bursting Shot', 2, 'Force', null],
        ['Enfeebling Shot', 2, 'Necrotic', 'CON'],
        ['Grasping Shot', 1, 'Slashing', 'STR'],
        ['Piercing Shot', 2, 'Piercing', 'DEX'],
        ['Seeking Shot', 2, 'Force', 'DEX'],
        ['Shadow Shot', 1, 'Psychic', 'WIS'],
      ]);
    });

    it('each have a summary of their own that names what a failed save does', () => {
      const summaries = ARCANE_SHOTS.map(s => s.summary);
      expect(new Set(summaries).size).toBe(8);
      for (const s of ARCANE_SHOTS) {
        expect(s.summary.length).withContext(s.name).toBeGreaterThan(40);
        expect(s.summary.length).withContext(s.name).toBeLessThan(330);
        expect(s.summary.endsWith('.')).withContext(s.name).toBeTrue();
      }
      expect(shot('Banishing Shot').summary).toContain('Incapacitated');
      expect(shot('Beguiling Shot').summary).toContain('Charmed');
      expect(shot('Bursting Shot').summary).toContain('within 10 feet');
      expect(shot('Enfeebling Shot').summary).toContain('Poisoned');
      expect(shot('Grasping Shot').summary).toContain('Restrained');
      expect(shot('Piercing Shot').summary).toContain('Line 30 feet long');
      expect(shot('Seeking Shot').summary).toContain('long range');
      expect(shot('Shadow Shot').summary).toContain('Blinded');
      // The two that replace the attack roll say so; an option with no save promises none.
      expect(ARCANE_SHOTS.filter(s => s.summary.startsWith('No attack roll.')).map(s => s.name))
        .toEqual(['Piercing Shot', 'Seeking Shot']);
      expect(shot('Bursting Shot').summary).not.toContain('save');
    });

    it('are found by name whatever the case, and nothing else is', () => {
      expect(arcaneShotOption(' seeking shot ')?.name).toBe('Seeking Shot');
      expect(arcaneShotOption('Exploding Shot')).toBeUndefined();
      expect(arcaneShotOption('')).toBeUndefined();
      expect(arcaneShotOption(null)).toBeUndefined();
    });
  });

  describe('the Arcane Shot Die', () => {
    it('is a d6, a d8 from Fighter 10, a d10 from 15 and a d12 from 18', () => {
      const dice = [3, 9, 10, 14, 15, 17, 18, 20].map(level => [level, arcaneShotDie(level)]);
      expect(dice).toEqual([[3, 6], [9, 6], [10, 8], [14, 8], [15, 10], [17, 10], [18, 12], [20, 12]]);
      expect(arcaneShotDie(null)).toBe(6);
    });

    it('sizes the damage of every option', () => {
      expect(arcaneShotDamage(shot('Banishing Shot'), 3)).toBe('1d6 Psychic');
      expect(arcaneShotDamage(shot('Bursting Shot'), 9)).toBe('2d6 Force');
      expect(arcaneShotDamage(shot('Bursting Shot'), 10)).toBe('2d8 Force');
      expect(arcaneShotDamage(shot('Enfeebling Shot'), 14)).toBe('2d8 Necrotic');
      expect(arcaneShotDamage(shot('Grasping Shot'), 15)).toBe('1d10 Slashing');
      expect(arcaneShotDamage(shot('Piercing Shot'), 17)).toBe('2d10 Piercing');
      expect(arcaneShotDamage(shot('Seeking Shot'), 18)).toBe('2d12 Force');
      expect(arcaneShotDamage(shot('Shadow Shot'), 20)).toBe('1d12 Psychic');
      expect(arcaneShotDamage(shot('Beguiling Shot'), 5)).toBe('2d6 Psychic');
    });
  });

  describe('the save DC', () => {
    it('is 8 plus the Intelligence modifier plus the Proficiency Bonus', () => {
      expect(arcaneShotSaveDc(0, 2)).toBe(10);
      expect(arcaneShotSaveDc(3, 2)).toBe(13);
      expect(arcaneShotSaveDc(4, 3)).toBe(15);
      expect(arcaneShotSaveDc(5, 6)).toBe(19);
      expect(arcaneShotSaveDc(-1, 2)).toBe(9);   // a penalty counts too
    });

    it('is written beside the save an option calls for, and not at all for one without a save', () => {
      expect(ARCANE_SHOTS.map(s => arcaneShotSaveName(s))).toEqual([
        'Charisma save', 'Wisdom save', null, 'Constitution save', 'Strength save', 'Dexterity save', 'Dexterity save',
        'Wisdom save',
      ]);
      expect(arcaneShotSaveLine(shot('Beguiling Shot'), 15)).toBe('Wisdom save, DC 15');
      expect(arcaneShotSaveLine(shot('Grasping Shot'), 13)).toBe('Strength save, DC 13');
      expect(arcaneShotSaveLine(shot('Bursting Shot'), 15)).toBeNull();
    });
  });

  describe('what a character knows and owes', () => {
    it('is an Arcane Archer only as a Fighter, from level 3', () => {
      expect(hasArcaneShots(fighter(), ARCANE_ARCHER, 3)).toBeTrue();
      expect(hasArcaneShots(fighter(), ' arcane archer ', 20)).toBeTrue();
      expect(hasArcaneShots(fighter(), ARCANE_ARCHER, 2)).toBeFalse();
      expect(hasArcaneShots(fighter(), 'Champion', 3)).toBeFalse();
      expect(hasArcaneShots({ clazz: 'Wizard' }, ARCANE_ARCHER, 3)).toBeFalse();
      expect(hasArcaneShots(fighter(), null, 3)).toBeFalse();
    });

    it('reads the stored list the way the server keeps it', () => {
      expect(knownArcaneShots(archer('Seeking Shot', 'Shadow Shot'), 3)).toEqual(['Seeking Shot', 'Shadow Shot']);
      expect(knownArcaneShots(fighter(), 3)).toEqual([]);
      // A name that is no option goes, a repeat counts once, the spelling is the table's.
      expect(knownArcaneShots(archer('seeking shot', 'Fire Shot', 'Seeking Shot', ' Shadow Shot '), 3))
        .toEqual(['Seeking Shot', 'Shadow Shot']);
      // No more than the level gives.
      expect(knownArcaneShots(archer('Seeking Shot', 'Shadow Shot', 'Piercing Shot'), 6)).toEqual(['Seeking Shot', 'Shadow Shot']);
      expect(knownArcaneShots(archer('Seeking Shot'), 2)).toEqual([]);
    });

    it('owes two at Fighter 3 and one more at 7, 10, 15 and 18', () => {
      expect(arcaneShotsOwed(fighter(), ARCANE_ARCHER, 3)).toBe(2);
      const two = archer('Seeking Shot', 'Shadow Shot');
      expect([4, 5, 6].map(level => arcaneShotsOwed(two, ARCANE_ARCHER, level))).toEqual([0, 0, 0]);
      expect(arcaneShotsOwed(two, ARCANE_ARCHER, 7)).toBe(1);
      for (const level of [7, 10, 15, 18]) {
        const before = archer(...ARCANE_SHOT_OPTIONS.slice(0, arcaneShotCount(level - 1)));
        expect(arcaneShotsOwed(before, ARCANE_ARCHER, level - 1)).withContext(`level ${level - 1}`).toBe(0);
        expect(arcaneShotsOwed(before, ARCANE_ARCHER, level)).withContext(`level ${level}`).toBe(1);
      }
      // A character made an Arcane Archer by hand owes everything its level gives.
      expect(arcaneShotsOwed(fighter(), ARCANE_ARCHER, 12)).toBe(4);
      expect(arcaneShotsOwed(fighter(), 'Champion', 12)).toBe(0);
      expect(arcaneShotsOwed(fighter(), ARCANE_ARCHER, 2)).toBe(0);
      expect(arcaneShotsOwed({ clazz: 'Wizard' }, ARCANE_ARCHER, 12)).toBe(0);
    });
  });

  describe('the choice at a level-up', () => {
    it('is two options at Fighter 3, with nothing to swap', () => {
      expect(arcaneShotLevelUpRule(fighter(), ARCANE_ARCHER, 3)).toEqual({ known: [], count: 2, swaps: 0 });
    });

    it('is one more at 7, 10, 15 and 18, where one known option may go', () => {
      const counts = [7, 10, 15, 18].map(level => {
        const known = ARCANE_SHOT_OPTIONS.slice(0, arcaneShotCount(level - 1));
        return arcaneShotLevelUpRule(archer(...known), ARCANE_ARCHER, level);
      });
      expect(counts.map(rule => [rule!.known.length, rule!.count, rule!.swaps])).toEqual([[2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 1]]);
    });

    it('is nothing at any other level, and nothing for anyone else', () => {
      const two = archer('Seeking Shot', 'Shadow Shot');
      for (const level of [4, 5, 6]) expect(arcaneShotLevelUpRule(two, ARCANE_ARCHER, level)).withContext(`level ${level}`).toBeNull();
      const six = archer(...ARCANE_SHOT_OPTIONS.slice(0, 6));
      for (const level of [19, 20]) expect(arcaneShotLevelUpRule(six, ARCANE_ARCHER, level)).withContext(`level ${level}`).toBeNull();
      expect(arcaneShotLevelUpRule(fighter(), 'Champion', 3)).toBeNull();
      expect(arcaneShotLevelUpRule(fighter(), ARCANE_ARCHER, 2)).toBeNull();
      expect(arcaneShotLevelUpRule({ clazz: 'Cleric' }, ARCANE_ARCHER, 3)).toBeNull();
    });

    it('catches a short list up at a level that adds no option, without a swap', () => {
      expect(arcaneShotLevelUpRule(fighter(), ARCANE_ARCHER, 5)).toEqual({ known: [], count: 2, swaps: 0 });
      expect(arcaneShotLevelUpRule(archer('Seeking Shot', 'Shadow Shot'), ARCANE_ARCHER, 9))
        .toEqual({ known: ['Seeking Shot', 'Shadow Shot'], count: 3, swaps: 0 });
      // Short at a level that adds one: the missing ones are owed and the one swap is still allowed.
      expect(arcaneShotLevelUpRule(archer('Seeking Shot'), ARCANE_ARCHER, 7))
        .toEqual({ known: ['Seeking Shot'], count: 3, swaps: 1 });
    });
  });

  describe('ticking options', () => {
    const atThree: ArcaneShotRule = { known: [], count: 2, swaps: 0 };
    const atSeven: ArcaneShotRule = { known: ['Seeking Shot', 'Banishing Shot'], count: 3, swaps: 1 };
    const atNine: ArcaneShotRule = { known: ['Seeking Shot', 'Banishing Shot'], count: 3, swaps: 0 };

    it('starts from what the character knows', () => {
      expect(arcaneShotStart(atThree)).toEqual([]);
      expect(arcaneShotStart(atSeven)).toEqual(['Seeking Shot', 'Banishing Shot']);
    });

    it('takes options up to the count and no further', () => {
      let picked = toggleArcaneShot(atThree, [], 'Shadow Shot');
      picked = toggleArcaneShot(atThree, picked, 'Bursting Shot');
      expect(picked).toEqual(['Bursting Shot', 'Shadow Shot']);   // the table's order
      expect(arcaneShotsComplete(atThree, picked)).toBeTrue();
      expect(arcaneShotBlocked(atThree, picked, 'Seeking Shot')).toBeTrue();
      expect(toggleArcaneShot(atThree, picked, 'Seeking Shot')).toEqual(picked);
      expect(toggleArcaneShot(atThree, picked, 'Shadow Shot')).toEqual(['Bursting Shot']);
      expect(toggleArcaneShot(atThree, picked, 'Exploding Shot')).toEqual(picked);
    });

    it('lets one known option go where the rule allows a swap, and only one', () => {
      const start = arcaneShotStart(atSeven);
      expect(arcaneShotBlocked(atSeven, start, 'Seeking Shot')).toBeFalse();
      const dropped = toggleArcaneShot(atSeven, start, 'Seeking Shot');
      expect(dropped).toEqual(['Banishing Shot']);
      expect(arcaneShotBlocked(atSeven, dropped, 'Banishing Shot')).toBeTrue();
      expect(toggleArcaneShot(atSeven, dropped, 'Banishing Shot')).toEqual(dropped);
      const full = toggleArcaneShot(atSeven, toggleArcaneShot(atSeven, dropped, 'Shadow Shot'), 'Grasping Shot');
      expect(full).toEqual(['Banishing Shot', 'Grasping Shot', 'Shadow Shot']);
      expect(arcaneShotsComplete(atSeven, full)).toBeTrue();
    });

    it('keeps every known option where it does not', () => {
      const start = arcaneShotStart(atNine);
      expect(arcaneShotBlocked(atNine, start, 'Seeking Shot')).toBeTrue();
      expect(toggleArcaneShot(atNine, start, 'Seeking Shot')).toEqual(start);
      expect(toggleArcaneShot(atNine, start, 'Shadow Shot')).toEqual(['Seeking Shot', 'Banishing Shot', 'Shadow Shot']);
    });

    it('is complete only with exactly the count, real options, none twice and no swap too many', () => {
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Banishing Shot'])).toBeFalse();
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Banishing Shot', 'Shadow Shot'])).toBeTrue();
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Bursting Shot', 'Shadow Shot'])).toBeTrue();
      expect(arcaneShotsComplete(atSeven, ['Grasping Shot', 'Bursting Shot', 'Shadow Shot'])).toBeFalse();
      expect(arcaneShotsComplete(atNine, ['Seeking Shot', 'Bursting Shot', 'Shadow Shot'])).toBeFalse();
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Banishing Shot', 'Banishing Shot'])).toBeFalse();
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Banishing Shot', 'Fire Shot'])).toBeFalse();
      expect(arcaneShotsComplete(atSeven, ['Seeking Shot', 'Banishing Shot', 'Shadow Shot', 'Piercing Shot'])).toBeFalse();
    });
  });

  describe("a level-up's draft (the option to replace is named in a select)", () => {
    const rule: ArcaneShotRule = { known: ['Seeking Shot', 'Banishing Shot'], count: 3, swaps: 1 };
    const start = arcaneShotDraftStart(rule);

    it('starts with the known options ticked and no swap', () => {
      expect(start).toEqual({ selected: ['Seeking Shot', 'Banishing Shot'], swap: '' });
    });

    it('fixes the known options in the list, so only the select moves them', () => {
      const list = arcaneShotListRule(rule, start);
      expect(list).toEqual({ known: ['Seeking Shot', 'Banishing Shot'], count: 3, swaps: 0 });
      expect(arcaneShotBlocked(list, start.selected, 'Seeking Shot')).toBeTrue();
      expect(arcaneShotBlocked(list, start.selected, 'Shadow Shot')).toBeFalse();
    });

    it('unticks the option being replaced and leaves room for two new ones', () => {
      const swapped = swapArcaneShot(rule, start, 'Seeking Shot');
      expect(swapped).toEqual({ selected: ['Banishing Shot'], swap: 'Seeking Shot' });
      // In the list the replaced option is an ordinary option again.
      expect(arcaneShotListRule(rule, swapped).known).toEqual(['Banishing Shot']);

      let draft: ArcaneShotDraft = withArcaneShotPicks(rule, swapped, ['Banishing Shot', 'Shadow Shot']);
      draft = withArcaneShotPicks(rule, draft, ['Banishing Shot', 'Shadow Shot', 'Bursting Shot']);
      expect(draft).toEqual({ selected: ['Banishing Shot', 'Bursting Shot', 'Shadow Shot'], swap: 'Seeking Shot' });
      expect(arcaneShotsComplete(rule, draft.selected)).toBeTrue();
    });

    it('moves the swap to another known option without losing the new picks', () => {
      const draft: ArcaneShotDraft = { selected: ['Banishing Shot', 'Bursting Shot', 'Shadow Shot'], swap: 'Seeking Shot' };
      expect(swapArcaneShot(rule, draft, 'Banishing Shot'))
        .toEqual({ selected: ['Seeking Shot', 'Bursting Shot', 'Shadow Shot'], swap: 'Banishing Shot' });
    });

    it('drops the last new pick when the swap is taken back and the list is over full', () => {
      const draft: ArcaneShotDraft = { selected: ['Banishing Shot', 'Bursting Shot', 'Shadow Shot'], swap: 'Seeking Shot' };
      expect(swapArcaneShot(rule, draft, '')).toEqual({ selected: ['Seeking Shot', 'Banishing Shot', 'Bursting Shot'], swap: '' });
    });

    it('cancels the swap when the replaced option is ticked back', () => {
      const swapped = swapArcaneShot(rule, start, 'Seeking Shot');
      expect(withArcaneShotPicks(rule, swapped, ['Banishing Shot', 'Seeking Shot']))
        .toEqual({ selected: ['Seeking Shot', 'Banishing Shot'], swap: '' });
    });

    it('swaps nothing where the rule allows no swap, or for a name the character does not know', () => {
      const none: ArcaneShotRule = { ...rule, swaps: 0 };
      expect(swapArcaneShot(none, start, 'Seeking Shot')).toEqual(start);
      expect(swapArcaneShot(rule, start, 'Shadow Shot')).toEqual(start);
    });

    it('never leaves a complete draft the demo server would refuse', () => {
      // Every draft reachable through the select and the list, checked against the server's rule.
      const owner = archer(...rule.known);
      for (const swap of ['', ...rule.known]) {
        const swapped = swapArcaneShot(rule, start, swap);
        const list = arcaneShotListRule(rule, swapped);
        for (const first of ARCANE_SHOT_OPTIONS) {
          const one = withArcaneShotPicks(rule, swapped, toggleArcaneShot(list, swapped.selected, first));
          for (const second of ARCANE_SHOT_OPTIONS) {
            const two = withArcaneShotPicks(rule, one, toggleArcaneShot(arcaneShotListRule(rule, one), one.selected, second));
            const problem = subclassChoicesProblem(owner, ARCANE_ARCHER, 7, { arcaneShots: [...two.selected] }, { levelUp: true });
            expect(arcaneShotsComplete(rule, two.selected)).withContext(`${swap}|${first}|${second}`).toBe(problem === null);
          }
        }
      }
    });
  });

  describe('the choice from the character sheet', () => {
    const pc = (over: object = {}) => ({ clazz: 'Fighter', subclass: ARCANE_ARCHER, level: 7, ...over });

    it('lets whoever may rewrite the list let go of any known option', () => {
      const rule = arcaneShotSheetRule(pc({ subclassChoices: { arcaneShots: ['Seeking Shot', 'Shadow Shot', 'Piercing Shot'] } }), true)!;
      expect(rule).toEqual({ known: ['Seeking Shot', 'Shadow Shot', 'Piercing Shot'], count: 3, swaps: 3 });
      let picked = arcaneShotStart(rule);
      for (const name of rule.known) picked = toggleArcaneShot(rule, picked, name);
      expect(picked).toEqual([]);
      for (const name of ['Banishing Shot', 'Bursting Shot', 'Grasping Shot']) picked = toggleArcaneShot(rule, picked, name);
      expect(arcaneShotsComplete(rule, picked)).toBeTrue();
    });

    it('lets anyone else only add what is missing', () => {
      const rule = arcaneShotSheetRule(pc({ subclassChoices: { arcaneShots: ['Seeking Shot'] } }), false)!;
      expect(rule).toEqual({ known: ['Seeking Shot'], count: 3, swaps: 0 });
      expect(arcaneShotBlocked(rule, ['Seeking Shot'], 'Seeking Shot')).toBeTrue();
      expect(arcaneShotsComplete(rule, ['Seeking Shot', 'Shadow Shot', 'Piercing Shot'])).toBeTrue();
      expect(arcaneShotsComplete(rule, ['Banishing Shot', 'Shadow Shot', 'Piercing Shot'])).toBeFalse();
    });

    it('is nothing for a character without Arcane Shots', () => {
      expect(arcaneShotSheetRule(pc({ subclass: 'Champion' }), true)).toBeNull();
      expect(arcaneShotSheetRule(pc({ level: 2 }), true)).toBeNull();
      expect(arcaneShotSheetRule(pc({ clazz: 'Ranger' }), true)).toBeNull();
      expect(arcaneShotSheetRule(pc({ level: 3 }), false)).toEqual({ known: [], count: 2, swaps: 0 });
    });
  });
});
