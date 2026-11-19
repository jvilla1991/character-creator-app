import { DndSpell } from './dnd-api.types';
import { spellSource } from './content-source';
import { catalogSpeciesFor, speciesSpellGrants } from './species';
import { spellKey } from './spell-names';
import { WOW_SPECIES } from './wow-species';

/**
 * Checks the shipped spell data (the real assets, served by the Karma builder)
 * against the World of Warcraft species catalog: the two lineage-only spells
 * carry full text, and every cantrip and spell a species or lineage names is a
 * real spell of the kind the catalog says it is.
 */
describe('World of Warcraft species spells (spell JSON assets)', () => {
  let index: Map<string, DndSpell>;

  beforeAll(async () => {
    const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json'];
    const lists = await Promise.all(
      files.map(f => fetch(`/assets/data/spells/${f}`).then(r => r.json() as Promise<DndSpell[]>)));
    index = new Map(lists.flat().map(s => [s.name.toLowerCase(), s]));
  });

  const find = (name: string) => index.get(spellKey(name));

  it('records Arcane Pulse: a World of Warcraft cantrip that hits and slows creatures within 10 feet', () => {
    const spell = find('Arcane Pulse')!;
    expect(spell).toEqual(jasmine.objectContaining({
      level: 0, school: 'evocation', actionType: 'action', concentration: false, ritual: false,
      range: 'Self (10-foot Emanation)', components: ['v', 's'], duration: '1 round',
    }));
    expect(spellSource(spell)).toBe('World of Warcraft');
    expect(spell.description).toContain('Constitution saving throw');
    expect(spell.description).toContain('1d8 Force damage');
    expect(spell.description).toContain('reduced by 10 feet');
    expect(spell.eli5).toBeTruthy();
  });

  it('records Entropic Embrace: a level 1 reaction that lasts a minute without Concentration', () => {
    const spell = find('Entropic Embrace')!;
    expect(spell).toEqual(jasmine.objectContaining({
      level: 1, school: 'necromancy', actionType: 'reaction', concentration: false, ritual: false,
      range: 'Self', components: ['v'], duration: '1 minute',
    }));
    expect(spellSource(spell)).toBe('World of Warcraft');
    expect(spell.castingTrigger).toContain('same number');
    expect(spell.description).toContain('Lightly Obscured');
    expect(spell.description).toContain('1d4 Necrotic damage');
    expect(spell.higherLevelSlot).toContain('1d4 for each spell slot level above 1');
    expect(spell.eli5).toBeTruthy();
  });

  it('keeps the two lineage-only spells off every class list', () => {
    expect(find('Arcane Pulse')!.classes).toEqual([]);
    expect(find('Entropic Embrace')!.classes).toEqual([]);
  });

  it('finds every spell a species or lineage grants, as a cantrip or a levelled spell as the catalog says', () => {
    for (const species of WOW_SPECIES) {
      for (const lineage of [null, ...(species.lineages ?? []).map(l => l.name)]) {
        for (const grant of speciesSpellGrants(species, lineage)) {
          const context = `${species.name}${lineage ? ' / ' + lineage : ''}: ${grant.name}`;
          const spell = find(grant.name);
          expect(spell).withContext(context).toBeDefined();
          if (!spell) continue;
          expect(spell.level === 0).withContext(context).toBe(grant.cantrip);
        }
      }
    }
  });

  it('gives a level 3 lineage spell that a level 3 character can cast: spell level 1, and level 2 at most by 5', () => {
    for (const species of WOW_SPECIES) {
      for (const lineage of [null, ...(species.lineages ?? []).map(l => l.name)]) {
        for (const grant of speciesSpellGrants(species, lineage).filter(g => !g.cantrip)) {
          const spell = find(grant.name);
          if (!spell) continue;
          expect(spell.level).withContext(`${species.name}: ${grant.name}`).toBeLessThanOrEqual(grant.level === 3 ? 1 : 2);
        }
      }
    }
  });

  it('orders a species\' grants cantrips first, then by the level they arrive', () => {
    const elf = catalogSpeciesFor('Elf', 'World of Warcraft')!;
    expect(speciesSpellGrants(elf, 'Nightborne')).toEqual([
      { name: 'Arcane Pulse', level: 1, cantrip: true },
      { name: 'Faerie Fire', level: 3, cantrip: false },
      { name: 'Darkness', level: 5, cantrip: false },
    ]);
    expect(speciesSpellGrants(elf, null)).toEqual([]);
    expect(speciesSpellGrants(catalogSpeciesFor('Orc', 'World of Warcraft')!, null)).toEqual([]);
  });

  it('finds a saved character\'s catalog species from its name and source', () => {
    expect(catalogSpeciesFor('Tauren', 'World of Warcraft')?.key).toBe('Tauren (World of Warcraft)');
    expect(catalogSpeciesFor('Elf', null)).toBeUndefined();
    expect(catalogSpeciesFor('Elf', 'Base Game')).toBeUndefined();
    expect(catalogSpeciesFor(undefined, 'World of Warcraft')).toBeUndefined();
  });
});
