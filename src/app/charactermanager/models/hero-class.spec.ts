import {
  DEMON_HUNTER_SUBCLASS, EBON_BLADE_SUBCLASS, HeroClassOption, buildClassOptions, heroClassByKey, heroClassFor,
  heroClassForSubclass, heroClassSpells, orList, recommendedFightingStylesFor, recommendedStartingSpells,
  recommendedSubclassFor, soulFragments, specializationHeading, specializationTitle, subclassSource, subclassSpellsFor,
  weaponMasteryLead,
} from './hero-class';

describe('hero-class', () => {
  const deathKnight = heroClassByKey('Death Knight (Paladin)') as HeroClassOption;

  describe('buildClassOptions', () => {
    it('lists base classes in the given order, then the WoW hero classes', () => {
      const options = buildClassOptions(['Barbarian', 'Paladin', 'Wizard']);
      expect(options.map(o => o.label))
        .toEqual(['Barbarian', 'Paladin', 'Wizard', 'Death Knight (Paladin)', 'Demon Hunter (Ranger)', 'Druid', 'Paladin', 'Rogue', 'Shaman (Barbarian)']);
      expect(options.map(o => o.source)).toEqual([
        'Base Game', 'Base Game', 'Base Game',
        'World of Warcraft', 'World of Warcraft', 'World of Warcraft', 'World of Warcraft', 'World of Warcraft', 'World of Warcraft',
      ]);
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

  it('finds a hero class by key or by subclass', () => {
    expect(heroClassByKey('Death Knight (Paladin)')?.baseClass).toBe('Paladin');
    expect(heroClassByKey('Paladin')).toBeUndefined();
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
    const demonHunter = heroClassByKey('Demon Hunter (Ranger)') as HeroClassOption;
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

  describe('World of Warcraft Druid', () => {
    const wowDruid = heroClassByKey('Druid (World of Warcraft)') as HeroClassOption;

    it('is a Druid variant with no fixed subclass, labelled just "Druid"', () => {
      const row = buildClassOptions(['Druid']).filter(o => o.label === 'Druid');
      expect(row.map(o => [o.key, o.source])).toEqual([
        ['Druid', 'Base Game'], ['Druid (World of Warcraft)', 'World of Warcraft'],
      ]);
      expect(wowDruid.baseClass).toBe('Druid');
      expect(wowDruid.subclass).toBeUndefined();
      expect(wowDruid.respecOnLevelUp).toBeTrue();
      expect(wowDruid.specializations.map(s => s.name)).toEqual(['Balance', 'Feral', 'Guardian', 'Restoration']);
      expect(wowDruid.renownNote).toContain('Cenarion Circle by 3');
      expect(heroClassByKey('Druid')).toBeUndefined();
    });

    it('identifies a WoW druid by clazz druid + specialization + no hero subclass', () => {
      expect(heroClassFor({ clazz: 'Druid', subclass: null, specialization: 'Balance' })).toBe(wowDruid);
      expect(heroClassFor({ clazz: 'druid', subclass: 'Circle of the Moon', specialization: 'Guardian' })).toBe(wowDruid);
      expect(heroClassFor({ clazz: 'Druid', subclass: null, specialization: null })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Druid', subclass: 'Circle of the Land' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Druid', subclass: EBON_BLADE_SUBCLASS, specialization: 'Balance' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Wizard', specialization: 'Balance' })).toBeUndefined();
      // Existing hero classes are unaffected by the specialization rule.
      expect(heroClassFor({ clazz: 'Paladin', subclass: EBON_BLADE_SUBCLASS, specialization: 'Frost' })).toBe(deathKnight);
      expect(heroClassFor({ clazz: 'Paladin', subclass: null, specialization: 'Frost' })).toBeUndefined();
    });

    it('shows the spec without a suffix and has no always-prepared table', () => {
      expect(specializationTitle(wowDruid, 'Balance')).toBe('Balance');
      expect(heroClassSpells(wowDruid, 20, 'Balance')).toEqual([]);
    });

    it('recommends a circle per specialization', () => {
      expect(recommendedSubclassFor(wowDruid, 'Balance')).toBe('Circle of the Stars');
      expect(recommendedSubclassFor(wowDruid, 'Feral')).toBe('Circle of the Moon');
      expect(recommendedSubclassFor(wowDruid, 'Guardian')).toBe('Circle of the Moon');
      expect(recommendedSubclassFor(wowDruid, 'Restoration')).toBe('Circle of the Land');
      expect(recommendedSubclassFor(wowDruid, null)).toBeUndefined();
      expect(recommendedSubclassFor(deathKnight, 'Frost')).toBeUndefined();
    });

    it('recommends starting cantrips and level-1 spells per specialization', () => {
      expect(recommendedStartingSpells(wowDruid, 'Feral'))
        .toEqual(['Druidcraft', 'Poison Spray', 'Cure Wounds', 'Entangle', 'Speak with Animals', 'Thunderwave']);
      expect(recommendedStartingSpells(wowDruid, 'Guardian'))
        .toEqual(['Druidcraft', 'Thorn Whip', 'Entangle', 'Healing Word', 'Speak with Animals', 'Thunderwave']);
      expect(recommendedStartingSpells(wowDruid, 'Restoration'))
        .toEqual(['Druidcraft', 'Produce Flame', 'Spare the Dying', 'Cure Wounds', 'Entangle', 'Goodberry', 'Healing Word']);
      expect(recommendedStartingSpells(wowDruid, 'Balance')).toBe(recommendedStartingSpells(wowDruid, 'Balance'));
      expect(recommendedStartingSpells(wowDruid, '')).toEqual([]);
      expect(recommendedStartingSpells(deathKnight, 'Frost')).toEqual([]);
    });
  });

  describe('World of Warcraft Paladin', () => {
    const wowPaladin = heroClassByKey('Paladin (World of Warcraft)') as HeroClassOption;

    it('is a Paladin variant with no fixed subclass, labelled just "Paladin", beside the base Paladin', () => {
      const rows = buildClassOptions(['Paladin']).filter(o => o.label === 'Paladin');
      expect(rows.map(o => [o.key, o.source])).toEqual([
        ['Paladin', 'Base Game'], ['Paladin (World of Warcraft)', 'World of Warcraft'],
      ]);
      expect(wowPaladin.baseClass).toBe('Paladin');
      expect(wowPaladin.subclass).toBeUndefined();
      expect(wowPaladin.subclassNote).toBe('Chosen as normal at Paladin level 3');
      expect(wowPaladin.subclassTerm).toBe('oath');
      expect(wowPaladin.respecOnLevelUp).toBeTrue();
      expect(wowPaladin.specializations.map(s => s.name)).toEqual(['Holy', 'Protection', 'Retribution']);
      expect(wowPaladin.specializations.every(s => s.desc.length > 20)).toBeTrue();
      // The Death Knight stays its own row on the same base class.
      expect(buildClassOptions(['Paladin']).filter(o => o.baseClass === 'Paladin').map(o => o.key))
        .toEqual(['Paladin', 'Death Knight (Paladin)', 'Paladin (World of Warcraft)']);
    });

    it('identifies a WoW paladin by clazz paladin + a paladin specialization + no hero subclass', () => {
      expect(heroClassFor({ clazz: 'Paladin', subclass: null, specialization: 'Holy' })).toBe(wowPaladin);
      expect(heroClassFor({ clazz: 'paladin', subclass: 'Oath of Devotion', specialization: 'Protection' })).toBe(wowPaladin);
      expect(heroClassFor({ clazz: 'Paladin', subclass: 'Oath of Vengeance', specialization: null })).toBeUndefined();
      // A Death Knight keeps its runes and stays a Death Knight.
      expect(heroClassFor({ clazz: 'Paladin', subclass: EBON_BLADE_SUBCLASS, specialization: 'Blood' })).toBe(deathKnight);
      expect(heroClassFor({ clazz: 'Paladin', subclass: EBON_BLADE_SUBCLASS, specialization: 'Holy' })).toBe(deathKnight);
      // A druid spec on a paladin (or vice versa) is not a variant.
      expect(heroClassFor({ clazz: 'Paladin', specialization: 'Balance' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Druid', specialization: 'Holy' })).toBeUndefined();
    });

    it('recommends an oath and fighting styles per specialization', () => {
      expect(recommendedSubclassFor(wowPaladin, 'Holy')).toBe('Oath of the Holy');
      expect(recommendedSubclassFor(wowPaladin, 'Protection')).toBe('Oath of Devotion');
      expect(recommendedSubclassFor(wowPaladin, 'Retribution')).toBe('Oath of Vengeance');
      expect(recommendedFightingStylesFor(wowPaladin, 'Holy')).toEqual(['Blessed Warrior']);
      expect(recommendedFightingStylesFor(wowPaladin, 'Protection')).toEqual(['Interception', 'Protection']);
      expect(recommendedFightingStylesFor(wowPaladin, 'Retribution')).toEqual(['Great Weapon Fighting']);
      expect(recommendedFightingStylesFor(wowPaladin, null)).toEqual([]);
      expect(recommendedFightingStylesFor(deathKnight, 'Blood')).toEqual([]);
    });

    it('has no level-1 cantrips, so the starting recommendations are its level-1 spells', () => {
      expect(wowPaladin.guidance!['Holy'].cantrips).toBeUndefined();
      expect(recommendedStartingSpells(wowPaladin, 'Holy')).toEqual(['Cure Wounds', 'Shield of Faith']);
      expect(recommendedStartingSpells(wowPaladin, 'Retribution')).toEqual(['Heroism', 'Wrathful Smite']);
    });

    it('shows the spec without a suffix', () => {
      expect(specializationTitle(wowPaladin, 'Retribution')).toBe('Retribution');
    });

    it('owns the WoW-only Oath of the Holy and its always-prepared spells', () => {
      const at = (level: number) => subclassSpellsFor(wowPaladin, 'Oath of the Holy', level).map(e => e.name);
      expect(at(2)).toEqual([]);
      expect(at(3)).toEqual(['Cure Wounds', 'Healing Word']);
      expect(at(17).length).toBe(10);
      expect(subclassSpellsFor(wowPaladin, 'oath of the holy', 3).map(e => e.classLevel)).toEqual([3, 3]);
      expect(subclassSpellsFor(wowPaladin, 'Oath of Devotion', 20)).toEqual([]);
      expect(subclassSpellsFor(deathKnight, 'Oath of the Holy', 20)).toEqual([]);
      // Any paladin with the oath is a WoW paladin, even before a specialization is recorded.
      expect(heroClassFor({ clazz: 'Paladin', subclass: 'Oath of the Holy', specialization: null })).toBe(wowPaladin);
      expect(heroClassFor({ clazz: 'Cleric', subclass: 'Oath of the Holy' })).toBeUndefined();
    });

    it('tags WoW subclasses with their source', () => {
      expect(subclassSource('Oath of the Holy')).toBe('World of Warcraft');
      expect(subclassSource(EBON_BLADE_SUBCLASS)).toBe('World of Warcraft');
      expect(subclassSource('Oath of Devotion')).toBeUndefined();
      expect(subclassSource(null)).toBeUndefined();
    });
  });

  describe('World of Warcraft Rogue', () => {
    const wowRogue = heroClassByKey('Rogue (World of Warcraft)') as HeroClassOption;

    it('is a Rogue variant with no fixed subclass, labelled just "Rogue", beside the base Rogue', () => {
      const rows = buildClassOptions(['Paladin', 'Rogue']).filter(o => o.label === 'Rogue');
      expect(rows.map(o => [o.key, o.source])).toEqual([
        ['Rogue', 'Base Game'], ['Rogue (World of Warcraft)', 'World of Warcraft'],
      ]);
      expect(wowRogue.baseClass).toBe('Rogue');
      expect(wowRogue.subclass).toBeUndefined();
      expect(wowRogue.subclassNote).toBe('Chosen as normal at Rogue level 3');
      expect(wowRogue.respecOnLevelUp).toBeTrue();
      expect(wowRogue.specializations.map(s => s.name)).toEqual(['Assassination', 'Outlaw', 'Subtlety']);
      expect(wowRogue.specializations.every(s => s.desc.length > 20)).toBeTrue();
      expect(specializationTitle(wowRogue, 'Outlaw')).toBe('Outlaw');
    });

    it('identifies a WoW rogue by clazz rogue + a rogue specialization, or the Swashbuckler', () => {
      expect(heroClassFor({ clazz: 'Rogue', subclass: null, specialization: 'Outlaw' })).toBe(wowRogue);
      expect(heroClassFor({ clazz: 'rogue', subclass: 'Thief', specialization: 'Subtlety' })).toBe(wowRogue);
      expect(heroClassFor({ clazz: 'Rogue', subclass: 'Swashbuckler', specialization: null })).toBe(wowRogue);
      expect(heroClassFor({ clazz: 'Rogue', subclass: 'Arcane Trickster', specialization: null })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Fighter', subclass: 'Swashbuckler' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Rogue', specialization: 'Holy' })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Paladin', specialization: 'Outlaw' })).toBeUndefined();
    });

    it('recommends a subclass per specialization, and no fighting styles or starting spells', () => {
      expect(recommendedSubclassFor(wowRogue, 'Assassination')).toBe('Assassin');
      expect(recommendedSubclassFor(wowRogue, 'Outlaw')).toBe('Swashbuckler');
      expect(recommendedSubclassFor(wowRogue, 'Subtlety')).toBe('Soulknife');
      for (const spec of ['Assassination', 'Outlaw', 'Subtlety']) {
        expect(recommendedFightingStylesFor(wowRogue, spec)).toEqual([]);
        expect(recommendedStartingSpells(wowRogue, spec)).toEqual([]);
      }
    });

    it('owns the WoW-only Swashbuckler (no always-prepared spells) and tags it World of Warcraft', () => {
      expect(subclassSource('Swashbuckler')).toBe('World of Warcraft');
      expect(subclassSource('swashbuckler')).toBe('World of Warcraft');
      expect(subclassSource('Soulknife')).toBeUndefined();
      expect(subclassSpellsFor(wowRogue, 'Swashbuckler', 20)).toEqual([]);
    });
  });

  describe('World of Warcraft Shaman (Barbarian)', () => {
    const shaman = heroClassByKey('Barbarian (World of Warcraft)') as HeroClassOption;

    it('is a "Shaman (Barbarian)" row beside the base Barbarian, with no fixed subclass', () => {
      const rows = buildClassOptions(['Barbarian', 'Rogue']).filter(o => o.baseClass === 'Barbarian');
      expect(rows.map(o => [o.key, o.label, o.source])).toEqual([
        ['Barbarian', 'Barbarian', 'Base Game'],
        ['Barbarian (World of Warcraft)', 'Shaman (Barbarian)', 'World of Warcraft'],
      ]);
      expect(shaman.subclass).toBeUndefined();
      expect(shaman.respecOnLevelUp).toBeTrue();
      expect(specializationTitle(shaman, 'Elemental')).toBe('Elemental');
      expect(specializationHeading(shaman)).toBe('Specialization');
    });

    it('identifies a WoW barbarian by clazz barbarian + a shaman specialization, or a WoW-only path', () => {
      expect(heroClassFor({ clazz: 'Barbarian', subclass: null, specialization: 'Elemental' })).toBe(shaman);
      expect(heroClassFor({ clazz: 'barbarian', subclass: 'Path of the Zealot', specialization: 'Enhancement' })).toBe(shaman);
      expect(heroClassFor({ clazz: 'Barbarian', subclass: 'Path of the Elements', specialization: null })).toBe(shaman);
      expect(heroClassFor({ clazz: 'Barbarian', subclass: 'Path of the Spiritual Guardian' })).toBe(shaman);
      expect(heroClassFor({ clazz: 'Barbarian', subclass: 'Path of the Berserker', specialization: null })).toBeUndefined();
      expect(heroClassFor({ clazz: 'Fighter', subclass: 'Path of the Elements' })).toBeUndefined();
      // Restoration is also a Druid spec: the base class decides which variant it is.
      expect(heroClassFor({ clazz: 'Barbarian', specialization: 'Restoration' })).toBe(shaman);
      expect(heroClassFor({ clazz: 'Druid', specialization: 'Restoration' })?.key).toBe('Druid (World of Warcraft)');
      expect(heroClassFor({ clazz: 'Barbarian', specialization: 'Balance' })).toBeUndefined();
    });

    it('recommends a path per specialization, and no fighting styles or starting spells', () => {
      expect(recommendedSubclassFor(shaman, 'Elemental')).toBe('Path of the Elements');
      expect(recommendedSubclassFor(shaman, 'Enhancement')).toBe('Path of the Spiritual Guardian');
      expect(recommendedSubclassFor(shaman, 'Restoration')).toBe('Path of the World Tree');
      for (const spec of ['Elemental', 'Enhancement', 'Restoration']) {
        expect(recommendedFightingStylesFor(shaman, spec)).toEqual([]);
        expect(recommendedStartingSpells(shaman, spec)).toEqual([]);
      }
    });

    it('tags both WoW-only paths World of Warcraft, and no PHB path', () => {
      expect(subclassSource('Path of the Elements')).toBe('World of Warcraft');
      expect(subclassSource('path of the spiritual guardian')).toBe('World of Warcraft');
      expect(subclassSource('Path of the World Tree')).toBeUndefined();
      expect(subclassSource('Path of the Berserker')).toBeUndefined();
      expect(subclassSpellsFor(shaman, 'Path of the Elements', 20)).toEqual([]);
    });

    it('reads the Weapon Mastery count in running text', () => {
      expect(weaponMasteryLead(shaman.guidance!['Elemental'])).toBe('Any two of');
      expect(weaponMasteryLead({ subclass: { name: 'Assassin' }, feats: [], weaponMastery: ['Daggers'] })).toBe('At least one of');
    });
  });

  it('joins choice lists in running text', () => {
    expect(orList(['Archery'])).toBe('Archery');
    expect(orList(['Interception', 'Protection'])).toBe('Interception or Protection');
    expect(orList(['A', 'B', 'C'])).toBe('A, B, or C');
  });
});
