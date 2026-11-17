import {
  EBON_BLADE_SUBCLASS, HeroClassOption, buildClassOptions, heroClassByLabel, heroClassFor, heroClassForSubclass,
  heroClassSpells, specializationHeading, specializationTitle,
} from './hero-class';

describe('hero-class', () => {
  const deathKnight = heroClassByLabel('Death Knight (Paladin)') as HeroClassOption;

  describe('buildClassOptions', () => {
    it('lists base classes in the given order, then the WoW hero classes', () => {
      const options = buildClassOptions(['Barbarian', 'Paladin', 'Wizard']);
      expect(options.slice(0, 4).map(o => o.label))
        .toEqual(['Barbarian', 'Paladin', 'Wizard', 'Death Knight (Paladin)']);
      expect(options.slice(0, 4).map(o => o.source))
        .toEqual(['Base Game', 'Base Game', 'Base Game', 'World of Warcraft']);
    });

    it('maps Death Knight (Paladin) onto the Paladin base class with the Ebon Blade subclass', () => {
      const dk = buildClassOptions([]).find(o => o.label === 'Death Knight (Paladin)')!;
      expect(dk.baseClass).toBe('Paladin');
      expect(dk.hero?.subclass).toBe(EBON_BLADE_SUBCLASS);
      expect(dk.hero?.specializations.map(s => s.name)).toEqual(['Blood', 'Frost', 'Unholy']);
      expect(dk.hero?.specializationLabel).toBe('rune');
      expect(dk.hero?.respecOnLevelUp).toBeTrue();
    });
  });

  it('finds a hero class by label or by subclass', () => {
    expect(heroClassByLabel('Death Knight (Paladin)')?.baseClass).toBe('Paladin');
    expect(heroClassByLabel('Paladin')).toBeUndefined();
    expect(heroClassForSubclass(EBON_BLADE_SUBCLASS)?.label).toBe('Death Knight (Paladin)');
    expect(heroClassForSubclass('Oath of Devotion')).toBeUndefined();
    expect(heroClassForSubclass(undefined)).toBeUndefined();
  });

  it('only treats a character as a hero class when the base class matches too', () => {
    expect(heroClassFor({ clazz: 'Paladin', subclass: EBON_BLADE_SUBCLASS })).toBe(deathKnight);
    expect(heroClassFor({ clazz: 'paladin', subclass: EBON_BLADE_SUBCLASS })).toBe(deathKnight);
    expect(heroClassFor({ clazz: 'Fighter', subclass: EBON_BLADE_SUBCLASS })).toBeUndefined();
    expect(heroClassFor(null)).toBeUndefined();
  });

  it('formats a specialization for display and headings', () => {
    expect(specializationTitle(deathKnight, 'Frost')).toBe('Frost Rune');
    expect(specializationHeading(deathKnight)).toBe('Rune');
  });

  describe('heroClassSpells (Death Knight)', () => {
    const names = (level: number, rune: string | null) =>
      heroClassSpells(deathKnight, level, rune).map(e => e.name);

    it('grants nothing at level 1', () => {
      expect(names(1, 'Blood')).toEqual([]);
    });

    it('grants only Rune Strike at level 2', () => {
      expect(heroClassSpells(deathKnight, 2, 'Frost'))
        .toEqual([{ name: 'Rune Strike', classLevel: 2, grantedBy: 'Runic Smite' }]);
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

    it('shows only the shared column when no rune (or an unknown one) is set', () => {
      expect(names(5, null)).toEqual(['Rune Strike', 'Death Grip', 'Death and Decay']);
      expect(names(5, 'Havoc')).toEqual(['Rune Strike', 'Death Grip', 'Death and Decay']);
    });

    it('tags each entry with the column that granted it', () => {
      expect(heroClassSpells(deathKnight, 3, 'Blood').map(e => e.grantedBy)).toEqual(['Runic Smite', 'All', 'Blood']);
    });
  });
});
