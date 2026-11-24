import { DndSpell } from './dnd-api.types';
import { filterBySource, onlyContentSources, spellSource } from './content-source';
import { WOW_PALADIN_SUGGESTED_SPELLS } from './wow-class-variants';

/**
 * Checks the shipped World of Warcraft spell data (the real asset, served by
 * the Karma builder) for the WoW Paladin's spells.
 */
describe('World of Warcraft paladin spells (wow-spells.json)', () => {
  let wow: DndSpell[];

  beforeAll(async () => {
    const res = await fetch('/assets/data/spells/wow-spells.json');
    wow = await res.json() as DndSpell[];
  });

  const find = (name: string) => wow.find(s => s.name === name)!;

  it('adds Consecration, Guided Prayer and Divine Shield as paladin spells from World of Warcraft', () => {
    for (const name of ['Consecration', 'Guided Prayer', 'Divine Shield']) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell.classes).withContext(name).toEqual(['paladin']);
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
      expect(spell.description.length).withContext(name).toBeGreaterThan(80);
      expect(spell.description).withContext(name).not.toContain('TBD');
    }
  });

  it('records Consecration as a level-2 concentration emanation', () => {
    expect(find('Consecration')).toEqual(jasmine.objectContaining({
      level: 2, school: 'evocation', actionType: 'action', concentration: true,
      range: 'Self (15-foot Emanation)', components: ['v'], duration: 'up to 1 minute',
    }));
    expect(find('Consecration').description).toContain('1d8 Radiant');
    expect(find('Consecration').description).toContain('Fiends and Undead');
  });

  it('records Guided Prayer and Divine Shield as reactions with their triggers', () => {
    expect(find('Guided Prayer')).toEqual(jasmine.objectContaining({
      level: 3, school: 'evocation', actionType: 'reaction', concentration: false,
      range: 'Self', components: ['v'], duration: 'Instantaneous',
    }));
    expect(find('Guided Prayer').castingTrigger).toContain('Bloodied');
    expect(find('Guided Prayer').description).toContain('8d4');
    expect(find('Divine Shield')).toEqual(jasmine.objectContaining({
      level: 4, school: 'abjuration', actionType: 'reaction', range: 'Self', components: ['v'], duration: '1 round',
    }));
    expect(find('Divine Shield').castingTrigger).toContain('take damage');
    expect(find('Divine Shield').description).toContain('Immunity to all damage');
  });

  it('hides them when the World of Warcraft source is off', () => {
    const paladin = wow.filter(s => s.classes.includes('paladin'));
    expect(filterBySource(paladin, onlyContentSources('Base Game'))).toEqual([]);
    expect(filterBySource(paladin, onlyContentSources('Base Game', 'World of Warcraft')).map(s => s.name))
      .toEqual(['Consecration', 'Guided Prayer', 'Divine Shield']);
  });

  it('covers every WoW spell the paladin suggestions name', () => {
    const suggested = new Set(Object.values(WOW_PALADIN_SUGGESTED_SPELLS).flatMap(rows => rows.flatMap(r => r.spells)));
    for (const name of ['Consecration', 'Guided Prayer', 'Divine Shield']) {
      expect(suggested.has(name)).withContext(name).toBeTrue();
    }
  });
});
