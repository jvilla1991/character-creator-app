import {
  modFromScore, fmtMod, hitDieFor, tintFor, SKILL_DEFS, CLASS_HIT_DICE,
  CASTING_ABILITY, spellSaveDc, spellAttackBonus,
  passiveScore, proficiencyBonus, skillAutoLines, skillFullName, skillModifier,
} from './character-math';
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

  // ── Spell save DC / attack bonus ────────────────────────────────────────────

  describe('spellSaveDc / spellAttackBonus', () => {
    const caster = (clazz: string, stats: Partial<NonNullable<PC['stats']>>, prof?: number): PC => ({
      id: 1, name: 'Test', clazz, level: 5, playerName: 'p',
      prof,
      stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10, ...stats },
    });

    it('maps every casting class to its 2024 ability', () => {
      expect(CASTING_ABILITY['Bard']).toBe('CHA');
      expect(CASTING_ABILITY['Paladin']).toBe('CHA');
      expect(CASTING_ABILITY['Sorcerer']).toBe('CHA');
      expect(CASTING_ABILITY['Warlock']).toBe('CHA');
      expect(CASTING_ABILITY['Cleric']).toBe('WIS');
      expect(CASTING_ABILITY['Druid']).toBe('WIS');
      expect(CASTING_ABILITY['Ranger']).toBe('WIS');
      expect(CASTING_ABILITY['Wizard']).toBe('INT');
    });

    it('DC = 8 + prof + casting mod (Wizard, INT 18, prof +3 → 15)', () => {
      expect(spellSaveDc(caster('Wizard', { INT: 18 }, 3))).toBe(15);
    });

    it('attack bonus = prof + casting mod (Wizard, INT 18, prof +3 → +7)', () => {
      expect(spellAttackBonus(caster('Wizard', { INT: 18 }, 3))).toBe(7);
    });

    it('uses WIS for a Cleric and CHA for a Warlock', () => {
      expect(spellSaveDc(caster('Cleric', { WIS: 16, CHA: 8 }, 2))).toBe(13);  // 8+2+3
      expect(spellSaveDc(caster('Warlock', { CHA: 14, WIS: 8 }, 2))).toBe(12); // 8+2+2
    });

    it('handles a negative casting modifier', () => {
      expect(spellSaveDc(caster('Sorcerer', { CHA: 8 }, 2))).toBe(9);      // 8+2-1
      expect(spellAttackBonus(caster('Sorcerer', { CHA: 8 }, 2))).toBe(1); // 2-1
    });

    it('derives proficiency from level when the sheet has none stored', () => {
      // level 5 → prof +3
      expect(spellSaveDc(caster('Druid', { WIS: 16 }))).toBe(14); // 8+3+3
    });

    it('returns null for non-casters and unknown classes', () => {
      expect(spellSaveDc(caster('Fighter', { INT: 20 }, 3))).toBeNull();
      expect(spellAttackBonus(caster('Barbarian', {}, 3))).toBeNull();
      expect(spellSaveDc(caster('Artificer', {}, 3))).toBeNull();
    });
  });

  // ── Skill modifiers ─────────────────────────────────────────────────────────

  describe('skill modifiers', () => {
    /** WIS 14 (+2), DEX 16 (+3), proficiency +2. */
    const rogue = (overrides: Partial<PC> = {}): PC => ({
      id: 1, name: 'Test', clazz: 'Rogue', level: 4, playerName: 'p', prof: 2,
      stats: { STR: 10, DEX: 16, CON: 10, INT: 10, WIS: 14, CHA: 10 },
      skills: { Perception: 'prof', Stealth: 'expert' },
      ...overrides,
    });
    const lines = (pc: PC, name: string, ability: 'DEX' | 'WIS' | 'STR') =>
      skillAutoLines(pc, name, ability).map(l => `${l.label} ${l.value}${l.note ? ` (${l.note})` : ''}`);

    it('lists the ability modifier, then the proficiency bonus', () => {
      expect(lines(rogue(), 'Perception', 'WIS')).toEqual(['Wisdom 2 (score 14)', 'Proficiency 2']);
    });

    it('doubles the bonus for expertise and says so', () => {
      expect(lines(rogue(), 'Stealth', 'DEX'))
        .toEqual(['Dexterity 3 (score 16)', 'Expertise 4 (twice the proficiency bonus of +2)']);
    });

    it('shows a +0 proficiency line, explained, for a skill the character is not proficient in', () => {
      expect(lines(rogue(), 'Athletics', 'STR'))
        .toEqual(['Strength 0 (score 10)', 'Proficiency 0 (not proficient in Athletics)']);
    });

    it('reads a short-form proficiency key ("Animal" for Animal Handling)', () => {
      const pc = rogue({ skills: { Animal: 'prof' } });
      expect(skillModifier(pc, 'Animal Handling', 'WIS')).toBe(4);
    });

    it('adds the DM lines saved on the skill', () => {
      const pc = rogue({ statAdjustments: { skillPerception: [{ value: 1, label: 'Observant' }] } });
      expect(skillModifier(pc, 'Perception', 'WIS')).toBe(5);
      // Lines on another skill do not leak in.
      expect(skillModifier(pc, 'Insight', 'WIS')).toBe(2);
    });

    it('derives the proficiency bonus from level when the sheet has none stored', () => {
      expect(proficiencyBonus({ level: 5 })).toBe(3);
      expect(proficiencyBonus({ level: 5, prof: 2 })).toBe(2);
      expect(skillModifier(rogue({ prof: undefined, level: 9 }), 'Perception', 'WIS')).toBe(6); // +2 WIS, +4 prof
    });

    it('names Sleight of Hand in full', () => {
      expect(skillFullName('Sleight')).toBe('Sleight of Hand');
      expect(skillFullName('Perception')).toBe('Perception');
    });

    it('works passive scores out from the same modifier, DM lines included', () => {
      const pc = rogue({ statAdjustments: { skillPerception: [{ value: 5, label: 'Observant' }] } });
      expect(passiveScore(pc, 'Perception', 'WIS')).toBe(19); // 10 + 2 + 2 + 5
      expect(passiveScore(pc, 'Insight', 'WIS')).toBe(12);
    });
  });
});
