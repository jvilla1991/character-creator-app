import { combatLogPageCount, describeHitDie, describeHpDelta, followerSubject } from './combat-log';

describe('combat log wording', () => {
  describe('describeHpDelta', () => {
    it('words plain damage with the hit points before and after', () => {
      expect(describeHpDelta(7, { current: 12, temp: 0 }, { current: 5, temp: 0 }))
        .toEqual({ type: 'DAMAGE', description: 'Took 7 damage. HP 12 → 5.' });
    });

    it('says how much temporary HP absorbed', () => {
      expect(describeHpDelta(7, { current: 12, temp: 3 }, { current: 8, temp: 0 })?.description)
        .toBe('Took 7 damage, 3 absorbed by temporary HP. HP 12 → 8.');
    });

    it('leaves hit points out when temporary HP absorbed all of it', () => {
      expect(describeHpDelta(3, { current: 12, temp: 5 }, { current: 12, temp: 2 })?.description)
        .toBe('Took 3 damage, all absorbed by temporary HP (5 → 2 left).');
    });

    it('adds the at-zero note only on the hit that reaches 0', () => {
      expect(describeHpDelta(9, { current: 5, temp: 0 }, { current: 0, temp: 0 })?.description)
        .toBe('Took 9 damage. HP 5 → 0. Down at 0 HP.');
      expect(describeHpDelta(9, { current: 5, temp: 0 }, { current: 0, temp: 0 }, 'Defeated.')?.description)
        .toBe('Took 9 damage. HP 5 → 0. Defeated.');
      expect(describeHpDelta(2, { current: 5, temp: 0 }, { current: 3, temp: 0 })?.description)
        .toBe('Took 2 damage. HP 5 → 3.');
    });

    it('words healing by what it actually restored', () => {
      expect(describeHpDelta(-8, { current: 17, temp: 0 }, { current: 20, temp: 0 }))
        .toEqual({ type: 'HEALING', description: 'Healed 3. HP 17 → 20.' });
    });

    it('is null when no number moved', () => {
      expect(describeHpDelta(-5, { current: 20, temp: 0 }, { current: 20, temp: 0 })).toBeNull();
      expect(describeHpDelta(6, { current: 0, temp: 0 }, { current: 0, temp: 0 })).toBeNull();
      expect(describeHpDelta(0, { current: 9, temp: 0 }, { current: 9, temp: 0 })).toBeNull();
    });
  });

  it('describeHitDie words the heal, and is null when it healed nothing', () => {
    expect(describeHitDie(10, 16))
      .toEqual({ type: 'HEALING', description: 'Spent a Hit Die and healed 6. HP 10 → 16.' });
    expect(describeHitDie(20, 20)).toBeNull();
  });

  it('followerSubject names the owner when there is one', () => {
    expect(followerSubject('Wolf', 'Thorin')).toBe("Wolf (Thorin's follower)");
    expect(followerSubject('Wolf', null)).toBe('Wolf');
    expect(followerSubject(' ', 'Thorin')).toBe("Follower (Thorin's follower)");
  });

  it('combatLogPageCount is never below one page', () => {
    expect(combatLogPageCount(0, 10)).toBe(1);
    expect(combatLogPageCount(10, 10)).toBe(1);
    expect(combatLogPageCount(11, 10)).toBe(2);
    expect(combatLogPageCount(23, 10)).toBe(3);
    expect(combatLogPageCount(5, 0)).toBe(1);
  });
});
