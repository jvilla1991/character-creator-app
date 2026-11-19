import { DndSpell } from './dnd-api.types';
import { filterBySource, spellSource } from './content-source';
import { spellKey } from './spell-names';
import {
  WOW_MAGE_EXTRA_SPELLS, WOW_MAGE_GUIDANCE, WOW_MAGE_SPELLS, WOW_MAGE_SUGGESTED_SPELLS,
} from './wow-class-variants';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * for the WoW Mage: its four World of Warcraft spells (full text), and that
 * every spell its guidance and suggestions name is a wizard spell of that level
 * (or one of the three base spells the WoW Mage adds to its list).
 */
describe('World of Warcraft mage spells (wow-spells.json)', () => {
  let wow: DndSpell[];
  let all: DndSpell[];

  beforeAll(async () => {
    const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json'];
    const [srd, phb, wowData] = await Promise.all(
      files.map(f => fetch(`/assets/data/spells/${f}`).then(r => r.json() as Promise<DndSpell[]>)));
    wow = wowData;
    all = [...srd, ...phb, ...wowData];
  });

  const find = (name: string) => wow.find(s => s.name === name)!;
  const lookup = (name: string) => all.find(s => s.name.toLowerCase() === spellKey(name));
  const textOf = (name: string) => find(name).description;

  it('adds Frost Nova, Flurry, Combustion and Mass Polymorph as wizard spells from World of Warcraft, with full text', () => {
    expect([...WOW_MAGE_SPELLS]).toEqual(['Frost Nova', 'Flurry', 'Combustion', 'Mass Polymorph']);
    for (const name of WOW_MAGE_SPELLS) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell.classes).withContext(name).toEqual(['wizard']);
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
      expect(spell.description).withContext(name).not.toContain('TBD');
      expect(spell.eli5).withContext(name).toBeTruthy();
    }
  });

  it('records Frost Nova: level-1 evocation, 15-foot Emanation, CON save for 2d6 Cold and Restrained, half on a success', () => {
    expect(find('Frost Nova')).toEqual(jasmine.objectContaining({
      level: 1, school: 'evocation', actionType: 'action', concentration: false, ritual: false,
      range: 'Self (15-foot Emanation)', components: ['v', 's'], duration: 'Instantaneous',
      higherLevelSlot: 'The damage increases by 1d6 for each spell slot level above 1.',
    }));
    for (const part of ['of your choice', '15-foot Emanation', 'Constitution saving throw', '2d6 Cold damage',
      'Restrained condition until the end of your next turn', 'half as much damage only']) {
      expect(textOf('Frost Nova')).withContext(part).toContain(part);
    }
  });

  it('records Flurry: level-3 evocation, three ice shards, 3d6 Cold each, Restrained on a Critical Hit', () => {
    expect(find('Flurry')).toEqual(jasmine.objectContaining({
      level: 3, school: 'evocation', actionType: 'action', concentration: false, ritual: false,
      range: '120 feet', components: ['v', 's'], duration: 'Instantaneous',
      higherLevelSlot: 'You create one more shard for each spell slot level above 3.',
    }));
    for (const part of ['three', 'one target or several', 'ranged spell attack for each shard', '3d6 Cold damage',
      'Critical Hit', 'Restrained condition until the end of your next turn']) {
      expect(textOf('Flurry')).withContext(part).toContain(part);
    }
  });

  it('records Combustion: level-6 evocation, 1 minute without Concentration, Fire Immunity, Advantage and a 3d8 aura', () => {
    const spell = find('Combustion');
    expect(spell).toEqual(jasmine.objectContaining({
      level: 6, school: 'evocation', actionType: 'action', concentration: false, ritual: false,
      range: 'Self (5-foot Emanation)', components: ['v', 's'], duration: '1 minute',
    }));
    expect(spell.higherLevelSlot).toBeUndefined();
    for (const part of ['Bright Light in a 20-foot radius', 'Dim Light for an additional 10 feet', 'Immunity to Fire damage',
      'Advantage on spell attack rolls', 'end of each of your turns', 'creature of your choice', '5-foot Emanation',
      '3d8 Fire damage']) {
      expect(spell.description).withContext(part).toContain(part);
    }
  });

  it('records Mass Polymorph: level-7 transmutation, 30-foot Emanation, Concentration, one CR 0 Beast form for all', () => {
    expect(find('Mass Polymorph')).toEqual(jasmine.objectContaining({
      level: 7, school: 'transmutation', actionType: 'action', concentration: true, ritual: false,
      range: 'Self (30-foot Emanation)', components: ['v', 's', 'm'], material: 'a caterpillar cocoon',
      duration: 'up to 1 hour',
    }));
    for (const part of ['Any number of creatures', '30-foot Emanation', 'Wisdom saving throw',
      'Beasts, Giants, Humanoids, and Monstrosities', 'succeeds on the save automatically', 'Challenge Rating of 0',
      'goat', 'alignment, personality, creature type, Hit Points, and Hit Point Dice', 'Temporary Hit Points equal',
      "can't speak or cast spells", 'gear melds into the new form']) {
      expect(textOf('Mass Polymorph')).withContext(part).toContain(part);
    }
  });

  it('hides them when the World of Warcraft source is off', () => {
    const wizard = wow.filter(s => s.classes.includes('wizard'));
    expect(wizard.map(s => s.name)).toEqual([...WOW_MAGE_SPELLS]);
    expect(filterBySource(wizard, { 'Base Game': true, 'World of Warcraft': false })).toEqual([]);
    expect(filterBySource(wizard, { 'Base Game': false, 'World of Warcraft': true }).length).toBe(4);
  });

  it('has the three added spells as existing base spells that are not on the Wizard list', () => {
    for (const name of WOW_MAGE_EXTRA_SPELLS) {
      const spell = lookup(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spellSource(spell!)).withContext(name).toBe('Base Game');
      expect(spell!.classes).withContext(name).not.toContain('wizard');
    }
  });

  it('has every guidance and suggested spell on the WoW mage list at its level', () => {
    const extras = new Set(WOW_MAGE_EXTRA_SPELLS.map(spellKey));
    const onList = (spell: DndSpell) => spell.classes.includes('wizard') || extras.has(spellKey(spell.name));
    for (const [spec, rows] of Object.entries(WOW_MAGE_SUGGESTED_SPELLS)) {
      for (const row of rows) {
        for (const name of row.spells) {
          const spell = lookup(name);
          expect(spell?.level).withContext(`${spec}: ${name}`).toBe(row.level);
          expect(spell && onList(spell)).withContext(`${spec}: ${name}`).toBeTrue();
        }
      }
    }
    for (const [spec, g] of Object.entries(WOW_MAGE_GUIDANCE)) {
      for (const [level, names] of [[0, g.cantrips ?? []], [1, g.level1Spells ?? []]] as const) {
        for (const name of names) {
          const spell = lookup(name);
          expect(spell?.level).withContext(`${spec}: ${name}`).toBe(level);
          expect(spell?.classes).withContext(`${spec}: ${name}`).toContain('wizard');
        }
      }
    }
  });
});
