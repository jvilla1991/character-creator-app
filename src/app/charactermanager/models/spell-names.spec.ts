import { ARCANA_DOMAIN_SPELLS, ARCANA_FEATURE_SPELLS } from './arcana-subclasses';
import { DndSpell } from './dnd-api.types';
import { HERO_CLASSES, HeroClassOption, spellNames } from './hero-class';
import { SPELL_NAME_ALIASES, spellKey } from './spell-names';

/** Every spell name a hero class's tables, guidance and sheet cards name. */
function namedSpells(hero: HeroClassOption): string[] {
  const names: string[] = [];
  for (const b of hero.bonusSpells ?? []) names.push(b.name);
  for (const row of hero.spellTable) {
    names.push(...spellNames(row.all), ...Object.values(row.bySpecialization).flatMap(cell => spellNames(cell)));
  }
  for (const rows of Object.values(hero.subclassSpells ?? {})) names.push(...rows.flatMap(r => r.spells));
  for (const rows of Object.values(hero.suggestedSpells ?? {})) names.push(...rows.flatMap(r => r.spells));
  for (const g of Object.values(hero.guidance ?? {})) {
    names.push(...(g.cantrips ?? []), ...(g.level1Spells ?? []), ...(g.fightingStyleCantrips ?? []), ...(g.extraPrepared ?? []));
  }
  names.push(...(hero.extraSpellList ?? []));
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
    expect(spellKey("Otiluke's Freezing Sphere")).toBe('freezing sphere');
    expect(spellKey("Bigby's Hand")).toBe('arcane hand');
    expect(spellKey("Mordenkainen's Sword")).toBe('arcane sword');
    expect(spellKey("Otiluke's Resilient Sphere")).toBe('resilient sphere');
    for (const [alias, target] of Object.entries(SPELL_NAME_ALIASES)) {
      expect(alias).toBe(alias.toLowerCase());
      expect(target).toBe(target.toLowerCase());
    }
  });

  describe('against the shipped spell data', () => {
    let index: Map<string, DndSpell>;

    beforeAll(async () => {
      const files = ['srd-5.2-spells.json', 'phb-2024-supplement.json', 'wow-spells.json', 'arcana-unleashed-spells.json'];
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
      expect(index.get(spellKey(row.bySpecialization['Blood'] as string))?.name).toBe('Black Tentacles');
    });

    it("finds the Shadow Domain's Evard's Black Tentacles (Cleric 7) the same way", () => {
      const priest = HERO_CLASSES.find(h => h.name === 'Priest')!;
      const row = priest.subclassSpells!['Shadow Domain'].find(r => r.classLevel === 7)!;
      expect(row.spells).toContain("Evard's Black Tentacles");
      expect(index.get(spellKey("Evard's Black Tentacles"))?.name).toBe('Black Tentacles');
    });

    it("finds the WoW Mage's Bigby's Hand, Mordenkainen's Sword and Otiluke's Resilient Sphere under their SRD names", () => {
      const mage = HERO_CLASSES.find(h => h.name === 'Mage')!;
      const arcane = mage.suggestedSpells!['Arcane'].flatMap(r => r.spells);
      for (const [name, srd] of [
        ["Bigby's Hand", 'Arcane Hand'], ["Mordenkainen's Sword", 'Arcane Sword'], ["Otiluke's Resilient Sphere", 'Resilient Sphere'],
      ]) {
        expect(arcane).withContext(name).toContain(name);
        expect(index.get(spellKey(name))?.name).withContext(name).toBe(srd);
      }
    });

    it('resolves every spell every World of Warcraft table names', () => {
      const missing = HERO_CLASSES.flatMap(hero =>
        namedSpells(hero).filter(name => !index.has(spellKey(name))).map(name => `${hero.key}: ${name}`));
      expect([...new Set(missing)]).toEqual([]);
    });

    it('finds all ten Arcana Domain spells, three of them under their SRD names', () => {
      const names = ARCANA_DOMAIN_SPELLS.flatMap(row => row.spells);
      expect(names.length).toBe(10);
      for (const name of names) expect(index.has(spellKey(name))).withContext(name).toBeTrue();
      for (const [name, srd] of [
        ["Nystul's Magic Aura", "Arcanist's Magic Aura"], ["Leomund's Secret Chest", 'Secret Chest'],
        ["Bigby's Hand", 'Arcane Hand'],
      ]) {
        expect(names).withContext(name).toContain(name);
        expect(index.get(spellKey(name))?.name).withContext(name).toBe(srd);
      }
      // Each row's spells can be cast with the slots a Cleric has at that level.
      for (const row of ARCANA_DOMAIN_SPELLS) {
        for (const name of row.spells) {
          expect(index.get(spellKey(name))!.level).withContext(name).toBeLessThanOrEqual(Math.ceil(row.classLevel / 2));
        }
      }
    });

    it("finds the spells the Necromancer's and Transmuter's features always keep prepared", () => {
      expect(ARCANA_FEATURE_SPELLS.map(grant => grant.spell))
        .toEqual(['Find Familiar', 'Animate Dead', 'Alter Self', 'Polymorph']);
      for (const grant of ARCANA_FEATURE_SPELLS) {
        const spell = index.get(spellKey(grant.spell));
        expect(spell?.name).withContext(grant.feature).toBe(grant.spell);
        expect(spell?.classes).withContext(grant.spell).toContain('wizard');
      }
    });
  });
});
