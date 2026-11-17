import {
  DEMON_HUNTER_SUBCLASS, EBON_BLADE_SUBCLASS, HeroClassOption, buildClassOptions, heroClassByLabel, heroClassFor,
  heroClassForSubclass, heroClassSpells, soulFragments, specializationHeading, specializationTitle,
} from './hero-class';

describe('hero-class', () => {
  const deathKnight = heroClassByLabel('Death Knight (Paladin)') as HeroClassOption;

  describe('buildClassOptions', () => {
    it('lists base classes in the given order, then the WoW hero classes', () => {
      const options = buildClassOptions(['Barbarian', 'Paladin', 'Wizard']);
      expect(options.map(o => o.label))
        .toEqual(['Barbarian', 'Paladin', 'Wizard', 'Death Knight (Paladin)', 'Demon Hunter (Ranger)']);
      expect(options.map(o => o.source))
        .toEqual(['Base Game', 'Base Game', 'Base Game', 'World of Warcraft', 'World of Warcraft']);
    });

    it('maps Death Knight (Paladin) onto the Paladin base class with the Ebon Blade subclass', () => {
      const dk = buildClassOptions([]).find(o => o.label === 'Death Knight (Paladin)')!;
      expect(dk.baseClass).toBe('Paladin');
      expect(dk.hero?.subclass).toBe(EBON_BLADE_SUBCLASS);
      expect(dk.hero?.specializations.map(s => s.name)).toEqual(['Blood', 'Frost', 'Unholy']);
      expect(dk.hero?.specializationLabel).toBe('rune');
      expect(dk.hero?.respecOnLevelUp).toBeTrue();
    });

    it('maps Demon Hunter (Ranger) onto the Ranger base class with the Demon Hunter subclass', () => {
      const dh = buildClassOptions([]).find(o => o.label === 'Demon Hunter (Ranger)')!;
      expect(dh.baseClass).toBe('Ranger');
      expect(dh.source).toBe('World of Warcraft');
      expect(dh.hero?.subclass).toBe('Demon Hunter');
      expect(dh.hero?.specializations.map(s => s.name)).toEqual(['Devourer', 'Havoc', 'Vengeance']);
      expect(dh.hero?.specializationLabel).toBe('specialization');
      expect(dh.hero?.respecOnLevelUp).toBeFalse();
      expect(dh.hero?.blurb).toContain('elves');
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
    const dh = heroClassForSubclass(DEMON_HUNTER_SUBCLASS)!;
    expect(specializationTitle(dh, 'Havoc')).toBe('Havoc');
    expect(specializationHeading(dh)).toBe('Specialization');
  });

  describe('Demon Hunter spells and Soul Fragments', () => {
    const demonHunter = heroClassByLabel('Demon Hunter (Ranger)') as HeroClassOption;
    const names = (level: number, spec: string) => heroClassSpells(demonHunter, level, spec).map(e => e.name);

    it('grants nothing before Ranger 3 (no bonus spells)', () => {
      expect(names(2, 'Havoc')).toEqual([]);
    });

    it('follows the table by level and specialization', () => {
      expect(names(3, 'Devourer')).toEqual(['Throw Glaive', 'Consume Soul']);
      expect(names(5, 'Havoc')).toEqual(['Throw Glaive', 'Fel Rush', 'Sigil of Flame', 'Eye Beam']);
      expect(names(17, 'Vengeance')).toEqual([
        'Throw Glaive', 'Infernal Strike', 'Sigil of Flame', 'Fiery Brand', 'Metamorphosis', 'Demon Spikes',
        'Chaos Nova', 'Banishment', 'Destructive Wave', 'Sigil of Chains',
      ]);
      expect(names(13, 'Devourer').slice(-2)).toEqual(['Chaos Nova', 'Collapsing Star']);
      expect(names(17, 'Havoc').slice(-1)).toEqual(['Conjure Volley']);
    });

    it('computes Soul Fragments from WIS (min 1), +1 at 13, +2 at 17', () => {
      const wis = (WIS: number) => ({ WIS });
      expect(soulFragments(2, wis(18))).toBe(0);
      expect(soulFragments(3, wis(18))).toBe(4);
      expect(soulFragments(13, wis(18))).toBe(5);
      expect(soulFragments(17, wis(18))).toBe(6);
      expect(soulFragments(3, wis(10))).toBe(1);
      expect(soulFragments(3, wis(8))).toBe(1);
      expect(soulFragments(17, wis(8))).toBe(3);
    });
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
