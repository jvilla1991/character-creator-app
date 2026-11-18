import { DndSpell } from './dnd-api.types';
import { filterBySource, spellSource } from './content-source';
import { isExtraListSpell } from './hero-class';
import { spellKey } from './spell-names';
import { WOW_PRIEST, WOW_PRIEST_GUIDANCE, WOW_PRIEST_SUGGESTED_SPELLS } from './wow-class-variants';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * for the WoW Priest (Cleric): its six new World of Warcraft spells, and that every
 * spell its guidance, suggestions and domain tables name exists.
 */
describe('World of Warcraft priest spells (wow-spells.json)', () => {
  const NEW_SPELLS: readonly [string, number, string][] = [
    ['Shadow Word: Pain', 1, 'necromancy'],
    ['Prayer of Mending', 3, 'abjuration'],
    ['Holy Nova', 4, 'evocation'],
    ['Psychic Horror', 4, 'enchantment'],
    ['Void Eruption', 5, 'evocation'],
    ['Apotheosis', 9, 'transmutation'],
  ];
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

  it('stubs the six priest spells as World of Warcraft cleric spells at their level and school', () => {
    for (const [name, level, school] of NEW_SPELLS) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell).withContext(name).toEqual(jasmine.objectContaining({ level, school, classes: ['cleric'] }));
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
      expect(spell.description).withContext(name).toBe('TBD — full text coming in the World of Warcraft spells update.');
      expect(spell.range).withContext(name).toBe('TBD');
      expect(spell.duration).withContext(name).toBe('TBD');
    }
  });

  it('adds each name once, with no base spell of the same name', () => {
    for (const [name] of NEW_SPELLS) {
      expect(all.filter(s => s.name.toLowerCase() === name.toLowerCase()).length).withContext(name).toBe(1);
    }
  });

  it('hides them when the World of Warcraft source is off', () => {
    const cleric = wow.filter(s => s.classes.includes('cleric'));
    expect(filterBySource(cleric, { 'Base Game': true, 'World of Warcraft': false })).toEqual([]);
    expect(filterBySource(cleric, { 'Base Game': true, 'World of Warcraft': true }).map(s => s.name))
      .toEqual(NEW_SPELLS.map(([name]) => name));
  });

  it('has every spell the priest guidance and suggestions name, at its level, on the cleric list or the added list', () => {
    const find = (name: string) => all.find(s => spellKey(s.name) === spellKey(name));
    const onList = (s: DndSpell | undefined) => !!s && (s.classes.includes('cleric') || isExtraListSpell(WOW_PRIEST, s.name));
    for (const g of Object.values(WOW_PRIEST_GUIDANCE)) {
      for (const name of g.cantrips ?? []) {
        expect(find(name)?.level).withContext(name).toBe(0);
        expect(onList(find(name))).withContext(name).toBeTrue();
      }
      for (const name of g.level1Spells ?? []) {
        expect(find(name)?.level).withContext(name).toBe(1);
        expect(onList(find(name))).withContext(name).toBeTrue();
      }
    }
    for (const rows of Object.values(WOW_PRIEST_SUGGESTED_SPELLS)) {
      for (const row of rows) {
        for (const name of row.spells) {
          expect(find(name)?.level).withContext(name).toBe(row.level);
          expect(onList(find(name))).withContext(name).toBeTrue();
        }
      }
    }
  });

  it('adds Blur and Levitate as base-game spells that are not cleric spells', () => {
    for (const name of WOW_PRIEST.extraSpellList!) {
      const spell = all.find(s => s.name === name);
      expect(spell).withContext(name).toBeDefined();
      expect(spellSource(spell!)).withContext(name).toBe('Base Game');
      expect(spell!.classes).withContext(name).not.toContain('cleric');
    }
  });

  it('keeps every domain spell at a spell level the cleric can cast at that Cleric level', () => {
    // Cleric 3 → level 2 slots, 5 → 3, 7 → 4, 9 → 5.
    const maxSlot: Record<number, number> = { 3: 2, 5: 3, 7: 4, 9: 5 };
    for (const rows of Object.values(WOW_PRIEST.subclassSpells!)) {
      for (const row of rows) {
        for (const name of row.spells) {
          const spell = all.find(s => spellKey(s.name) === spellKey(name));
          expect(spell).withContext(name).toBeDefined();
          expect(spell!.level).withContext(name).toBeLessThanOrEqual(maxSlot[row.classLevel]);
        }
      }
    }
  });
});
