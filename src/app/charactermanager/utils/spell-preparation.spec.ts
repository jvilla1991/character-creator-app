import { PcSpell } from '../models/pc';
import {
  PREPARED_SPELLS, canChangeSpellsAtLongRest, canToggleLongRestSpell, countPreparedSpells, isSpellPrepared,
  leveledSpells, longRestSpellChange, preparedSpellCap, preparedSpellNames, samePreparedList, withPreparedSpells,
} from './spell-preparation';

const spell = (o: Partial<PcSpell> = {}): PcSpell =>
  ({ lvl: 1, name: 'Cure Wounds', school: 'Evocation', time: '1 action', prepared: true, ...o });

describe('spell-preparation utils', () => {
  describe('PREPARED_SPELLS / preparedSpellCap', () => {
    it('covers all eight SRD prepared-caster classes with full 1–20 columns', () => {
      const classes = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
      expect(Object.keys(PREPARED_SPELLS).sort()).toEqual(classes);
      for (const c of classes) expect(PREPARED_SPELLS[c].length).withContext(c).toBe(20);
    });

    it('matches the 2024 PHB spot values', () => {
      expect(preparedSpellCap('Cleric', 1)).toBe(4);
      expect(preparedSpellCap('Sorcerer', 1)).toBe(2);   // sorcerer starts smaller
      expect(preparedSpellCap('Sorcerer', 2)).toBe(4);
      expect(preparedSpellCap('Wizard', 20)).toBe(25);   // wizard's larger high-level column
      expect(preparedSpellCap('Wizard', 16)).toBe(21);
      expect(preparedSpellCap('Warlock', 9)).toBe(10);
      expect(preparedSpellCap('Paladin', 5)).toBe(6);    // half-caster column
      expect(preparedSpellCap('Ranger', 17)).toBe(14);
      expect(preparedSpellCap('Bard', 12)).toBe(16);
      expect(preparedSpellCap('Druid', 18)).toBe(20);
    });

    it('is case/whitespace-insensitive on the class name', () => {
      expect(preparedSpellCap(' WIZARD ', 3)).toBe(6);
    });

    it('returns null for non-casters and unknown classes (no cap enforced)', () => {
      expect(preparedSpellCap('Fighter', 5)).toBeNull();
      expect(preparedSpellCap('Bloodhunter', 5)).toBeNull();
      expect(preparedSpellCap(undefined, 5)).toBeNull();
    });

    it('clamps out-of-range levels into the table', () => {
      expect(preparedSpellCap('Cleric', 0)).toBe(4);
      expect(preparedSpellCap('Cleric', 99)).toBe(22);
      expect(preparedSpellCap('Cleric', undefined)).toBe(4);
    });
  });

  describe('isSpellPrepared (missing-flag default)', () => {
    it('treats a missing prepared field as prepared, so pre-flag characters keep casting', () => {
      const legacy = { lvl: 2, name: 'Invisibility', school: 'Illusion', time: '1 action' } as PcSpell;
      expect(isSpellPrepared(legacy)).toBeTrue();
    });

    it('respects an explicit false on leveled spells', () => {
      expect(isSpellPrepared(spell({ prepared: false }))).toBeFalse();
      expect(isSpellPrepared(spell({ prepared: true }))).toBeTrue();
    });

    it('always counts cantrips as prepared, even with a stray false flag', () => {
      expect(isSpellPrepared(spell({ lvl: 0, prepared: false }))).toBeTrue();
    });
  });

  describe('countPreparedSpells', () => {
    it('counts prepared leveled spells only — cantrips never count', () => {
      const spells = [
        spell({ lvl: 0, name: 'Fire Bolt' }),
        spell({ lvl: 1, name: 'Shield' }),
        spell({ lvl: 2, name: 'Invisibility', prepared: false }),
        { lvl: 3, name: 'Fireball', school: 'Evocation', time: '1 action' } as PcSpell, // legacy, no flag
      ];
      expect(countPreparedSpells(spells)).toBe(2);
    });

    it('handles an absent spell list', () => {
      expect(countPreparedSpells(undefined)).toBe(0);
    });
  });
});

