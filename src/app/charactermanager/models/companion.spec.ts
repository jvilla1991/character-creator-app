import { FollowerStatBlock, mayDismiss } from './follower';
import { companionCarriedOver, companionEdit, isCompanion } from './companion';

const block = (max: number, cur: number, temp: number, conditions: string[] = []): FollowerStatBlock => ({
  ac: 17,
  hp: { max, cur, temp },
  conditions,
  conditionImmunities: ['charmed', 'frightened', 'prone'],
});

describe('companions (server-owned followers)', () => {
  it('isCompanion is the COMPANION kind and nothing else', () => {
    expect(isCompanion({ kind: 'COMPANION' })).toBeTrue();
    expect(isCompanion({ kind: 'DM_GRANT' })).toBeFalse();
    expect(isCompanion({ kind: 'SUMMON' })).toBeFalse();
    expect(isCompanion({ kind: 'FAMILIAR' })).toBeFalse();
    expect(isCompanion({})).toBeFalse();
  });

  it('nobody may dismiss one: the DM dismisses any other follower, the owner their own summon or familiar', () => {
    for (const asDm of [true, false]) {
      expect(mayDismiss({ kind: 'COMPANION' }, asDm)).withContext(`asDm ${asDm}`).toBeFalse();
    }
    expect(mayDismiss({ kind: 'DM_GRANT' }, true)).toBeTrue();
    expect(mayDismiss({}, true)).toBeTrue();
    expect(mayDismiss({ kind: 'SUMMON' }, true)).toBeTrue();
    expect(mayDismiss({ kind: 'FAMILIAR' }, true)).toBeTrue();
    expect(mayDismiss({ kind: 'DM_GRANT' }, false)).toBeFalse();
    expect(mayDismiss({}, false)).toBeFalse();
    expect(mayDismiss({ kind: 'SUMMON' }, false)).toBeTrue();
    expect(mayDismiss({ kind: 'FAMILIAR' }, false)).toBeTrue();
  });

  describe('an edit', () => {
    it('takes only the current Hit Points, the temporary Hit Points and the conditions', () => {
      const edited: FollowerStatBlock = {
        ...block(999, 9, 5, ['poisoned']), ac: 30, clazz: 'Dragon', conditionImmunities: [],
        spells: [{ name: 'Wish', lvl: 9, school: 'Conjuration', time: '1 action', prepared: true }],
      };
      expect(companionEdit(block(24, 24, 0), edited)).toEqual(block(24, 9, 5, ['poisoned']));
    });

    it('keeps the Hit Points within the stored maximum and never below zero', () => {
      expect(companionEdit(block(24, 24, 0), block(60, 60, -4)).hp).toEqual({ max: 24, cur: 24, temp: 0 });
      expect(companionEdit(block(24, 24, 0), block(24, -3, 0)).hp).toEqual({ max: 24, cur: 0, temp: 0 });
    });

    it('drops a condition the companion is immune to, a duplicate and junk', () => {
      const conditions = ['Prone', 'poisoned', 'Poisoned', ' ', 7, 'x'.repeat(41), 'blinded'] as string[];
      expect(companionEdit(block(24, 24, 0), { conditions }).conditions).toEqual(['poisoned', 'blinded']);
    });

    it('keeps what the edit leaves out', () => {
      const stored = block(24, 11, 3, ['stunned']);
      expect(companionEdit(stored, { ac: 2 })).toEqual(stored);
      expect(companionEdit(stored, { conditions: [] })).toEqual(block(24, 11, 3, []));
    });

    it('leaves the stored block as it was', () => {
      const stored = block(24, 11, 3, ['stunned']);
      companionEdit(stored, block(24, 1, 0, []));
      expect(stored).toEqual(block(24, 11, 3, ['stunned']));
    });
  });

  describe('a rebuild', () => {
    it('raises the current Hit Points by the growth of the maximum', () => {
      expect(companionCarriedOver(block(28, 28, 0), block(24, 9, 0)).hp).toEqual({ max: 28, cur: 13, temp: 0 });
      expect(companionCarriedOver(block(28, 28, 0), block(24, 24, 0)).hp).toEqual({ max: 28, cur: 28, temp: 0 });
      expect(companionCarriedOver(block(28, 28, 0), block(24, 0, 0)).hp).toEqual({ max: 28, cur: 4, temp: 0 });
    });

    it('adds nothing for an unchanged or lower maximum, and caps at the new one', () => {
      expect(companionCarriedOver(block(24, 24, 0), block(24, 9, 0)).hp).toEqual({ max: 24, cur: 9, temp: 0 });
      expect(companionCarriedOver(block(20, 20, 0), block(24, 24, 0)).hp).toEqual({ max: 20, cur: 20, temp: 0 });
      expect(companionCarriedOver(block(20, 20, 0), block(24, 9, 0)).hp).toEqual({ max: 20, cur: 9, temp: 0 });
    });

    it('keeps the temporary Hit Points and the conditions, and nothing else of the old block', () => {
      const stored: FollowerStatBlock = { ...block(24, 10, 7, ['poisoned', 'stunned']), ac: 99, bio: 'old' };
      expect(companionCarriedOver(block(24, 24, 0), stored)).toEqual(block(24, 10, 7, ['poisoned', 'stunned']));
    });

    it('leaves the fresh block full when the stored one has no readable Hit Points', () => {
      expect(companionCarriedOver(block(24, 24, 0), {}).hp).toEqual({ max: 24, cur: 24, temp: 0 });
      expect(companionCarriedOver(block(24, 24, 0), {}).conditions).toEqual([]);
    });
  });
});
