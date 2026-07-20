import { PcSpell } from '../models/pc';
import { PREPARED_SPELLS, countPreparedSpells, isSpellPrepared, preparedSpellCap } from './spell-preparation';

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
