import { buildClassOptions, ebonBladeOathSpells, EBON_BLADE_SUBCLASS, heroClassByLabel, heroClassForSubclass } from './hero-class';

describe('hero-class', () => {
  describe('buildClassOptions', () => {
    it('lists base classes in the given order, then the WoW hero classes', () => {
      const options = buildClassOptions(['Barbarian', 'Paladin', 'Wizard']);
      expect(options.map(o => o.label))
        .toEqual(['Barbarian', 'Paladin', 'Wizard', 'Death Knight (Paladin)']);
      expect(options.map(o => o.source))
        .toEqual(['Base Game', 'Base Game', 'Base Game', 'World of Warcraft']);
    });

    it('maps Death Knight (Paladin) onto the Paladin base class with the Ebon Blade subclass', () => {
      const dk = buildClassOptions([]).find(o => o.label === 'Death Knight (Paladin)')!;
      expect(dk.baseClass).toBe('Paladin');
      expect(dk.hero?.subclass).toBe(EBON_BLADE_SUBCLASS);
      expect(dk.hero?.runeRequired).toBeTrue();
    });
  });

  it('finds a hero class by label or by subclass', () => {
    expect(heroClassByLabel('Death Knight (Paladin)')?.baseClass).toBe('Paladin');
    expect(heroClassByLabel('Paladin')).toBeUndefined();
    expect(heroClassForSubclass(EBON_BLADE_SUBCLASS)?.label).toBe('Death Knight (Paladin)');
    expect(heroClassForSubclass('Oath of Devotion')).toBeUndefined();
    expect(heroClassForSubclass(undefined)).toBeUndefined();
  });

  describe('ebonBladeOathSpells', () => {
    const names = (level: number, rune: 'Blood' | 'Frost' | 'Unholy' | null) =>
      ebonBladeOathSpells(level, rune).map(e => e.name);

    it('grants nothing at level 1', () => {
      expect(names(1, 'Blood')).toEqual([]);
    });

    it('grants only Rune Strike at level 2', () => {
      expect(ebonBladeOathSpells(2, 'Frost'))
        .toEqual([{ name: 'Rune Strike', paladinLevel: 2, grantedBy: 'Runic Smite' }]);
    });

    it('adds the shared and rune spells at level 3', () => {
      expect(names(3, 'Blood')).toEqual(['Rune Strike', 'Death Grip', 'Vampiric Blood']);
      expect(names(3, 'Frost')).toEqual(['Rune Strike', 'Death Grip', 'Chains of Ice']);
      expect(names(3, 'Unholy')).toEqual(['Rune Strike', 'Death Grip', 'Scourge Strike']);
    });

    it('accumulates rows up to the current level only', () => {
      expect(names(8, 'Frost'))
        .toEqual(['Rune Strike', 'Death Grip', 'Chains of Ice', 'Death and Decay', 'Frostscythe']);
    });

    it('includes every row at level 17+', () => {
      const unholy = names(20, 'Unholy');
      expect(unholy.length).toBe(11);
      expect(unholy.slice(-2)).toEqual(['Circle of Power', 'Contagion']);
    });

    it('shows only the shared column when no rune is set', () => {
      expect(names(5, null)).toEqual(['Rune Strike', 'Death Grip', 'Death and Decay']);
    });

    it('tags each entry with the column that granted it', () => {
      expect(ebonBladeOathSpells(3, 'Blood').map(e => e.grantedBy)).toEqual(['Runic Smite', 'All', 'Blood']);
    });
  });
});
