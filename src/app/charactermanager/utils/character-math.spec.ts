import { modFromScore, fmtMod, hitDieFor, tintFor, SKILL_DEFS, CLASS_HIT_DICE } from './character-math';
import { PC } from '../models/pc';

describe('character-math', () => {

  // ── modFromScore ────────────────────────────────────────────────────────────

  describe('modFromScore', () => {
    const cases: [number, number][] = [
      [1,  -5],
      [2,  -4],
      [3,  -4],
      [4,  -3],
      [7,  -2],
      [8,  -1],
      [9,  -1],
      [10,  0],
      [11,  0],
      [12,  1],
      [13,  1],
      [14,  2],
      [15,  2],
      [16,  3],
      [17,  3],
      [18,  4],
      [20,  5],
      [30, 10],
    ];

    cases.forEach(([score, expected]) => {
      it(`score ${score} → modifier ${expected}`, () => {
        expect(modFromScore(score)).toBe(expected);
      });
    });
  });

  // ── fmtMod ──────────────────────────────────────────────────────────────────

  describe('fmtMod', () => {
    it('prefixes positive modifiers with +', () => {
      expect(fmtMod(3)).toBe('+3');
      expect(fmtMod(1)).toBe('+1');
    });

    it('prefixes zero modifier with +', () => {
      expect(fmtMod(0)).toBe('+0');
    });

    it('negative modifiers include − sign without +', () => {
      expect(fmtMod(-1)).toBe('-1');
      expect(fmtMod(-4)).toBe('-4');
    });
  });

  // ── hitDieFor ───────────────────────────────────────────────────────────────

  describe('hitDieFor', () => {
    it('returns d12 for Barbarian', () => expect(hitDieFor('Barbarian')).toBe(12));
    it('returns d10 for Fighter',   () => expect(hitDieFor('Fighter')).toBe(10));
    it('returns d10 for Paladin',   () => expect(hitDieFor('Paladin')).toBe(10));
    it('returns d10 for Ranger',    () => expect(hitDieFor('Ranger')).toBe(10));
    it('returns d8 for Bard',       () => expect(hitDieFor('Bard')).toBe(8));
    it('returns d8 for Cleric',     () => expect(hitDieFor('Cleric')).toBe(8));
    it('returns d8 for Druid',      () => expect(hitDieFor('Druid')).toBe(8));
    it('returns d8 for Monk',       () => expect(hitDieFor('Monk')).toBe(8));
    it('returns d8 for Rogue',      () => expect(hitDieFor('Rogue')).toBe(8));
    it('returns d8 for Warlock',    () => expect(hitDieFor('Warlock')).toBe(8));
    it('returns d6 for Sorcerer',   () => expect(hitDieFor('Sorcerer')).toBe(6));
    it('returns d6 for Wizard',     () => expect(hitDieFor('Wizard')).toBe(6));
    it('defaults to d8 for unknown class', () => expect(hitDieFor('Commoner')).toBe(8));
  });

  // ── tintFor ─────────────────────────────────────────────────────────────────

  describe('tintFor', () => {
    const tints = ['celestial', 'gold', 'crimson', 'violet', 'emerald'];

    tints.forEach(tint => {
      it(`returns a non-empty string for tint "${tint}"`, () => {
        const pc = { portraitTint: tint } as PC;
        expect(tintFor(pc).length).toBeGreaterThan(0);
      });
    });

    it('falls back to celestial for unknown tint', () => {
      const withKnown   = tintFor({ portraitTint: 'celestial' } as PC);
      const withUnknown = tintFor({ portraitTint: 'purple' }    as any);
      expect(withUnknown).toBe(withKnown);
    });

    it('falls back to celestial when portraitTint is undefined', () => {
      const withKnown   = tintFor({ portraitTint: 'celestial' } as PC);
      const withUndefined = tintFor({} as PC);
      expect(withUndefined).toBe(withKnown);
    });
  });

  // ── SKILL_DEFS ──────────────────────────────────────────────────────────────

  describe('SKILL_DEFS', () => {
    it('has exactly 18 skills', () => {
      expect(SKILL_DEFS.length).toBe(18);
    });

    it('each skill has a name and a governing ability', () => {
      const validAbilities = new Set(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
      SKILL_DEFS.forEach(([name, ability]) => {
        expect(name.length).toBeGreaterThan(0);
        expect(validAbilities.has(ability)).toBeTrue();
      });
    });

    it('contains Acrobatics (DEX)', () => {
      expect(SKILL_DEFS).toContain(['Acrobatics', 'DEX']);
    });

    it('contains Perception (WIS)', () => {
      expect(SKILL_DEFS).toContain(['Perception', 'WIS']);
    });

    it('skill names are unique', () => {
      const names = SKILL_DEFS.map(([n]) => n);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  // ── CLASS_HIT_DICE coverage ──────────────────────────────────────────────────

  describe('CLASS_HIT_DICE', () => {
    it('covers all 12 2024 PHB classes', () => {
      const classes = ['Barbarian','Bard','Cleric','Druid','Fighter',
                       'Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
      classes.forEach(c => expect(CLASS_HIT_DICE[c]).toBeDefined());
    });
  });
});
