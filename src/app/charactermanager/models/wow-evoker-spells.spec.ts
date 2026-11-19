import { DndSpell } from './dnd-api.types';
import { filterBySource, spellSource } from './content-source';
import { spellKey } from './spell-names';
import { WOW_EVOKER_GUIDANCE, WOW_EVOKER_SPELL_TABLE, WOW_EVOKER_SUGGESTED_SPELLS } from './wow-class-variants';
import { spellNames } from './hero-class';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * for the WoW Evoker: its sixteen World of Warcraft spells (full text), and that
 * every spell its table, guidance and suggestions name resolves at the right level.
 */
describe('World of Warcraft evoker spells (wow-spells.json)', () => {
  /** name → [level, concentration], as the book prints them. */
  const NEW_SPELLS: Record<string, [number, boolean]> = {
    'Azure Strike': [1, false], 'Ebon Might': [1, false], 'Living Flame': [1, false],
    'Dream Breath': [2, false], 'Eruption': [2, false], 'Blistering Scales': [3, true],
    'Emerald Blossom': [3, true], 'Upheaval': [4, false], 'Emberstorm': [4, false],
    'Time Dilation': [4, false], 'Breath of Eons': [4, true], 'Shattering Star': [5, false],
    'Dream Flight': [5, true], 'Rescue': [5, false], 'Azure Sweep': [6, false],
    'Lay Waste': [7, false],
  };
  let wow: DndSpell[];
  let index: Map<string, DndSpell>;

  beforeAll(async () => {
    const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json'];
    const [srd, phb, wowData] = await Promise.all(
      files.map(f => fetch(`/assets/data/spells/${f}`).then(r => r.json() as Promise<DndSpell[]>)));
    wow = wowData;
    index = new Map([...srd, ...phb, ...wowData].map(s => [s.name.toLowerCase(), s]));
  });

  const find = (name: string) => wow.find(s => s.name === name)!;

  it('adds the sixteen Evoker spells as sorcerer spells from World of Warcraft, with full text', () => {
    for (const [name, [level, concentration]] of Object.entries(NEW_SPELLS)) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell.level).withContext(name).toBe(level);
      expect(spell.concentration).withContext(name).toBe(concentration);
      expect(spell.classes).withContext(name).toEqual(['sorcerer']);
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
      expect(JSON.stringify(spell)).withContext(name).not.toContain('TBD');
      expect(spell.description.length).withContext(name).toBeGreaterThan(40);
      expect(spell.eli5).withContext(name).toBeTruthy();
      expect(spell.range).withContext(name).toBeTruthy();
      expect(spell.duration).withContext(name).toBeTruthy();
      expect((spell as DndSpell & { _note?: string })._note).withContext(name).toBeUndefined();
    }
  });

  it('records Breath of Eons as a level-4 concentration spell (the book, not the old inferred 5)', () => {
    expect(find('Breath of Eons')).toEqual(jasmine.objectContaining({
      level: 4, school: 'abjuration', concentration: true, range: 'Self', duration: 'up to 1 minute',
    }));
  });

  it('hides them when the World of Warcraft source is off', () => {
    const sorcerer = wow.filter(s => s.classes.includes('sorcerer'));
    expect(sorcerer.map(s => s.name)).toEqual(Object.keys(NEW_SPELLS));
    expect(filterBySource(sorcerer, { 'Base Game': true, 'World of Warcraft': false })).toEqual([]);
    expect(filterBySource(sorcerer, { 'Base Game': true, 'World of Warcraft': true }).length).toBe(16);
  });

  it('resolves every Evoker Spells table entry (Sorcerer 3/5/7/9)', () => {
    for (const row of WOW_EVOKER_SPELL_TABLE) {
      for (const name of [...spellNames(row.all), ...Object.values(row.bySpecialization).flatMap(c => spellNames(c))]) {
        expect(index.get(spellKey(name))).withContext(name).toBeDefined();
      }
    }
  });

  it('keeps every suggested spell at its suggested level, aliases resolved', () => {
    for (const [spec, rows] of Object.entries(WOW_EVOKER_SUGGESTED_SPELLS)) {
      for (const row of rows) {
        for (const name of row.spells) {
          expect(index.get(spellKey(name))?.level).withContext(`${spec}: ${name}`).toBe(row.level);
        }
      }
    }
    expect(index.get(spellKey("Otiluke's Freezing Sphere"))?.name).toBe('Freezing Sphere');
  });

  it('keeps the recommended cantrips at level 0 and the spells to prepare at levels 1–2, all on the sorcerer list', () => {
    for (const g of Object.values(WOW_EVOKER_GUIDANCE)) {
      for (const name of g.cantrips ?? []) {
        expect(index.get(spellKey(name))?.level).withContext(name).toBe(0);
        expect(index.get(spellKey(name))?.classes).withContext(name).toContain('sorcerer');
      }
      for (const name of g.extraPrepared ?? []) {
        expect([1, 2]).withContext(name).toContain(index.get(spellKey(name))!.level);
        expect(index.get(spellKey(name))?.classes).withContext(name).toContain('sorcerer');
      }
    }
  });
});