describe('spell-preparation at a long rest', () => {
  const s = (name: string, lvl: number, prepared?: boolean): PcSpell =>
    ({ name, lvl, school: 'Evocation', time: '1 action', ...(prepared === undefined ? {} : { prepared }) } as PcSpell);

  const book = [s('Guidance', 0, true), s('Bless', 1, true), s('Command', 1, false), s('Aid', 2)];

  it('says how far each class may change its list', () => {
    expect(['Cleric', 'druid', ' Wizard '].map(longRestSpellChange)).toEqual(['ANY', 'ANY', 'ANY']);
    expect(['Paladin', 'Ranger'].map(longRestSpellChange)).toEqual(['ONE', 'ONE']);
    expect(['Bard', 'Sorcerer', 'Warlock', 'Fighter', undefined].map(longRestSpellChange))
      .toEqual(['NONE', 'NONE', 'NONE', 'NONE', 'NONE']);
  });

  it('chooses from leveled spells only, and a missing flag counts as prepared', () => {
    expect(leveledSpells(book).map(x => x.name)).toEqual(['Bless', 'Command', 'Aid']);
    expect(preparedSpellNames(book)).toEqual(['Bless', 'Aid']);
    expect(preparedSpellNames(undefined)).toEqual([]);
  });

  it('knows whether a hero has spells to choose', () => {
    expect(canChangeSpellsAtLongRest({ clazz: 'Cleric', spells: book })).toBeTrue();
    expect(canChangeSpellsAtLongRest({ clazz: 'Bard', spells: book })).toBeFalse();
    expect(canChangeSpellsAtLongRest({ clazz: 'Cleric', spells: [s('Guidance', 0)] })).toBeFalse();
  });

  it('ANY: unticking is always allowed, ticking stops at the cap', () => {
    const original = ['Bless', 'Aid'];
    expect(canToggleLongRestSpell('Bless', original, original, 'ANY', 2)).toBeTrue();
    expect(canToggleLongRestSpell('Command', original, original, 'ANY', 2)).toBeFalse();
    expect(canToggleLongRestSpell('Command', original, original, 'ANY', 3)).toBeTrue();
    expect(canToggleLongRestSpell('Command', original, original, 'ANY', null)).toBeTrue(); // no cap
  });

  it('ONE: one out and one in, and either half can be undone', () => {
    const original = ['Bless', 'Aid'];
    // Nothing changed yet: may remove either, or add one under the cap.
    expect(canToggleLongRestSpell('Bless', original, original, 'ONE', 6)).toBeTrue();
    expect(canToggleLongRestSpell('Command', original, original, 'ONE', 6)).toBeTrue();
    expect(canToggleLongRestSpell('Command', original, original, 'ONE', 2)).toBeFalse(); // at the cap
    // Bless removed: no second removal; the freed place may be filled even at the cap.
    expect(canToggleLongRestSpell('Aid', original, ['Aid'], 'ONE', 2)).toBeFalse();
    expect(canToggleLongRestSpell('Command', original, ['Aid'], 'ONE', 2)).toBeTrue();
    expect(canToggleLongRestSpell('Bless', original, ['Aid'], 'ONE', 2)).toBeTrue();  // undo
    // Swapped: only the two undo moves remain.
    const swapped = ['Aid', 'Command'];
    expect(canToggleLongRestSpell('Hold Person', original, swapped, 'ONE', 6)).toBeFalse();
    expect(canToggleLongRestSpell('Aid', original, swapped, 'ONE', 6)).toBeFalse();
    expect(canToggleLongRestSpell('Command', original, swapped, 'ONE', 6)).toBeTrue();
    expect(canToggleLongRestSpell('Bless', original, swapped, 'ONE', 6)).toBeTrue();
  });

  it('NONE: nothing can be toggled', () => {
    expect(canToggleLongRestSpell('Bless', ['Bless'], ['Bless'], 'NONE', 4)).toBeFalse();
  });

  it('compares lists as sets', () => {
    expect(samePreparedList(['Bless', 'Aid'], ['Aid', 'Bless'])).toBeTrue();
    expect(samePreparedList(['Bless', 'Aid'], ['Aid'])).toBeFalse();
    expect(samePreparedList(['Bless'], ['Aid'])).toBeFalse();
  });

  it('writes a chosen list onto the spells, leaving cantrips alone', () => {
    const after = withPreparedSpells(book, ['command', 'Aid']);
    expect(after.map(x => [x.name, x.prepared])).toEqual([
      ['Guidance', true], ['Bless', false], ['Command', true], ['Aid', true],
    ]);
    expect(book[1].prepared).toBeTrue(); // the original is not mutated
  });
});
