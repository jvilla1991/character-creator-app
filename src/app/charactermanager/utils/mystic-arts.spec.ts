import {
  MYSTIC_FOCUS_LEVEL, MYSTIC_FOCUS_MAX_SLOT_LEVEL, isMysticArtsMonk, isMysticFocusSlotLevel, mysticArtsCantripsKnown,
  mysticArtsPreparedSpells, mysticArtsSlotTable, mysticFocusCost, mysticFocusMinLevel,
} from './mystic-arts';
import { classSlotTable, startingSlots } from './spell-slots';
import { preparedSpellCap } from './spell-preparation';
import { spellListClass } from './spellcasting';
import { castingAbilityOf, spellAttackBonus, spellSaveDc } from './character-math';
import { arcanaFeatOptions, hasSpellcastingOrPactMagic, highestSpellSlotLevel } from '../models/arcana-feats';
import { featSpellsOwed } from '../models/granted-spells';
import { ARCANA_SUBCLASS_PICKS, HANDBOOK_SUBCLASS_PICKS, startingSpellPicksFor } from '../models/recommended-spells';
import { spellKey } from '../models/spell-names';
import { DndSpell } from '../models/dnd-api.types';
import { PC } from '../models/pc';
import { demoCantripsKnown, demoFeatOptions, demoPreparedSpells, demoSlotsFor } from '../services/pc.demo-data';

/**
 * The Warrior of the Mystic Arts on the client: its third-caster table at every
 * Monk level and every class-keyed lookup that reads it. The numbers are the
 * server's (MysticArtsSpellcastingTest carries the same three arrays), so the
 * two sides cannot drift apart unnoticed.
 */
