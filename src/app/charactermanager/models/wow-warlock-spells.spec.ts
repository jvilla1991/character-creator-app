import { DndSpell } from './dnd-api.types';
import { filterBySource, spellSource } from './content-source';
import { WOW_WARLOCK_GUIDANCE, WOW_WARLOCK_SUGGESTED_SPELLS } from './wow-class-variants';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * for the WoW Warlock: its three new World of Warcraft spells, and that every
 * base spell its guidance and suggestions name exists.
 */
describe('World of Warcraft warlock spells (wow-spells.json)', () => {
  const NEW_SPELLS = ['Curse of Agony', "Hand of Gul'dan", 'Rain of Fire'];
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

  it('adds Curse of Agony, Hand of Gul\'dan and Rain of Fire as warlock spells from World of Warcraft', () => {
    for (const name of NEW_SPELLS) {
      const spell = find(name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell.classes).withContext(name).toEqual(['warlock']);
      expect(spell.subclasses).withContext(name).toBeUndefined();
      expect(spellSource(spell)).withContext(name).toBe('World of Warcraft');
    }
  });

  it('records Curse of Agony as a level-2 necromancy curse with a growing Psychic die', () => {
    expect(find('Curse of Agony')).toEqual(jasmine.objectContaining({
      level: 2, school: 'necromancy', actionType: 'action', concentration: false, ritual: false,
      range: '30 feet', components: ['v', 's'], duration: '1 minute',
    }));
    const text = find('Curse of Agony').description;
    expect(text).not.toContain('TBD');
    expect(text).toContain('Constitution saving throw');
    expect(text).toContain('1d4 Psychic');
    expect(text).toContain('d12');
    expect(text).toContain('the spell ends');
    expect(text).toContain('end of each of its turns');
  });

  it('stubs Hand of Gul\'dan (conjuration) and Rain of Fire (evocation) as level-3 concentration spells', () => {
    expect(find("Hand of Gul'dan")).toEqual(jasmine.objectContaining({ level: 3, school: 'conjuration', concentration: true }));
    expect(find('Rain of Fire')).toEqual(jasmine.objectContaining({ level: 3, school: 'evocation', concentration: true }));
    for (const name of ["Hand of Gul'dan", 'Rain of Fire']) {
      expect(find(name).description).withContext(name)
        .toBe('TBD — full text coming in the World of Warcraft spells update.');
      expect(find(name).range).withContext(name).toBe('TBD');
      expect(find(name).duration).withContext(name).toBe('TBD');
    }
  });

  it('hides them when the World of Warcraft source is off', () => {
    const warlock = wow.filter(s => s.classes.includes('warlock'));
    expect(filterBySource(warlock, { 'Base Game': true, 'World of Warcraft': false })).toEqual([]);
    expect(filterBySource(warlock, { 'Base Game': true, 'World of Warcraft': true }).map(s => s.name)).toEqual(NEW_SPELLS);
  });

  it('has every spell the warlock guidance and suggestions name, each on the warlock list', () => {
    const names = new Set([
      ...Object.values(WOW_WARLOCK_SUGGESTED_SPELLS).flatMap(rows => rows.flatMap(r => r.spells)),
      ...Object.values(WOW_WARLOCK_GUIDANCE).flatMap(g => [...(g.cantrips ?? []), ...(g.level1Spells ?? [])]),
    ]);
    for (const name of names) {
      const spell = all.find(s => s.name === name);
      expect(spell).withContext(name).toBeDefined();
      expect(spell?.classes).withContext(name).toContain('warlock');
    }
  });

  it('keeps the warlock guidance spells at their level (cantrips 0, level-1 spells 1)', () => {
    for (const g of Object.values(WOW_WARLOCK_GUIDANCE)) {
      for (const name of g.cantrips ?? []) expect(all.find(s => s.name === name)?.level).withContext(name).toBe(0);
      for (const name of g.level1Spells ?? []) expect(all.find(s => s.name === name)?.level).withContext(name).toBe(1);
    }
    for (const rows of Object.values(WOW_WARLOCK_SUGGESTED_SPELLS)) {
      for (const row of rows) {
        for (const name of row.spells) expect(all.find(s => s.name === name)?.level).withContext(name).toBe(row.level);
      }
    }
  });
});
