import { ClassFeatureProgressionEntry } from './class-feature';
import { DndSpell } from './dnd-api.types';
import {
  HANDBOOK_CLASS_PICKS, HANDBOOK_SUBCLASS_PICKS, handbookClassPicks, handbookStartingSpells, readsSubclassSpellList,
  startingSpellPicksFor, subclassSpellList,
} from './recommended-spells';
import { spellKey } from './spell-names';

describe('recommended spells', () => {
  describe("Player's Handbook starting spells", () => {
    it('covers the eight spellcasting classes and no others', () => {
      expect(Object.keys(HANDBOOK_CLASS_PICKS).sort())
        .toEqual(['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']);
      for (const clazz of ['Barbarian', 'Fighter', 'Monk', 'Rogue', '', null, undefined]) {
        expect(handbookClassPicks(clazz)).withContext(String(clazz)).toBeUndefined();
        expect(handbookStartingSpells(clazz)).withContext(String(clazz)).toEqual([]);
      }
    });

    it("lists each class's recommended cantrips and level 1 spells as the handbook names them", () => {
      expect(handbookClassPicks('Bard')).toEqual(jasmine.objectContaining({
        for: 'Bard', baseClass: 'Bard', classLevel: 1, source: "Player's Handbook",
        cantrips: ['Dancing Lights', 'Vicious Mockery'],
        level1Spells: ['Charm Person', 'Color Spray', 'Dissonant Whispers', 'Healing Word'],
      }));
      expect(handbookStartingSpells('cleric'))
        .toEqual(['Guidance', 'Sacred Flame', 'Thaumaturgy', 'Bless', 'Cure Wounds', 'Guiding Bolt', 'Shield of Faith']);
      expect(handbookStartingSpells('Druid'))
        .toEqual(['Druidcraft', 'Produce Flame', 'Animal Friendship', 'Cure Wounds', 'Faerie Fire', 'Thunderwave']);
      expect(handbookStartingSpells('Sorcerer'))
        .toEqual(['Light', 'Prestidigitation', 'Shocking Grasp', 'Sorcerous Burst', 'Burning Hands', 'Detect Magic']);
      expect(handbookStartingSpells('Warlock')).toEqual(['Eldritch Blast', 'Prestidigitation', 'Charm Person', 'Hex']);
    });

    it('gives Paladins and Rangers level 1 spells only: they learn no cantrips at level 1', () => {
      expect(handbookClassPicks('Paladin')!.cantrips).toEqual([]);
      expect(handbookStartingSpells('Paladin')).toEqual(['Heroism', 'Searing Smite']);
      expect(handbookClassPicks('Ranger')!.cantrips).toEqual([]);
      expect(handbookStartingSpells(' ranger ')).toEqual(['Cure Wounds', 'Ensnaring Strike']);
    });

    it("calls a Wizard's six level 1 spells its spellbook", () => {
      const wizard = handbookClassPicks('Wizard')!;
      expect(wizard.level1Label).toBe('Spellbook');
      expect(wizard.cantrips).toEqual(['Light', 'Mage Hand', 'Ray of Frost']);
      expect(wizard.level1Spells)
        .toEqual(['Detect Magic', 'Feather Fall', 'Mage Armor', 'Magic Missile', 'Sleep', 'Thunderwave']);
      expect(handbookClassPicks('Bard')!.level1Label).toBeUndefined();
    });

    it('returns the same array each time, so a template binding stays stable', () => {
      expect(handbookStartingSpells('Bard')).toBe(handbookStartingSpells('bard'));
      expect(handbookStartingSpells('Fighter')).toBe(handbookStartingSpells('Rogue'));
    });

    it('covers the two subclasses that learn spells at level 3', () => {
      expect(HANDBOOK_SUBCLASS_PICKS.map(p => [p.for, p.baseClass, p.classLevel])).toEqual([
        ['Eldritch Knight', 'Fighter', 3], ['Arcane Trickster', 'Rogue', 3],
      ]);
      expect(HANDBOOK_SUBCLASS_PICKS[0].cantrips).toEqual(['Ray of Frost', 'Shocking Grasp']);
      expect(HANDBOOK_SUBCLASS_PICKS[0].level1Spells).toEqual(['Burning Hands', 'Jump', 'Shield']);
      // Mage Hand is given to every Arcane Trickster, so it is not one of the recommended picks.
      expect(HANDBOOK_SUBCLASS_PICKS[1].cantrips).toEqual(['Mind Sliver', 'Minor Illusion']);
      expect(HANDBOOK_SUBCLASS_PICKS[1].level1Spells).toEqual(['Charm Person', 'Disguise Self', 'Fog Cloud']);
    });
  });

  /** Checks every pick against the shipped spell data (the real assets, served by the Karma builder). */
  describe('against the spell data', () => {
    let byKey: Map<string, DndSpell>;

    beforeAll(async () => {
      const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json'];
      const lists = await Promise.all(files.map(async f => (await fetch(`/assets/data/spells/${f}`)).json()));
      byKey = new Map((lists.flat() as DndSpell[]).map(s => [s.name.toLowerCase(), s]));
    });

    it('finds every class pick on that class list, at the right level', () => {
      for (const [clazz, picks] of Object.entries(HANDBOOK_CLASS_PICKS)) {
        for (const name of picks.cantrips) {
          const spell = byKey.get(spellKey(name));
          expect(spell).withContext(`${clazz}: ${name}`).toBeDefined();
          expect(spell!.level).withContext(`${clazz}: ${name}`).toBe(0);
          expect(spell!.classes).withContext(`${clazz}: ${name}`).toContain(clazz);
        }
        for (const name of picks.level1Spells) {
          const spell = byKey.get(spellKey(name));
          expect(spell).withContext(`${clazz}: ${name}`).toBeDefined();
          expect(spell!.level).withContext(`${clazz}: ${name}`).toBe(1);
          expect(spell!.classes).withContext(`${clazz}: ${name}`).toContain(clazz);
        }
      }
    });

    it('finds every Eldritch Knight and Arcane Trickster pick on the Wizard list', () => {
      for (const picks of HANDBOOK_SUBCLASS_PICKS) {
        for (const [names, level] of [[picks.cantrips, 0], [picks.level1Spells, 1]] as const) {
          for (const name of names) {
            const spell = byKey.get(spellKey(name));
            expect(spell).withContext(`${picks.for}: ${name}`).toBeDefined();
            expect(spell!.level).withContext(`${picks.for}: ${name}`).toBe(level);
            expect(spell!.classes).withContext(`${picks.for}: ${name}`).toContain('wizard');
          }
        }
      }
    });
  });

  describe('startingSpellPicksFor', () => {
    const picksFor = (clazz: string, subclass?: string | null, specialization?: string | null) =>
      startingSpellPicksFor({ clazz, subclass, specialization });

    it("gives a base-game spellcaster the Player's Handbook picks for its class", () => {
      expect(picksFor('Bard')).toEqual([HANDBOOK_CLASS_PICKS['bard']]);
      // A base-game subclass doesn't change the class's starting spells.
      expect(picksFor('Paladin', 'Oath of Devotion')).toEqual([HANDBOOK_CLASS_PICKS['paladin']]);
      expect(picksFor('warlock', 'Fiend Patron')).toEqual([HANDBOOK_CLASS_PICKS['warlock']]);
    });

    it('gives a character that casts no spells nothing', () => {
      expect(picksFor('Barbarian', 'Path of the Berserker')).toEqual([]);
      expect(picksFor('Fighter', 'Champion')).toEqual([]);
      expect(picksFor('Rogue')).toEqual([]);
      expect(picksFor('Monk', 'Warrior of Mercy', 'Mistweaver')).toEqual([]);
      expect(picksFor('Barbarian', 'Path of the Elements', 'Elemental')).toEqual([]);
      expect(startingSpellPicksFor(null)).toEqual([]);
      expect(startingSpellPicksFor({})).toEqual([]);
    });

    it('gives an Eldritch Knight and an Arcane Trickster their subclass picks', () => {
      expect(picksFor('Fighter', 'Eldritch Knight')).toEqual([HANDBOOK_SUBCLASS_PICKS[0]]);
      expect(picksFor('Rogue', 'arcane trickster')).toEqual([HANDBOOK_SUBCLASS_PICKS[1]]);
      // The subclass belongs to one class only.
      expect(picksFor('Rogue', 'Eldritch Knight')).toEqual([]);
      // A World of Warcraft Warrior or Rogue who takes the subclass gets the same picks.
      expect(picksFor('Fighter', 'Eldritch Knight', 'Arms')).toEqual([HANDBOOK_SUBCLASS_PICKS[0]]);
      expect(picksFor('Rogue', 'Arcane Trickster', 'Subtlety')).toEqual([HANDBOOK_SUBCLASS_PICKS[1]]);
    });

    it("gives a Death Knight the Paladin's picks and a Demon Hunter the Ranger's", () => {
      expect(picksFor('Paladin', 'Oath of the Ebon Blade', 'Frost')).toEqual([HANDBOOK_CLASS_PICKS['paladin']]);
      expect(picksFor('Ranger', 'Demon Hunter', 'Havoc')).toEqual([HANDBOOK_CLASS_PICKS['ranger']]);
    });

    it("gives a World of Warcraft specialization the World of Warcraft book's picks instead", () => {
      expect(picksFor('Paladin', null, 'Holy')).toEqual([{
        for: 'Holy Paladin', baseClass: 'Paladin', classLevel: 1, source: 'World of Warcraft',
        cantrips: [], level1Spells: ['Cure Wounds', 'Shield of Faith'], level1Label: undefined,
      }]);
      const [balance] = picksFor('Druid', 'Circle of the Stars', 'Balance');
      expect(balance.for).toBe('Balance Druid');
      expect(balance.cantrips).toEqual(['Druidcraft', 'Starry Wisp', 'Wrath']);
      expect(balance.level1Spells).toEqual(['Cure Wounds', 'Entangle', 'Moonfire', 'Thunderwave']);
      const [fire] = picksFor('Wizard', null, 'Fire');
      expect(fire.for).toBe('Fire Mage');
      expect(fire.level1Label).toBe('Spellbook');
      // An Evoker's guidance names cantrips only; its spells to prepare stay on the hero-class panel.
      const [evoker] = picksFor('Sorcerer', 'Draconic Sorcery', 'Devastation');
      expect(evoker.for).toBe('Devastation Evoker');
      expect(evoker.cantrips).toEqual(['Elementalism', 'Light', 'Ray of Frost', 'Sorcerous Burst']);
      expect(evoker.level1Spells).toEqual([]);
    });
  });

  describe('subclassSpellList', () => {
    const feature = (name: string, level: number, desc: string, subclass = true): ClassFeatureProgressionEntry =>
      ({ name, level, desc, subclass });

    const DEVOTION = feature('Oath of Devotion Spells', 3, 'You always have these spells prepared. '
      + '3rd — Protection from Evil and Good, Shield of Faith; 5th — Aid, Zone of Truth; '
      + '9th — Beacon of Hope, Dispel Magic; 13th — Freedom of Movement, Guardian of Faith; '
      + '17th — Commune, Flame Strike.');

    it("reads the list out of the subclass feature's own text, by class level", () => {
      const list = subclassSpellList([
        feature('Divine Smite', 2, 'You always have the Divine Smite spell prepared.', false),
        DEVOTION,
        feature('Sacred Weapon', 3, 'Imbue a weapon for 10 minutes.'),
      ]);
      expect(list).toEqual({
        title: 'Oath of Devotion Spells',
        rows: [
          { classLevel: 3, spells: ['Protection from Evil and Good', 'Shield of Faith'] },
          { classLevel: 5, spells: ['Aid', 'Zone of Truth'] },
          { classLevel: 9, spells: ['Beacon of Hope', 'Dispel Magic'] },
          { classLevel: 13, spells: ['Freedom of Movement', 'Guardian of Faith'] },
          { classLevel: 17, spells: ['Commune', 'Flame Strike'] },
        ],
      });
    });

    it('keeps proper names and slashes in spell names', () => {
      const list = subclassSpellList([feature('Great Old One Spells', 3, 'You always have these spells prepared. '
        + "3rd — Detect Thoughts, Tasha's Hideous Laughter; 7th — Evard's Black Tentacles, Blindness/Deafness.")]);
      expect(list!.rows).toEqual([
        { classLevel: 3, spells: ['Detect Thoughts', "Tasha's Hideous Laughter"] },
        { classLevel: 7, spells: ["Evard's Black Tentacles", 'Blindness/Deafness'] },
      ]);
    });

    it('never lets a row arrive before the feature that carries the list', () => {
      const list = subclassSpellList([feature('Late Spells', 6, '3rd — Bless; 5th — Aid; 9th — Fly.')]);
      expect(list!.rows).toEqual([{ classLevel: 6, spells: ['Bless', 'Aid'] }, { classLevel: 9, spells: ['Fly'] }]);
    });

    it('is null when no subclass feature writes a list', () => {
      expect(subclassSpellList([])).toBeNull();
      // Circle of the Land's spells are chosen again after each Long Rest, so its text has no rows.
      expect(subclassSpellList([feature('Circle of the Land Spells', 3,
        'After each Long Rest, choose a land type: Arid, Polar, Temperate, or Tropical.')])).toBeNull();
      // A class feature is never a subclass list, whatever its text says.
      expect(subclassSpellList([feature('Class Table', 3, '3rd — Bless.', false)])).toBeNull();
    });
  });

  describe('readsSubclassSpellList', () => {
    const reads = (clazz: string, subclass?: string | null, specialization?: string | null) =>
      readsSubclassSpellList({ clazz, subclass, specialization });

    it('reads the roadmap for a base-game character with a subclass', () => {
      expect(reads('Paladin', 'Oath of Devotion')).toBeTrue();
      expect(reads('Fighter', 'Champion')).toBeTrue();
      expect(reads('Paladin')).toBeFalse();
      expect(readsSubclassSpellList(null)).toBeFalse();
    });

    it('reads it for a World of Warcraft class that took a base-game subclass', () => {
      expect(reads('Paladin', 'Oath of Devotion', 'Protection')).toBeTrue();
      expect(reads('Cleric', 'Life Domain', 'Holy')).toBeTrue();
      expect(reads('Warlock', 'Fiend Patron', 'Destruction')).toBeTrue();
    });

    it('leaves the World of Warcraft tables alone: hero classes and WoW-only subclasses show their own', () => {
      expect(reads('Paladin', 'Oath of the Ebon Blade', 'Blood')).toBeFalse();
      expect(reads('Ranger', 'Demon Hunter', 'Vengeance')).toBeFalse();
      expect(reads('Sorcerer', 'Draconic Sorcery', 'Preservation')).toBeFalse();
      expect(reads('Paladin', 'Oath of the Holy', 'Holy')).toBeFalse();
      expect(reads('Cleric', 'Discipline Domain', 'Discipline')).toBeFalse();
      expect(reads('Cleric', 'Shadow Domain', 'Shadow')).toBeFalse();
    });
  });
});
