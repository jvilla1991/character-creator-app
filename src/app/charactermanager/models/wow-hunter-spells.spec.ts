import { DndSpell } from './dnd-api.types';
import { filterBySource, spellSource } from './content-source';
import { WOW_HUNTER_GUIDANCE, WOW_HUNTER_SPELLS, WOW_HUNTER_SUGGESTED_SPELLS } from './wow-class-variants';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * for the WoW Hunter: its three World of Warcraft spells (full text), and that
 * every spell its guidance and suggestions name is a ranger spell of that level.
 */
describe('World of Warcraft hunter spells (wow-spells.json)', () => {
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

  it('adds Freezing Trap, Serpent Sting and Explosive Trap as ranger spells from World of Warcraft, with full text', () => {
    expect([...WOW_HUNTER_SPELLS]).toEqual(['Freezing Trap', 'Serpent Sting', 'Explosive Trap']);
    for (const name of WOW_HUNTER_SPELLS) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell.classes).withContext(name).toEqual(['ranger']);
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
      expect(spell.description).withContext(name).not.toContain('TBD');
      expect(spell.eli5).withContext(name).toBeTruthy();
    }
  });

  it('records Freezing Trap: level-1 evocation trap that Restrains on a failed CON save until damaged', () => {
    expect(find('Freezing Trap')).toEqual(jasmine.objectContaining({
      level: 1, school: 'evocation', actionType: 'action', concentration: true, ritual: false,
      range: '60 feet', components: ['s'], duration: 'up to 1 minute',
    }));
    const text = find('Freezing Trap').description;
    for (const part of ['Invisible, intangible', 'within 5 feet', 'the spell ends', 'Constitution saving throw',
      'Restrained condition for 1 minute', 'Taking any damage']) {
      expect(text).withContext(part).toContain(part);
    }
  });

  it('records Serpent Sting: level-3 necromancy Bonus Action after a weapon hit, 4d6 then 2d6 Poison', () => {
    expect(find('Serpent Sting')).toEqual(jasmine.objectContaining({
      level: 3, school: 'necromancy', actionType: 'bonusAction', concentration: false, ritual: false,
      castingTrigger: 'which you take immediately after hitting a creature with a weapon',
      range: 'Self', components: ['v'], duration: '1 minute',
    }));
    const text = find('Serpent Sting').description;
    for (const part of ['extra 4d6 Poison damage', 'Poisoned condition until the spell ends', 'end of each of its turns',
      'Constitution saving throw', 'takes 2d6 Poison damage', 'On a successful save, the spell ends']) {
      expect(text).withContext(part).toContain(part);
    }
  });

  it('records Explosive Trap: level-5 evocation trap, 20-foot Sphere, DEX save for 8d6 Fire and a 20-foot push', () => {
    expect(find('Explosive Trap')).toEqual(jasmine.objectContaining({
      level: 5, school: 'evocation', actionType: 'action', concentration: true, ritual: false,
      range: '60 feet', components: ['s'], duration: 'up to 1 minute',
    }));
    const text = find('Explosive Trap').description;
    for (const part of ['Invisible, intangible', 'within 5 feet', '20-foot-radius Sphere', 'the spell ends',
      'Dexterity saving throw', '8d6 Fire damage', 'Huge or smaller', 'pushed 20 feet']) {
      expect(text).withContext(part).toContain(part);
    }
  });

  it('hides them when the World of Warcraft source is off', () => {
    const ranger = wow.filter(s => s.classes.includes('ranger'));
    expect(ranger.map(s => s.name)).toEqual([...WOW_HUNTER_SPELLS]);
    expect(filterBySource(ranger, { 'Base Game': true, 'World of Warcraft': false })).toEqual([]);
  });

  it('has every guidance and suggested spell on the ranger list at its level', () => {
    for (const [spec, rows] of Object.entries(WOW_HUNTER_SUGGESTED_SPELLS)) {
      for (const row of rows) {
        for (const name of row.spells) {
          const spell = all.find(s => s.name === name);
          expect(spell?.level).withContext(`${spec}: ${name}`).toBe(row.level);
          expect(spell?.classes).withContext(`${spec}: ${name}`).toContain('ranger');
        }
      }
    }
    for (const g of Object.values(WOW_HUNTER_GUIDANCE)) {
      for (const name of g.level1Spells ?? []) {
        const spell = all.find(s => s.name === name);
        expect(spell?.level).withContext(name).toBe(1);
        expect(spell?.classes).withContext(name).toContain('ranger');
      }
    }
  });
});
