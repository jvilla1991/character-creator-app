import { DndSpell } from './dnd-api.types';
import { HERO_CLASSES, HeroClassOption } from './hero-class';
import { SPELL_NAME_ALIASES, spellKey } from './spell-names';

/** Every spell name a hero class's tables, guidance and sheet cards name. */
function namedSpells(hero: HeroClassOption): string[] {
  const names: string[] = [];
  for (const b of hero.bonusSpells ?? []) names.push(b.name);
  for (const row of hero.spellTable) names.push(row.all, ...Object.values(row.bySpecialization));
  for (const rows of Object.values(hero.subclassSpells ?? {})) names.push(...rows.flatMap(r => r.spells));
  for (const rows of Object.values(hero.suggestedSpells ?? {})) names.push(...rows.flatMap(r => r.spells));
  for (const g of Object.values(hero.guidance ?? {})) {
    names.push(...(g.cantrips ?? []), ...(g.level1Spells ?? []), ...(g.fightingStyleCantrips ?? []));
  }
  if (hero.featureCards) {
    const subclasses = [null, ...Object.keys(hero.subclassSpells ?? {}), ...(hero.wowSubclasses ?? [])];
    for (const subclass of subclasses) {
      for (const card of hero.featureCards({ level: 20, subclass, stats: {} })) {
        for (const row of card.rows) names.push(...(row.spells ?? []));
      }
    }
  }
  return names;
}

describe('spell-names', () => {
  it('lower-cases a name and resolves the module spellings to the SRD ones', () => {
    expect(spellKey('Cure Wounds')).toBe('cure wounds');
    expect(spellKey("Evard's Black Tentacles")).toBe('black tentacles');
    expect(spellKey("EVARD'S BLACK TENTACLES")).toBe('black tentacles');
    expect(spellKey('Black Tentacles')).toBe('black tentacles');
    for (const [alias, target] of Object.entries(SPELL_NAME_ALIASES)) {
      expect(alias).toBe(alias.toLowerCase());
      expect(target).toBe(target.toLowerCase());
    }
  });

  describe('against the shipped spell data', () => {
    let index: Map<string, DndSpell>;

    beforeAll(async () => {
      const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json'];
      const lists = await Promise.all(files.map(f => fetch(`/assets/data/spells/${f}`).then(r => r.json() as Promise<DndSpell[]>)));
      index = new Map(lists.flat().map(s => [s.name.toLowerCase(), s]));
    });

    it('points every alias at a real spell, and no alias shadows one', () => {
      for (const [alias, target] of Object.entries(SPELL_NAME_ALIASES)) {
        expect(index.has(target)).withContext(target).toBeTrue();
        expect(index.has(alias)).withContext(alias).toBeFalse();
      }
    });

    it("finds the Death Knight Blood rune's Evard's Black Tentacles (Paladin 13)", () => {
      const dk = HERO_CLASSES.find(h => h.name === 'Death Knight')!;
      const row = dk.spellTable.find(r => r.classLevel === 13)!;
      expect(row.bySpecialization['Blood']).toBe("Evard's Black Tentacles");
      expect(index.get(spellKey(row.bySpecialization['Blood']))?.name).toBe('Black Tentacles');
    });

    it('resolves every spell every World of Warcraft table names', () => {
      const missing = HERO_CLASSES.flatMap(hero =>
        namedSpells(hero).filter(name => !index.has(spellKey(name))).map(name => `${hero.key}: ${name}`));
      expect([...new Set(missing)]).toEqual([]);
    });
  });
});