describe('Warrior of the Mystic Arts spellcasting', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';

  /** The book's table, Monk level 1 to 20: slots of spell level 1 / 2 / 3 / 4. */
  const SLOTS: number[][] = [
    [0, 0, 0, 0], [0, 0, 0, 0],
    [2, 0, 0, 0],
    [3, 0, 0, 0], [3, 0, 0, 0], [3, 0, 0, 0],
    [4, 2, 0, 0], [4, 2, 0, 0], [4, 2, 0, 0],
    [4, 3, 0, 0], [4, 3, 0, 0], [4, 3, 0, 0],
    [4, 3, 2, 0], [4, 3, 2, 0], [4, 3, 2, 0],
    [4, 3, 3, 0], [4, 3, 3, 0], [4, 3, 3, 0],
    [4, 3, 3, 1], [4, 3, 3, 1],
  ];
  /** The Prepared Spells column, Monk level 1 to 20. */
  const PREPARED = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
  /** Cantrips known, Monk level 1 to 20: two from level 3, a third from level 10. */
  const CANTRIPS = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
  /** The highest spell level it has slots for, Monk level 1 to 20. */
  const HIGHEST = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4];

  const row = (slots: number[]): { [spellLevel: number]: number } => {
    const out: { [spellLevel: number]: number } = {};
    slots.forEach((max, i) => { if (max > 0) out[i + 1] = max; });
    return out;
  };
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);

  describe('the table, level by level', () => {
    it('gives the book\'s spell slots at every Monk level', () => {
      for (const level of levels) {
        expect(mysticArtsSlotTable(level)).withContext(`level ${level}`).toEqual(row(SLOTS[level - 1]));
        expect(classSlotTable('Monk', level, MYSTIC_ARTS)).withContext(`level ${level}`).toEqual(row(SLOTS[level - 1]));
      }
      // Spot rows, written out: nothing below 3, a second spell level at 7, a third at 13, a fourth at 19.
      expect(classSlotTable('Monk', 2, MYSTIC_ARTS)).toEqual({});
      expect(classSlotTable('Monk', 3, MYSTIC_ARTS)).toEqual({ 1: 2 });
      expect(classSlotTable('Monk', 6, MYSTIC_ARTS)).toEqual({ 1: 3 });
      expect(classSlotTable('Monk', 7, MYSTIC_ARTS)).toEqual({ 1: 4, 2: 2 });
      expect(classSlotTable('Monk', 10, MYSTIC_ARTS)).toEqual({ 1: 4, 2: 3 });
      expect(classSlotTable('Monk', 13, MYSTIC_ARTS)).toEqual({ 1: 4, 2: 3, 3: 2 });
      expect(classSlotTable('Monk', 16, MYSTIC_ARTS)).toEqual({ 1: 4, 2: 3, 3: 3 });
      expect(classSlotTable('Monk', 19, MYSTIC_ARTS)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 1 });
    });

    it('follows the Prepared Spells column at every Monk level', () => {
      for (const level of levels) {
        expect(mysticArtsPreparedSpells(level)).withContext(`level ${level}`).toBe(PREPARED[level - 1]);
        // The sheet's cap: no cap (null) while it prepares nothing yet.
        expect(preparedSpellCap('Monk', level, MYSTIC_ARTS)).withContext(`level ${level}`)
          .toBe(PREPARED[level - 1] || null);
      }
    });

    it('knows two cantrips from Monk 3 and three from Monk 10', () => {
      for (const level of levels) {
        expect(mysticArtsCantripsKnown(level)).withContext(`level ${level}`).toBe(CANTRIPS[level - 1]);
      }
    });

    it('clamps the level into 1-20', () => {
      expect(classSlotTable('Monk', 25, MYSTIC_ARTS)).toEqual(classSlotTable('Monk', 20, MYSTIC_ARTS));
      expect(classSlotTable('Monk', 0, MYSTIC_ARTS)).toEqual({});
      expect(mysticArtsPreparedSpells(25)).toBe(13);
      expect(mysticArtsPreparedSpells(0)).toBe(0);
      expect(mysticArtsCantripsKnown(25)).toBe(3);
      expect(mysticArtsCantripsKnown(0)).toBe(0);
    });

    it('starts a new character of the subclass with its slots, nothing spent', () => {
      expect(startingSlots('Monk', 7, MYSTIC_ARTS)).toEqual({ 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } });
      expect(startingSlots('Monk', 7)).toEqual({});
    });

    it('recognises the subclass whatever the case or spacing, and only on a Monk', () => {
      expect(isMysticArtsMonk({ clazz: ' monk ', subclass: '  warrior of the mystic arts ' })).toBeTrue();
      expect(isMysticArtsMonk({ clazz: 'Monk', subclass: 'Warrior of the Open Hand' })).toBeFalse();
      expect(isMysticArtsMonk({ clazz: 'Monk' })).toBeFalse();
      expect(isMysticArtsMonk({ clazz: 'Fighter', subclass: MYSTIC_ARTS })).toBeFalse();
      expect(isMysticArtsMonk(null)).toBeFalse();
      expect(classSlotTable('Fighter', 7, MYSTIC_ARTS)).toEqual({});
      expect(classSlotTable('Wizard', 3, MYSTIC_ARTS)).toEqual(classSlotTable('Wizard', 3));
    });
  });

  describe('everyone else is exactly as before', () => {
    it('a Monk without the subclass has no slots, no cap and no cantrips', () => {
      for (const subclass of [undefined, null, '', 'Warrior of the Open Hand', 'Warrior of Shadow', 'Warrior of Mystic Brews']) {
        for (const level of levels) {
          expect(classSlotTable('Monk', level, subclass)).withContext(`${subclass} ${level}`).toEqual({});
          expect(preparedSpellCap('Monk', level, subclass)).withContext(`${subclass} ${level}`).toBeNull();
          expect(demoCantripsKnown('Monk', level, subclass)).withContext(`${subclass} ${level}`).toBe(0);
          expect(demoPreparedSpells('Monk', level, subclass)).withContext(`${subclass} ${level}`).toBe(0);
          expect(hasSpellcastingOrPactMagic('Monk', level, subclass)).withContext(`${subclass} ${level}`).toBeFalse();
        }
      }
    });

    it('Eldritch Knight and Arcane Trickster still have no slots and do not qualify', () => {
      for (const [clazz, subclass] of [['Fighter', 'Eldritch Knight'], ['Rogue', 'Arcane Trickster']]) {
        for (const level of levels) {
          const as = `${subclass} ${level}`;
          expect(classSlotTable(clazz, level, subclass)).withContext(as).toEqual({});
          expect(preparedSpellCap(clazz, level, subclass)).withContext(as).toBeNull();
          expect(demoCantripsKnown(clazz, level, subclass)).withContext(as).toBe(0);
          expect(demoPreparedSpells(clazz, level, subclass)).withContext(as).toBe(0);
          expect(hasSpellcastingOrPactMagic(clazz, level, subclass)).withContext(as).toBeFalse();
          expect(highestSpellSlotLevel(clazz, level, subclass)).withContext(as).toBe(0);
        }
        expect(castingAbilityOf({ clazz, subclass, level: 10 })).toBeUndefined();
        expect(spellListClass({ clazz, subclass })).toBe(clazz);
      }
    });

    it('every other class gets its own answer whatever subclass is passed', () => {
      const characters: [string, string | undefined][] = [
        ['Wizard', 'Evoker'], ['Cleric', 'Arcana Domain'], ['Sorcerer', 'Draconic Sorcery'], ['Bard', undefined],
        ['Druid', 'Circle of the Moon'], ['Warlock', 'Vestige Patron'], ['Paladin', 'Oath of Devotion'],
        ['Ranger', 'Hunter'], ['Fighter', 'Arcane Archer'], ['Barbarian', undefined], ['Rogue', 'Thief'],
      ];
      for (const [clazz, subclass] of characters) {
        for (const level of levels) {
          const as = `${clazz}/${subclass} ${level}`;
          expect(classSlotTable(clazz, level, subclass)).withContext(as).toEqual(classSlotTable(clazz, level));
          expect(preparedSpellCap(clazz, level, subclass)).withContext(as).toBe(preparedSpellCap(clazz, level));
          expect(demoSlotsFor(clazz, level, subclass)).withContext(as).toEqual(demoSlotsFor(clazz, level));
          expect(demoCantripsKnown(clazz, level, subclass)).withContext(as).toBe(demoCantripsKnown(clazz, level));
          expect(demoPreparedSpells(clazz, level, subclass)).withContext(as).toBe(demoPreparedSpells(clazz, level));
        }
        expect(spellListClass({ clazz, subclass })).withContext(clazz).toBe(clazz);
      }
      expect(castingAbilityOf({ clazz: 'Wizard', subclass: 'Evoker', level: 5 })).toBe('INT');
      expect(castingAbilityOf({ clazz: 'Paladin', subclass: 'Oath of Devotion', level: 5 })).toBe('CHA');
      expect(castingAbilityOf({ clazz: 'Ranger', level: 5 })).toBe('WIS');
      expect(castingAbilityOf({ clazz: 'Barbarian', level: 5 })).toBeUndefined();
      expect(castingAbilityOf(null)).toBeUndefined();
    });
  });

  describe('casting ability and spell list', () => {
    const monk = (over: Partial<PC> = {}): PC => ({
      id: 1, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8, playerName: 'Sam', prof: 3,
      stats: { STR: 10, DEX: 16, CON: 14, INT: 8, WIS: 18, CHA: 12 }, ...over,
    });

    it('casts with Wisdom from Monk level 3', () => {
      expect(castingAbilityOf(monk())).toBe('WIS');
      expect(spellSaveDc(monk())).toBe(8 + 3 + 4);
      expect(spellAttackBonus(monk())).toBe(3 + 4);
      // A higher Charisma or Intelligence changes nothing.
      const other = monk({ stats: { STR: 10, DEX: 16, CON: 14, INT: 20, WIS: 12, CHA: 20 } });
      expect(spellSaveDc(other)).toBe(8 + 3 + 1);
      expect(spellAttackBonus(other)).toBe(3 + 1);
    });

    it('has no casting ability before its Spellcasting, or without the subclass', () => {
      expect(castingAbilityOf(monk({ level: 2 }))).toBeUndefined();
      expect(spellSaveDc(monk({ level: 2 }))).toBeNull();
      expect(spellAttackBonus(monk({ subclass: 'Warrior of the Open Hand' }))).toBeNull();
      expect(spellSaveDc(monk({ subclass: undefined }))).toBeNull();
    });

    it('learns from the Sorcerer list', () => {
      expect(spellListClass(monk())).toBe('Sorcerer');
      expect(spellListClass(monk({ subclass: 'Warrior of Shadow' }))).toBe('Monk');
      expect(spellListClass({ clazz: 'Monk' })).toBe('Monk');
    });
  });

  describe('the Spellcasting feat prerequisite', () => {
    it('is met from Monk 3, with its highest slot level', () => {
      for (const level of levels) {
        expect(hasSpellcastingOrPactMagic('Monk', level, MYSTIC_ARTS)).withContext(`level ${level}`).toBe(level >= 3);
        expect(highestSpellSlotLevel('Monk', level, MYSTIC_ARTS)).withContext(`level ${level}`).toBe(HIGHEST[level - 1]);
      }
      // Without a subclass argument the class alone decides, as before.
      expect(hasSpellcastingOrPactMagic('Monk', 10)).toBeFalse();
      expect(highestSpellSlotLevel('Monk', 20)).toBe(0);
      expect(hasSpellcastingOrPactMagic('Wizard', 1)).toBeTrue();
      expect(highestSpellSlotLevel('Paladin', 5)).toBe(2);
    });

    it('offers the School Adept feats to the Mystic Arts monk and not to another monk', () => {
      const offered = arcanaFeatOptions({ clazz: 'Monk', subclass: MYSTIC_ARTS, newLevel: 4, feats: [] });
      expect(offered).toEqual(jasmine.arrayContaining(['Evocation Adept', 'Abjuration Adept', 'Spell Subterfuge']));
      for (const subclass of ['Warrior of the Open Hand', undefined]) {
        const others = arcanaFeatOptions({ clazz: 'Monk', subclass, newLevel: 4, feats: [] });
        expect(others).not.toContain('Evocation Adept');
        expect(others).not.toContain('Spell Subterfuge');
        expect(others).toContain('Spell Resistant');
      }
      expect(arcanaFeatOptions({ clazz: 'Fighter', subclass: 'Eldritch Knight', newLevel: 4, feats: [] }))
        .not.toContain('Evocation Adept');
      // The demo feat list passes the subclass through.
      expect(demoFeatOptions('Monk', 4, undefined, [], MYSTIC_ARTS)).toContain('Evocation Adept');
      expect(demoFeatOptions('Monk', 4, undefined, [])).not.toContain('Evocation Adept');
    });

    it('hands a School Adept\'s spells over with the Monk\'s slot levels', () => {
      const adept = (level: number, subclass: string | undefined) => featSpellsOwed({
        clazz: 'Monk', subclass, spells: [],
        features: [{ name: 'Evocation Adept', source: 'Feat (Level 4)', desc: '' }],
      }, level);
      expect(adept(4, MYSTIC_ARTS).length).toBe(1);
      expect(adept(7, MYSTIC_ARTS).length).toBe(2);
      expect(adept(19, MYSTIC_ARTS).length).toBe(4);
      expect(adept(19, 'Warrior of the Open Hand')).toEqual([]);
    });
  });

  describe('Mystic Focus numbers', () => {
    it('are the book\'s Recovering Spell Slots table', () => {
      const table = [[1, 2, 6], [2, 3, 7], [3, 5, 13], [4, 6, 19]]; // slot level, cost, minimum Monk level
      for (const [slotLevel, cost, minLevel] of table) {
        expect(mysticFocusCost(slotLevel)).withContext(`cost of level ${slotLevel}`).toBe(cost);
        expect(mysticFocusMinLevel(slotLevel)).withContext(`level for ${slotLevel}`).toBe(minLevel);
        expect(isMysticFocusSlotLevel(slotLevel)).toBeTrue();
      }
      for (const bad of [0, 5, -1, 1.5, null, undefined]) {
        expect(isMysticFocusSlotLevel(bad)).withContext(String(bad)).toBeFalse();
      }
      expect(MYSTIC_FOCUS_LEVEL).toBe(6);
      expect(MYSTIC_FOCUS_MAX_SLOT_LEVEL).toBe(4);
    });
  });

  describe('recommended starting spells', () => {
    it('are the ones Arcana Unleashed names, picked at Monk level 3', () => {
      expect(ARCANA_SUBCLASS_PICKS).toEqual([{
        for: MYSTIC_ARTS, baseClass: 'Monk', classLevel: 3, source: 'Arcana Unleashed',
        cantrips: ['Blade Ward', 'Thunderclap'],
        level1Spells: ['Jump', 'Magic Missile', 'Shield'],
      }]);
      // The Player's Handbook's own two are untouched.
      expect(HANDBOOK_SUBCLASS_PICKS.map(p => p.for)).toEqual(['Eldritch Knight', 'Arcane Trickster']);
    });

    it('go to a Monk of the subclass and nobody else', () => {
      expect(startingSpellPicksFor({ clazz: 'Monk', subclass: MYSTIC_ARTS })).toEqual([ARCANA_SUBCLASS_PICKS[0]]);
      expect(startingSpellPicksFor({ clazz: 'monk', subclass: 'warrior of the mystic arts' }))
        .toEqual([ARCANA_SUBCLASS_PICKS[0]]);
      // A World of Warcraft Monk who takes the subclass gets the same picks.
      expect(startingSpellPicksFor({ clazz: 'Monk', subclass: MYSTIC_ARTS, specialization: 'Windwalker' }))
        .toEqual([ARCANA_SUBCLASS_PICKS[0]]);
      expect(startingSpellPicksFor({ clazz: 'Monk', subclass: 'Warrior of the Open Hand' })).toEqual([]);
      expect(startingSpellPicksFor({ clazz: 'Monk' })).toEqual([]);
      expect(startingSpellPicksFor({ clazz: 'Fighter', subclass: MYSTIC_ARTS })).toEqual([]);
    });

    it('are all on the Sorcerer list in the shipped spell data, at the right level', async () => {
      const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json'];
      const lists = await Promise.all(files.map(async f => (await fetch(`/assets/data/spells/${f}`)).json()));
      const byKey = new Map((lists.flat() as DndSpell[]).map(s => [s.name.toLowerCase(), s]));
      const picks = ARCANA_SUBCLASS_PICKS[0];
      for (const [names, level] of [[picks.cantrips, 0], [picks.level1Spells, 1]] as const) {
        for (const name of names) {
          const spell = byKey.get(spellKey(name));
          expect(spell).withContext(name).toBeDefined();
          expect(spell!.level).withContext(name).toBe(level);
          expect(spell!.classes).withContext(name).toContain('sorcerer');
        }
      }
    });
  });
});
