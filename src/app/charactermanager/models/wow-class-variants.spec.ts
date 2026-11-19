import {
  HERO_CLASSES, heroClassFor, heroClassForSubclass, heroClassSpells, recommendedFightingStylesFor,
  isExtraListSpell, recommendedStartingSpells, recommendedSubclassFor, subclassGuidanceName, subclassOptionLabel,
  subclassSource,
} from './hero-class';
import {
  WOW_CLASS_VARIANTS, WOW_DRUID, WOW_DRUID_SUGGESTED_SPELLS, WOW_PALADIN, WOW_PALADIN_GUIDANCE,
  WOW_PALADIN_SUGGESTED_SPELLS, WOW_PRIEST, WOW_PRIEST_EXTRA_SPELLS, WOW_PRIEST_GUIDANCE, WOW_PRIEST_SPECIALIZATIONS,
  WOW_PRIEST_SUGGESTED_SPELLS, WOW_ROGUE, WOW_ROGUE_GUIDANCE, WOW_SHAMAN, WOW_SHAMAN_GUIDANCE, WOW_WARLOCK,
  WOW_WARLOCK_GUIDANCE, WOW_WARLOCK_INVOCATIONS, WOW_WARLOCK_SUGGESTED_SPELLS, WOW_WARRIOR, WOW_WARRIOR_GUIDANCE,
  WOW_WARRIOR_MANEUVERS, WOW_WARRIOR_SPECIALIZATIONS, variantLabel, WOW_EVOKER, WOW_EVOKER_GUIDANCE,
  WOW_EVOKER_SPECIALIZATIONS, WOW_EVOKER_SPELL_TABLE, WOW_EVOKER_SUGGESTED_SPELLS, DRACONIC_SORCERY,
  WOW_HUNTER, WOW_HUNTER_GUIDANCE, WOW_HUNTER_SPECIALIZATIONS, WOW_HUNTER_SUGGESTED_SPELLS,
  EVOKER_SCHOOL, EVOKER_SCHOOL_LABEL, WOW_MAGE, WOW_MAGE_EXTRA_SPELLS, WOW_MAGE_GUIDANCE, WOW_MAGE_SPECIALIZATIONS,
  WOW_MAGE_SUGGESTED_SPELLS,
  WARRIOR_OF_MYSTIC_BREWS, WOW_MONK, WOW_MONK_GUIDANCE, WOW_MONK_ORDERS, WOW_MONK_SPECIALIZATIONS,
} from './wow-class-variants';
import { isWowFeat } from './wow-feats';
import { classDisplayName } from '../utils/class-display';

describe('wow-class-variants', () => {
  it('registers every variant as a hero class without a fixed subclass (the Evoker locks a base-game one)', () => {
    for (const variant of WOW_CLASS_VARIANTS) {
      expect(HERO_CLASSES).toContain(variant);
      if (variant === WOW_EVOKER) {
        expect(variant.subclass).toBe(DRACONIC_SORCERY);
        expect(variant.sharedSubclass).toBeTrue();
      } else {
        expect(variant.subclass).withContext(variant.key).toBeUndefined();
        expect(variant.sharedSubclass).withContext(variant.key).toBeUndefined();
      }
      expect(variant.source).toBe('World of Warcraft');
      // `[WoW class] ([Base class])`, or just the base name when the two match.
      expect(variant.label).toBe(variantLabel(variant.name, variant.baseClass));
      expect(variant.key).toBe(`${variant.baseClass} (World of Warcraft)`);
    }
  });

  describe('Druid', () => {
    const flat = (spec: string) => WOW_DRUID_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('calls its subclass a circle', () => {
      expect(WOW_DRUID.subclassTerm).toBe('circle');
    });

    it('covers spell levels 2–9 for every specialization', () => {
      for (const spec of ['Balance', 'Feral', 'Guardian', 'Restoration']) {
        expect(WOW_DRUID_SUGGESTED_SPELLS[spec].map(r => r.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      }
    });

    it('lists the per-specialization picks (incl. the WoW stubs)', () => {
      expect(flat('Balance')).toContain('Starfall');
      expect(flat('Balance')).toContain('Storm of Vengeance');
      expect(flat('Feral')).toContain('Feral Prowl');
      expect(flat('Feral')).toContain('Innervate');
      expect(flat('Guardian')).toContain('Roar of Ursoc');
      expect(flat('Guardian')[0]).toBe('Aid');
      expect(flat('Restoration')).toEqual(jasmine.arrayContaining(['Regrowth', 'Tranquility', 'Tree of Life', 'Foresight']));
      expect(flat('Restoration')).not.toContain('Starfall');
    });
  });

  describe('Paladin', () => {
    const flat = (spec: string) => WOW_PALADIN_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('calls its subclass an oath and has one guidance + suggestion set per specialization', () => {
      expect(WOW_PALADIN.subclassTerm).toBe('oath');
      const specs = WOW_PALADIN.specializations.map(s => s.name);
      expect(Object.keys(WOW_PALADIN_GUIDANCE)).toEqual(specs);
      expect(Object.keys(WOW_PALADIN_SUGGESTED_SPELLS)).toEqual(specs);
    });

    it('covers spell levels 1–5 for every specialization', () => {
      for (const spec of ['Holy', 'Protection', 'Retribution']) {
        expect(WOW_PALADIN_SUGGESTED_SPELLS[spec].map(r => r.level)).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it('lists the per-specialization suggestions, incl. the WoW paladin spells', () => {
      expect(flat('Holy')).toEqual([
        'Bless', 'Heroism', 'Searing Smite', 'Aid', 'Warding Bond', "Crusader's Mantle", 'Revivify',
        'Aura of Purity', 'Divine Shield', 'Circle of Power', 'Raise Dead',
      ]);
      expect(flat('Protection')).toEqual([
        'Heroism', 'Shield of Faith', 'Shining Smite', 'Warding Bond', "Crusader's Mantle", 'Guided Prayer',
        'Banishment', 'Divine Shield', 'Banishing Smite', 'Circle of Power',
      ]);
      expect(flat('Retribution')).toEqual([
        'Divine Favor', 'Thunderous Smite', 'Consecration', 'Shining Smite', "Crusader's Mantle",
        'Elemental Weapon', 'Staggering Smite', 'Destructive Wave',
      ]);
    });

    it('recommends level-1 spells, weapon masteries, fighting styles, oath and feats per specialization', () => {
      expect(WOW_PALADIN_GUIDANCE['Holy']).toEqual(jasmine.objectContaining({
        level1Spells: ['Cure Wounds', 'Shield of Faith'],
        weaponMastery: ['Flails', 'Longswords', 'Morningstars', 'Warhammers'],
        fightingStyles: ['Blessed Warrior'],
        fightingStyleCantrips: ['Sacred Flame', 'Spare the Dying'],
        subclass: { name: 'Oath of the Holy' },
        feats: ['Durable', 'Healer', 'Inspiring Leader', 'Shield Master', 'War Caster'],
      }));
      expect(WOW_PALADIN_GUIDANCE['Holy'].note).toContain('War Domain');
      expect(WOW_PALADIN_GUIDANCE['Protection']).toEqual(jasmine.objectContaining({
        level1Spells: ['Compelled Duel', 'Searing Smite'],
        weaponMastery: ['Battleaxes', 'Flails', 'Longswords', 'Morningstars', 'Warhammers'],
        fightingStyles: ['Interception', 'Protection'],
        subclass: { name: 'Oath of Devotion' },
        feats: ['Durable', 'Heavy Armor Master', 'Sentinel', 'Shield Master', 'Tough'],
      }));
      expect(WOW_PALADIN_GUIDANCE['Retribution']).toEqual(jasmine.objectContaining({
        level1Spells: ['Heroism', 'Wrathful Smite'],
        weaponMastery: ['Greataxes', 'Greatswords', 'Mauls'],
        fightingStyles: ['Great Weapon Fighting'],
        subclass: { name: 'Oath of Vengeance' },
        feats: ['Crusher', 'Great Weapon Master', 'Slasher'],
      }));
    });
  });

  describe('Rogue', () => {
    it('calls its subclass a subclass, has one guidance set per specialization and no spells', () => {
      expect(WOW_ROGUE.subclassTerm).toBe('subclass');
      const specs = WOW_ROGUE.specializations.map(s => s.name);
      expect(specs).toEqual(['Assassination', 'Outlaw', 'Subtlety']);
      expect(Object.keys(WOW_ROGUE_GUIDANCE)).toEqual(specs);
      expect(WOW_ROGUE.suggestedSpells).toBeUndefined();
      expect(WOW_ROGUE.subclassSpells).toBeUndefined();
      expect(WOW_ROGUE.spellTable).toEqual([]);
      expect(WOW_ROGUE.wowSubclasses).toEqual(['Swashbuckler']);
      expect(WOW_ROGUE.blurb).toContain('SI:7');
      for (const g of Object.values(WOW_ROGUE_GUIDANCE)) {
        expect(g.level1Spells).toBeUndefined();
        expect(g.cantrips).toBeUndefined();
        expect(g.fightingStyles).toBeUndefined();
      }
    });

    it('recommends weapon masteries, a subclass and feats per specialization', () => {
      expect(WOW_ROGUE_GUIDANCE['Assassination']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Daggers', 'Shortbows'],
        subclass: { name: 'Assassin' },
        feats: ['Actor', 'Alert', 'Defensive Duelist', 'Piercer', 'Poisoner', 'Skulker', 'Speedy'],
      }));
      expect(WOW_ROGUE_GUIDANCE['Outlaw']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Daggers', 'Rapiers'],
        subclass: { name: 'Swashbuckler' },
        feats: ['Athlete', 'Defensive Duelist', 'Martial Weapon Training', 'Piercer', 'Speedy', 'Tough'],
      }));
      expect(WOW_ROGUE_GUIDANCE['Subtlety']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Daggers', 'Maces'],
        subclass: { name: 'Soulknife' },
        feats: ['Dual Wielder', 'Mage Slayer', 'Shadow Touched', 'Skulker'],
      }));
    });

    it('gives Assassination a level-5 tip about the Poison Cunning Strike, and no one else', () => {
      const tip = WOW_ROGUE_GUIDANCE['Assassination'].levelTip!;
      expect(tip.level).toBe(5);
      expect(tip.text).toContain('Cunning Strike');
      expect(tip.text).toContain('Poison');
      expect(WOW_ROGUE_GUIDANCE['Outlaw'].levelTip).toBeUndefined();
      expect(WOW_ROGUE_GUIDANCE['Subtlety'].levelTip).toBeUndefined();
    });
  });

  describe('label rule', () => {
    it('reads `[WoW class] ([Base class])`, or the bare base name when they match', () => {
      expect(variantLabel('Shaman', 'Barbarian')).toBe('Shaman (Barbarian)');
      expect(variantLabel('Druid', 'Druid')).toBe('Druid');
      expect(variantLabel('rogue', 'Rogue')).toBe('Rogue');
      expect(WOW_DRUID.label).toBe('Druid');
      expect(WOW_PALADIN.label).toBe('Paladin');
      expect(WOW_ROGUE.label).toBe('Rogue');
      expect(WOW_SHAMAN.label).toBe('Shaman (Barbarian)');
      expect(WOW_WARLOCK.label).toBe('Warlock');
      expect(WOW_PRIEST.label).toBe('Priest (Cleric)');
      expect(WOW_MAGE.label).toBe('Mage (Wizard)');
      expect(WOW_MONK.label).toBe('Monk');
    });
  });

  describe('Priest (Cleric)', () => {
    const flat = (spec: string) => WOW_PRIEST_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('is a "Priest (Cleric)" variant with no fixed subclass that may respec', () => {
      expect(WOW_PRIEST.name).toBe('Priest');
      expect(WOW_PRIEST.baseClass).toBe('Cleric');
      expect(WOW_PRIEST.label).toBe('Priest (Cleric)');
      expect(WOW_PRIEST.key).toBe('Cleric (World of Warcraft)');
      expect(WOW_PRIEST.subclass).toBeUndefined();
      expect(WOW_PRIEST.subclassTerm).toBe('domain');
      expect(WOW_PRIEST.subclassNote).toBe('Chosen as normal at Cleric level 3');
      expect(WOW_PRIEST.subclassLevel).toBeUndefined();
      expect(WOW_PRIEST.respecOnLevelUp).toBeTrue();
      expect(WOW_PRIEST.spellTable).toEqual([]);
      expect(WOW_PRIEST.renownNote).toBeUndefined();
      const specs = WOW_PRIEST.specializations.map(s => s.name);
      expect(specs).toEqual([...WOW_PRIEST_SPECIALIZATIONS]);
      expect(specs).toEqual(['Discipline', 'Holy', 'Shadow']);
      expect(Object.keys(WOW_PRIEST_GUIDANCE)).toEqual(specs);
      expect(Object.keys(WOW_PRIEST_SUGGESTED_SPELLS)).toEqual(specs);
    });

    it('describes the Light and Shadow, and each specialization', () => {
      for (const word of ['Light', 'Holy Light', 'Elune', 'Shadow', 'heals and protects', 'drains the life']) {
        expect(WOW_PRIEST.blurb).withContext(word).toContain(word);
      }
      const desc = (name: string) => WOW_PRIEST.specializations.find(s => s.name === name)!.desc;
      expect(desc('Discipline')).toContain('balances Light and Shadow');
      expect(desc('Holy')).toContain('healer');
      expect(desc('Shadow')).toContain('Void');
    });

    it('recommends Thaumaturge, starting spells, a domain and feats per specialization', () => {
      expect(WOW_PRIEST_GUIDANCE['Discipline']).toEqual({
        featureChoice: { feature: 'Divine Order', option: 'Thaumaturge' },
        cantrips: ['Guidance', 'Resistance', 'Thaumaturgy', 'Word of Radiance'],
        level1Spells: ['Cure Wounds', 'Guiding Bolt', 'Sanctuary', 'Shield of Faith'],
        subclass: { name: 'Discipline Domain' },
        feats: ['Durable', 'Inspiring Leader', 'Mage Slayer', 'War Caster'],
      });
      expect(WOW_PRIEST_GUIDANCE['Holy']).toEqual({
        featureChoice: { feature: 'Divine Order', option: 'Thaumaturge' },
        cantrips: ['Guidance', 'Light', 'Sacred Flame', 'Spare the Dying'],
        level1Spells: ['Bless', 'Cure Wounds', 'Healing Word', 'Purify Food and Drink'],
        subclass: { name: 'Life Domain' },
        feats: ['Chef', 'Healer', 'Inspiring Leader', 'War Caster'],
      });
      expect(WOW_PRIEST_GUIDANCE['Shadow']).toEqual({
        featureChoice: { feature: 'Divine Order', option: 'Thaumaturge' },
        cantrips: ['Mending', 'Resistance', 'Thaumaturgy', 'Toll the Dead'],
        level1Spells: ['Bane', 'Command', 'Healing Word', 'Shadow Word: Pain'],
        subclass: { name: 'Shadow Domain' },
        feats: ['Actor', 'Mage Slayer', 'Shadow Touched', 'Skulker', 'Telepathic'],
      });
    });

    it('suggests spells for spell levels 1–9 per specialization', () => {
      for (const spec of ['Discipline', 'Holy', 'Shadow']) {
        expect(WOW_PRIEST_SUGGESTED_SPELLS[spec].map(r => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
      expect(WOW_PRIEST_SUGGESTED_SPELLS['Discipline'][1].spells).toEqual(['Aid', 'Blur', 'Levitate', 'Spiritual Weapon']);
      expect(flat('Discipline')).toEqual(jasmine.arrayContaining(['Shadow Word: Pain', 'Holy Nova', 'Power Word Fortify', 'Gate']));
      expect(WOW_PRIEST_SUGGESTED_SPELLS['Holy'][8].spells).toEqual(['Apotheosis', 'Mass Heal']);
      expect(flat('Holy')).toEqual(jasmine.arrayContaining(['Prayer of Mending', 'Holy Nova', 'Holy Aura', 'Blur']));
      expect(WOW_PRIEST_SUGGESTED_SPELLS['Shadow'][0].spells).toEqual(['Detect Poison and Disease']);
      expect(flat('Shadow')).toEqual(jasmine.arrayContaining(['Blindness/Deafness', 'Blur', 'Harm', 'Astral Projection']));
      expect(flat('Shadow')).not.toContain('Levitate');
      expect(flat('Shadow')).not.toContain('Shadow Word: Pain');
    });

    it('adds seven base spells to its Cleric spell list — only the Priest and the Mage have an added list', () => {
      expect(WOW_PRIEST.extraSpellList).toBe(WOW_PRIEST_EXTRA_SPELLS);
      expect([...WOW_PRIEST.extraSpellList!]).toEqual(
        ['Mind Sliver', 'Blur', 'Levitate', 'Haste', 'Summon Undead', 'Dominate Person', 'Dominate Monster']);
      for (const v of WOW_CLASS_VARIANTS.filter(v => v !== WOW_PRIEST && v !== WOW_MAGE)) {
        expect(v.extraSpellList).withContext(v.key).toBeUndefined();
      }
    });

    it('keeps the always-prepared tables to the two WoW-only domains', () => {
      expect(Object.keys(WOW_PRIEST.subclassSpells!)).toEqual(['Discipline Domain', 'Shadow Domain']);
      for (const rows of Object.values(WOW_PRIEST.subclassSpells!)) {
        expect(rows.map(r => r.classLevel)).toEqual([3, 5, 7, 9]);
        expect(rows.map(r => r.spells.length)).toEqual([4, 2, 2, 2]);
      }
      expect(WOW_PRIEST.wowSubclasses).toBeUndefined();
    });
  });

  describe('Shaman (Barbarian)', () => {
    it('is a Barbarian variant that calls its subclass a path, with no spells and two WoW-only paths', () => {
      expect(WOW_SHAMAN.name).toBe('Shaman');
      expect(WOW_SHAMAN.baseClass).toBe('Barbarian');
      expect(WOW_SHAMAN.subclassTerm).toBe('path');
      expect(WOW_SHAMAN.subclassNote).toBe('Chosen as normal at Barbarian level 3');
      const specs = WOW_SHAMAN.specializations.map(s => s.name);
      expect(specs).toEqual(['Elemental', 'Enhancement', 'Restoration']);
      expect(Object.keys(WOW_SHAMAN_GUIDANCE)).toEqual(specs);
      expect(WOW_SHAMAN.suggestedSpells).toBeUndefined();
      expect(WOW_SHAMAN.subclassSpells).toBeUndefined();
      expect(WOW_SHAMAN.spellTable).toEqual([]);
      expect(WOW_SHAMAN.wowSubclasses).toEqual(['Path of the Elements', 'Path of the Spiritual Guardian']);
      expect(WOW_SHAMAN.blurb).toContain('totems');
      expect(WOW_SHAMAN.blurb).toContain('air, earth, fire and water');
      expect(WOW_SHAMAN.featureCards).toBeDefined();
    });

    it('reminds the player about Earthen Ring renown', () => {
      expect(WOW_SHAMAN.renownNote).toContain('Earthen Ring');
      expect(WOW_SHAMAN.renownNote).toContain('by 3');
      expect(WOW_SHAMAN.renownNote).toContain('ask your DM');
    });

    it('recommends two weapon masteries, a path with Totems, and feats per specialization', () => {
      expect(WOW_SHAMAN_GUIDANCE['Elemental']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Battleaxes', 'Longswords', 'Maces'],
        weaponMasteryCount: 2,
        subclass: { name: 'Path of the Elements', note: 'plus Totems instead of Primal Knowledge.' },
        feats: ['Athlete', 'Crusher', 'Durable', 'Medium Armor Master', 'Ritual Caster', 'Slasher'],
      }));
      expect(WOW_SHAMAN_GUIDANCE['Enhancement']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Handaxes', 'Light Hammers', 'Scimitars', 'Shortswords'],
        weaponMasteryCount: 2,
        subclass: { name: 'Path of the Spiritual Guardian', note: 'plus Totems instead of Primal Knowledge.' },
        feats: ['Athlete', 'Charger', 'Crusher', 'Dual Wielder', 'Durable', 'Medium Armor Master', 'Slasher'],
      }));
      expect(WOW_SHAMAN_GUIDANCE['Restoration']).toEqual(jasmine.objectContaining({
        weaponMastery: ['Flails', 'Maces', 'Warhammers'],
        weaponMasteryCount: 2,
        subclass: { name: 'Path of the World Tree', note: 'plus Totems instead of Primal Knowledge.' },
        feats: ['Chef', 'Crusher', 'Durable', 'Inspiring Leader', 'Medium Armor Master', 'Sentinel', 'Shield Master'],
      }));
      for (const g of Object.values(WOW_SHAMAN_GUIDANCE)) {
        expect(g.level1Spells).toBeUndefined();
        expect(g.cantrips).toBeUndefined();
        expect(g.fightingStyles).toBeUndefined();
        expect(g.levelTip).toBeUndefined();
      }
    });
  });

  describe('Warlock', () => {
    const flat = (spec: string) => WOW_WARLOCK_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('is a Warlock variant that picks its patron at level 1, with no fixed subclass or WoW-only patron', () => {
      expect(WOW_WARLOCK.name).toBe('Warlock');
      expect(WOW_WARLOCK.baseClass).toBe('Warlock');
      expect(WOW_WARLOCK.key).toBe('Warlock (World of Warcraft)');
      expect(WOW_WARLOCK.subclass).toBeUndefined();
      expect(WOW_WARLOCK.subclassTerm).toBe('patron');
      expect(WOW_WARLOCK.subclassLevel).toBe(1);
      expect(WOW_WARLOCK.subclassNote).not.toContain('level 3');
      expect(WOW_WARLOCK.respecOnLevelUp).toBeTrue();
      expect(WOW_WARLOCK.subclassSpells).toBeUndefined();
      expect(WOW_WARLOCK.wowSubclasses).toBeUndefined();
      expect(WOW_WARLOCK.spellTable).toEqual([]);
      const specs = WOW_WARLOCK.specializations.map(s => s.name);
      expect(specs).toEqual(['Affliction', 'Demonology', 'Destruction']);
      expect(Object.keys(WOW_WARLOCK_GUIDANCE)).toEqual(specs);
      expect(Object.keys(WOW_WARLOCK_SUGGESTED_SPELLS)).toEqual(specs);
    });

    it('describes the Legion bargain, the demon minions and the two patrons', () => {
      for (const word of ['Burning Legion', 'Void', 'imps', 'voidwalkers', 'sayaad', 'felhunters', 'fel fire', 'curses']) {
        expect(WOW_WARLOCK.blurb).withContext(word).toContain(word);
      }
      expect(WOW_WARLOCK.blurb).toContain('Fiend Patron');
      expect(WOW_WARLOCK.blurb).toContain('Great Old One Patron');
      expect(WOW_WARLOCK.blurb).toContain('Old Gods');
      const desc = (name: string) => WOW_WARLOCK.specializations.find(s => s.name === name)!.desc;
      expect(desc('Affliction')).toContain('Void');
      expect(desc('Demonology')).toContain('demons');
      expect(desc('Destruction')).toContain('fel');
    });

    it('recommends cantrips, level-1 spells, invocations and a patron per specialization', () => {
      expect(WOW_WARLOCK_GUIDANCE['Affliction']).toEqual(jasmine.objectContaining({
        cantrips: ['Eldritch Blast', 'Poison Spray'],
        level1Spells: ['Hex', 'Witch Bolt'],
        invocations: {
          level1: ['Pact of the Legion'],
          level2: ['Agonizing Blast', 'Curse of Corruption'],
          fromLevel5: ['Call of the Void', 'Eldritch Mind', 'Gift of the Depths', 'Legion Summoning', 'Visions of Distant Realms'],
        },
      }));
      expect(WOW_WARLOCK_GUIDANCE['Affliction'].subclass.name).toBe('Great Old One Patron');
      expect(WOW_WARLOCK_GUIDANCE['Demonology']).toEqual(jasmine.objectContaining({
        cantrips: ['Eldritch Blast', 'Toll the Dead'],
        level1Spells: ['Arms of Hadar', 'Hex'],
        invocations: {
          level1: ['Pact of the Legion'],
          level2: ['Health Funnel', 'Repelling Blast'],
          fromLevel5: [
            'Call of the Void', 'Expendable Minions', 'Gift of the Depths', 'Legion Summoning',
            'Master Demonologist', 'Visions of Distant Realms',
          ],
        },
      }));
      expect(WOW_WARLOCK_GUIDANCE['Demonology'].subclass.name).toBe('Fiend Patron');
      expect(WOW_WARLOCK_GUIDANCE['Destruction']).toEqual(jasmine.objectContaining({
        cantrips: ['Eldritch Blast', 'Thunderclap'],
        level1Spells: ['Hellish Rebuke', 'Hex'],
        invocations: {
          level1: ['Pact of the Legion'],
          level2: ['Agonizing Blast', 'Repelling Blast'],
          fromLevel5: ['Call of the Void', 'Gift of the Depths', 'Legion Summoning', 'Visions of Distant Realms'],
        },
      }));
      expect(WOW_WARLOCK_GUIDANCE['Destruction'].subclass.name).toBe('Fiend Patron');
      for (const g of Object.values(WOW_WARLOCK_GUIDANCE)) {
        expect(g.weaponMastery).toBeUndefined();
        expect(g.fightingStyles).toBeUndefined();
      }
    });

    it('marks exactly the World of Warcraft invocations', () => {
      expect([...WOW_WARLOCK.wowInvocations!]).toEqual([
        'Pact of the Legion', 'Curse of Corruption', 'Health Funnel', 'Call of the Void',
        'Legion Summoning', 'Expendable Minions', 'Master Demonologist',
      ]);
      expect(WOW_WARLOCK.wowInvocations).toBe(WOW_WARLOCK_INVOCATIONS);
      for (const base of ['Agonizing Blast', 'Repelling Blast', 'Eldritch Mind', 'Gift of the Depths', 'Visions of Distant Realms']) {
        expect(WOW_WARLOCK.wowInvocations!.includes(base)).withContext(base).toBeFalse();
      }
    });

    it('suggests one spell per level 1–9 for every specialization, incl. the WoW spells', () => {
      for (const spec of ['Affliction', 'Demonology', 'Destruction']) {
        expect(WOW_WARLOCK_SUGGESTED_SPELLS[spec].map(r => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
      expect(flat('Affliction')).toEqual([
        'Bane', 'Ray of Enfeeblement', 'Fear', 'Blight', 'Synaptic Static', 'Eyebite', 'Finger of Death',
        'Befuddlement', 'Weird',
      ]);
      expect(flat('Demonology')).toEqual([
        'Hellish Rebuke', 'Suggestion', "Hand of Gul'dan", 'Summon Aberration', 'Planar Binding', 'Summon Fiend',
        'Plane Shift', 'Dominate Monster', 'Gate',
      ]);
      expect(flat('Destruction')).toEqual([
        'Arms of Hadar', 'Cloud of Daggers', 'Rain of Fire', 'Blight', "Jallarzi's Storm of Radiance",
        'Circle of Death', 'Finger of Death', 'Power Word Stun', 'Power Word Kill',
      ]);
    });

    it('carries the Summon Fiend flavour note for every specialization', () => {
      const note = WOW_WARLOCK.suggestedSpellsNote!;
      expect(note).toContain('Summon Fiend');
      expect(note).toContain('infernal');
      expect(note).toContain('demonic tyrant');
      expect(note).toContain('vilefiend');
    });
  });

  describe('Warrior (Fighter)', () => {
    it('is a "Warrior (Fighter)" variant with no fixed subclass, no spells and a level-1 fighting style', () => {
      expect(WOW_WARRIOR.name).toBe('Warrior');
      expect(WOW_WARRIOR.baseClass).toBe('Fighter');
      expect(WOW_WARRIOR.label).toBe('Warrior (Fighter)');
      expect(WOW_WARRIOR.key).toBe('Fighter (World of Warcraft)');
      expect(WOW_WARRIOR.subclass).toBeUndefined();
      expect(WOW_WARRIOR.subclassNote).toBe('Chosen as normal at Fighter level 3');
      expect(WOW_WARRIOR.subclassLevel).toBeUndefined();
      expect(WOW_WARRIOR.fightingStyleLevel).toBe(1);
      expect(WOW_WARRIOR.respecOnLevelUp).toBeTrue();
      expect(WOW_WARRIOR.spellTable).toEqual([]);
      expect(WOW_WARRIOR.suggestedSpells).toBeUndefined();
      expect(WOW_WARRIOR.subclassSpells).toBeUndefined();
      expect(WOW_WARRIOR.wowSubclasses).toBeUndefined();
      expect(WOW_WARRIOR.wowInvocations).toBeUndefined();
      const specs = WOW_WARRIOR.specializations.map(s => s.name);
      expect(specs).toEqual([...WOW_WARRIOR_SPECIALIZATIONS]);
      expect(specs).toEqual(['Arms', 'Fury', 'Protection']);
      expect(Object.keys(WOW_WARRIOR_GUIDANCE)).toEqual(specs);
    });

    it('describes strength, leadership, arms and armor, shields and rage', () => {
      for (const word of ['arms and armor', 'leads', 'strength', 'shield', 'rage', 'deadly weapons']) {
        expect(WOW_WARRIOR.blurb).withContext(word).toContain(word);
      }
      const desc = (name: string) => WOW_WARRIOR.specializations.find(s => s.name === name)!.desc;
      expect(desc('Arms')).toContain('two-handed');
      expect(desc('Fury')).toContain('dual-wielding berserker');
      expect(desc('Protection')).toContain('shield-bearing');
    });

    it('recommends a fighting style, weapon mastery, subclass, maneuvers and feats per specialization', () => {
      expect(WOW_WARRIOR_GUIDANCE['Arms']).toEqual({
        fightingStyles: ['Great Weapon Fighting'],
        weaponMastery: ['Greataxes', 'Greatswords', 'Mauls'],
        subclass: { name: 'Battle Master' },
        maneuvers: [
          'Battle Shout', 'Disarming Attack', 'Distracting Strike', 'Mortal Strike', 'Pushing Attack',
          'Sweeping Attack', 'Trip Attack',
        ],
        feats: ['Charger', 'Crusher', 'Great Weapon Master', 'Piercer', 'Speedy', 'Slasher'],
      });
      expect(WOW_WARRIOR_GUIDANCE['Fury']).toEqual(jasmine.objectContaining({
        fightingStyles: ['Two-Weapon Fighting'],
        weaponMastery: ['Scimitars'],
        subclass: { name: 'Champion' },
        feats: ['Charger', 'Crusher', 'Dual Wielder', 'Piercer', 'Slasher'],
      }));
      expect(WOW_WARRIOR_GUIDANCE['Fury'].maneuvers).toBeUndefined();
      expect(WOW_WARRIOR_GUIDANCE['Fury'].note).toContain('Barbarian on the Path of the Berserker');
      expect(WOW_WARRIOR_GUIDANCE['Fury'].note).toContain('Fury guidance');
      expect(WOW_WARRIOR_GUIDANCE['Protection']).toEqual({
        fightingStyles: ['Interception', 'Protection'],
        weaponMastery: ['Battleaxes', 'Longswords', 'Morningstars'],
        subclass: { name: 'Battle Master' },
        maneuvers: [
          'Bait and Switch', 'Battle Shout', 'Demoralizing Shout', 'Goading Attack', 'Maneuvering Attack', 'Parry',
          'Warding Maneuver',
        ],
        feats: ['Crusher', 'Durable', 'Heavy Armor Master', 'Piercer', 'Sentinel', 'Shield Master', 'Slasher'],
      });
      for (const g of Object.values(WOW_WARRIOR_GUIDANCE)) {
        expect(g.cantrips).toBeUndefined();
        expect(g.level1Spells).toBeUndefined();
        expect(g.invocations).toBeUndefined();
        expect(g.weaponMasteryCount).toBeUndefined();
      }
    });

    it('marks exactly the five World of Warcraft maneuvers', () => {
      expect([...WOW_WARRIOR.wowManeuvers!]).toEqual([
        'Battle Shout', 'Demoralizing Shout', 'Heroic Leap', 'Mortal Strike', 'Warding Maneuver',
      ]);
      expect(WOW_WARRIOR.wowManeuvers).toBe(WOW_WARRIOR_MANEUVERS);
      for (const base of ['Bait and Switch', 'Disarming Attack', 'Parry', 'Trip Attack', 'Goading Attack']) {
        expect(WOW_WARRIOR.wowManeuvers!.includes(base)).withContext(base).toBeFalse();
      }
    });
  });

  it('leaves the other variants without maneuvers and on the level-2 fighting style default', () => {
    for (const v of [WOW_DRUID, WOW_PALADIN, WOW_PRIEST, WOW_ROGUE, WOW_SHAMAN, WOW_WARLOCK]) {
      expect(v.wowManeuvers).withContext(v.key).toBeUndefined();
      expect(v.fightingStyleLevel).withContext(v.key).toBeUndefined();
      for (const g of Object.values(v.guidance ?? {})) {
        expect(g.maneuvers).withContext(v.key).toBeUndefined();
      }
    }
  });

  it('leaves the other variants on the level-3 subclass default, with no invocations', () => {
    for (const v of [WOW_DRUID, WOW_PALADIN, WOW_PRIEST, WOW_ROGUE, WOW_SHAMAN, WOW_WARRIOR]) {
      expect(v.subclassLevel).withContext(v.key).toBeUndefined();
      expect(v.wowInvocations).withContext(v.key).toBeUndefined();
      expect(v.suggestedSpellsNote).withContext(v.key).toBeUndefined();
      for (const g of Object.values(v.guidance ?? {})) {
        expect(g.invocations).withContext(v.key).toBeUndefined();
      }
    }
  });

  describe('Evoker (Sorcerer)', () => {
    const evoker = (overrides: { subclass?: string | null; specialization?: string | null; clazz?: string } = {}) =>
      ({ clazz: 'Sorcerer', subclass: DRACONIC_SORCERY, specialization: 'Devastation', ...overrides });

    it('reads "Evoker (Sorcerer)" on the Sorcerer base class, keyed apart from the base row', () => {
      expect(WOW_EVOKER.label).toBe('Evoker (Sorcerer)');
      expect(WOW_EVOKER.key).toBe('Sorcerer (World of Warcraft)');
      expect(WOW_EVOKER.baseClass).toBe('Sorcerer');
      expect(WOW_EVOKER.specializations.map(s => s.name)).toEqual([...WOW_EVOKER_SPECIALIZATIONS]);
      expect(WOW_EVOKER.respecOnLevelUp).toBeTrue();
      expect(WOW_EVOKER.subclassLevel).toBe(1);
      expect(WOW_EVOKER.spellTableTitle).toBe('Evoker Spells');
    });

    it('describes the dragonflights, the usual starting level and the dracthyr species', () => {
      expect(WOW_EVOKER.blurb).toContain('five dragonflights');
      for (const word of ['flame', 'arcane', 'might', 'life', 'time', 'empower', 'extend', 'transmute']) {
        expect(WOW_EVOKER.blurb).withContext(word).toContain(word);
      }
      expect(WOW_EVOKER.heroNote).toContain('level 3');
      expect(WOW_EVOKER.heroNote).toContain('permission');
      expect(WOW_EVOKER.heroNote).toContain('dracthyr');
      const desc = (name: string) => WOW_EVOKER.specializations.find(s => s.name === name)!.desc;
      expect(desc('Augmentation')).toContain('black dragonflight');
      expect(desc('Devastation')).toContain('fire');
      expect(desc('Preservation')).toContain('Emerald Dream');
    });

    it('is an Evoker only with Draconic Sorcery AND an Evoker specialization', () => {
      expect(heroClassFor(evoker())).toBe(WOW_EVOKER);
      expect(heroClassFor(evoker({ clazz: 'sorcerer', subclass: 'draconic sorcery' }))).toBe(WOW_EVOKER);
      expect(heroClassFor(evoker({ specialization: null }))).toBeUndefined();          // a plain Draconic sorcerer
      expect(heroClassFor(evoker({ subclass: 'Wild Magic Sorcery' }))).toBeUndefined();
      expect(heroClassFor(evoker({ subclass: null }))).toBeUndefined();
      expect(heroClassFor(evoker({ specialization: 'Havoc' }))).toBeUndefined();
      expect(heroClassFor(evoker({ clazz: 'Wizard' }))).toBeUndefined();
      // The shared subclass alone marks nothing, and keeps its base-game tag.
      expect(heroClassForSubclass(DRACONIC_SORCERY)).toBeUndefined();
      expect(subclassSource(DRACONIC_SORCERY)).toBeUndefined();
    });

    it('shows "Evoker (Sorcerer)" as the class name, and a base sorcerer unchanged', () => {
      expect(classDisplayName('Sorcerer', DRACONIC_SORCERY, 'Preservation')).toBe('Evoker (Sorcerer)');
      expect(classDisplayName('Sorcerer', DRACONIC_SORCERY, null)).toBe('Sorcerer');
      expect(classDisplayName('Sorcerer', 'Clockwork Sorcery', null)).toBe('Sorcerer');
    });

    it('grants the Evoker Spells at Sorcerer 3, 5, 7 and 9 (All + the specialization)', () => {
      expect(WOW_EVOKER_SPELL_TABLE.map(r => r.classLevel)).toEqual([3, 5, 7, 9]);
      expect(heroClassSpells(WOW_EVOKER, 2, 'Devastation')).toEqual([]);
      expect(heroClassSpells(WOW_EVOKER, 4, 'Augmentation').map(s => s.name))
        .toEqual(['Chromatic Orb', "Dragon's Breath", 'Ebon Might', 'Eruption']);
      expect(heroClassSpells(WOW_EVOKER, 7, 'Devastation').map(s => s.name)).toEqual([
        'Chromatic Orb', "Dragon's Breath", 'Azure Strike', 'Scorching Ray', 'Fly', 'Fireball', 'Arcane Eye', 'Emberstorm',
      ]);
      expect(heroClassSpells(WOW_EVOKER, 9, 'Preservation').map(s => `${s.classLevel} ${s.grantedBy}: ${s.name}`)).toEqual([
        '3 All: Chromatic Orb', "3 All: Dragon's Breath", '3 Preservation: Dream Breath', '3 Preservation: Living Flame',
        '5 All: Fly', '5 Preservation: Emerald Blossom', '7 All: Arcane Eye', '7 Preservation: Time Dilation',
        '9 All: Summon Dragon', '9 Preservation: Dream Flight',
      ]);
      // No specialization: only the shared column.
      expect(heroClassSpells(WOW_EVOKER, 5, null).map(s => s.name)).toEqual(['Chromatic Orb', "Dragon's Breath", 'Fly']);
    });

    it('recommends cantrips, spells to prepare, Metamagic, Elemental Affinity and feats per specialization', () => {
      expect(Object.keys(WOW_EVOKER_GUIDANCE)).toEqual([...WOW_EVOKER_SPECIALIZATIONS]);
      const aug = WOW_EVOKER_GUIDANCE['Augmentation'];
      expect(aug.cantrips).toEqual(['Elementalism', 'Light', 'Sorcerous Burst', 'Thunderclap']);
      expect(aug.extraPrepared)
        .toEqual(['Arcane Vigor', 'Enhance Ability', 'Flaming Sphere', 'Ice Knife', 'Living Flame', 'Shield']);
      expect(aug.metamagic).toEqual(['Empowered Spell', 'Extended Spell']);
      expect(aug.elementalAffinity).toBe('Fire');
      expect(aug.feats).toEqual(['Elemental Adept (Fire)', 'Speedy', 'Spell Sniper', 'War Caster']);
      const dev = WOW_EVOKER_GUIDANCE['Devastation'];
      expect(dev.cantrips).toEqual(['Elementalism', 'Light', 'Ray of Frost', 'Sorcerous Burst']);
      expect(dev.metamagic).toEqual(['Empowered Spell', 'Transmuted Spell']);
      expect(dev.elementalAffinity).toBe('Cold or Fire');
      expect(dev.feats).toEqual(['Elemental Adept (Cold and Fire)', 'Spell Sniper', 'War Caster']);
      const pres = WOW_EVOKER_GUIDANCE['Preservation'];
      expect(pres.cantrips).toEqual(['Blade Ward', 'Elementalism', 'Light', 'Sorcerous Burst']);
      expect(pres.extraPrepared).toEqual(['Alter Self', 'Arcane Vigor', 'False Life', 'Hold Person', 'Ray of Sickness', 'Witch Bolt']);
      expect(pres.metamagic).toEqual(['Heightened Spell', 'Twinned Spell']);
      expect(pres.elementalAffinity).toBe('Lightning or Poison');
      for (const g of Object.values(WOW_EVOKER_GUIDANCE)) {
        expect(g.subclass.name).toBe(DRACONIC_SORCERY);
        expect(g.level1Spells).toBeUndefined();
        expect(g.fightingStyles).toBeUndefined();
      }
    });

    it('badges the cantrips and the spells to prepare in the spells step', () => {
      expect(recommendedStartingSpells(WOW_EVOKER, 'Preservation')).toEqual([
        'Blade Ward', 'Elementalism', 'Light', 'Sorcerous Burst',
        'Alter Self', 'Arcane Vigor', 'False Life', 'Hold Person', 'Ray of Sickness', 'Witch Bolt',
      ]);
      expect(recommendedStartingSpells(WOW_EVOKER, 'Preservation')).toBe(recommendedStartingSpells(WOW_EVOKER, 'Preservation'));
    });

    it('suggests spells for levels 3 to 9 per specialization', () => {
      const flat = (spec: string) => WOW_EVOKER_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);
      for (const spec of WOW_EVOKER_SPECIALIZATIONS) {
        expect(WOW_EVOKER_SUGGESTED_SPELLS[spec].map(r => r.level)).withContext(spec).toEqual([3, 4, 5, 6, 7, 8, 9]);
      }
      expect(WOW_EVOKER_SUGGESTED_SPELLS['Augmentation'][0].spells).toEqual(['Fireball', 'Haste', 'Slow']);
      expect(flat('Devastation')).toContain("Otiluke's Freezing Sphere");
      expect(flat('Devastation')).toContain('Azure Sweep');
      expect(flat('Devastation')).toContain('Lay Waste');
      expect(flat('Preservation')).toContain('Rescue');
      expect(flat('Augmentation')[flat('Augmentation').length - 1]).toBe('Time Stop');
    });

    it('leaves the other variants unchanged by the new guidance fields', () => {
      for (const v of WOW_CLASS_VARIANTS.filter(x => x !== WOW_EVOKER)) {
        expect(v.spellTable).withContext(v.key).toEqual([]);
        expect(v.heroNote).withContext(v.key).toBeUndefined();
        for (const g of Object.values(v.guidance ?? {})) {
          expect(g.extraPrepared).withContext(v.key).toBeUndefined();
          expect(g.metamagic).withContext(v.key).toBeUndefined();
          expect(g.elementalAffinity).withContext(v.key).toBeUndefined();
        }
      }
    });
  });

  describe('Hunter (Ranger)', () => {
    const hunter = (overrides: { subclass?: string | null; specialization?: string | null; clazz?: string } = {}) =>
      ({ clazz: 'Ranger', subclass: null, specialization: 'Beast Mastery', ...overrides });

    it('reads "Hunter (Ranger)" on the Ranger base class with no fixed subclass', () => {
      expect(WOW_HUNTER.label).toBe('Hunter (Ranger)');
      expect(WOW_HUNTER.key).toBe('Ranger (World of Warcraft)');
      expect(WOW_HUNTER.baseClass).toBe('Ranger');
      expect(WOW_HUNTER.subclass).toBeUndefined();
      expect(WOW_HUNTER.subclassNote).toBe('Chosen as normal at Ranger level 3');
      expect(WOW_HUNTER.specializations.map(s => s.name)).toEqual([...WOW_HUNTER_SPECIALIZATIONS]);
      expect(WOW_HUNTER.respecOnLevelUp).toBeTrue();
      expect(WOW_HUNTER.hunterPets).toBeTrue();
      expect(WOW_HUNTER.spellTable).toEqual([]);
      expect(WOW_HUNTER.blurb).toContain('call of the wild');
      expect(WOW_HUNTER.blurb).toContain('traps');
      expect(WOW_HUNTER.blurb).toContain('pet');
      const desc = (name: string) => WOW_HUNTER.specializations.find(s => s.name === name)!.desc;
      expect(desc('Beast Mastery')).toContain('animal companion');
      expect(desc('Marksmanship')).toContain('sharpshooter');
      expect(desc('Survival')).toContain('polearm');
    });

    it('is a WoW hunter with any of its specializations, and the Demon Hunter stays its own hero class', () => {
      expect(heroClassFor(hunter())).toBe(WOW_HUNTER);
      expect(heroClassFor(hunter({ subclass: 'Beast Master' }))).toBe(WOW_HUNTER);
      expect(heroClassFor(hunter({ specialization: 'Marksmanship', subclass: 'Hunter' }))).toBe(WOW_HUNTER);
      expect(heroClassFor(hunter({ specialization: null, subclass: 'Beast Master' }))).toBeUndefined();
      expect(heroClassFor(hunter({ specialization: 'Havoc' }))).toBeUndefined();
      // The Demon Hunter hero subclass is matched first, whatever the specialization says.
      expect(heroClassFor(hunter({ subclass: 'Demon Hunter', specialization: 'Havoc' }))?.label).toBe('Demon Hunter (Ranger)');
      expect(heroClassFor(hunter({ subclass: 'Demon Hunter', specialization: 'Beast Mastery' }))?.label).toBe('Demon Hunter (Ranger)');
      expect(classDisplayName('Ranger', 'Beast Master', 'Survival')).toBe('Hunter (Ranger)');
      expect(classDisplayName('Ranger', 'Beast Master', null)).toBe('Ranger');
      expect(classDisplayName('Ranger', 'Demon Hunter', 'Vengeance')).toBe('Demon Hunter (Ranger)');
    });

    it('recommends Beast Master / Hunter / Beast Master and Archery / Archery / Great Weapon Fighting', () => {
      expect(recommendedSubclassFor(WOW_HUNTER, 'Beast Mastery')).toBe('Beast Master');
      expect(recommendedSubclassFor(WOW_HUNTER, 'Marksmanship')).toBe('Hunter');
      expect(recommendedSubclassFor(WOW_HUNTER, 'Survival')).toBe('Beast Master');
      expect(recommendedFightingStylesFor(WOW_HUNTER, 'Beast Mastery')).toEqual(['Archery']);
      expect(recommendedFightingStylesFor(WOW_HUNTER, 'Marksmanship')).toEqual(['Archery']);
      expect(recommendedFightingStylesFor(WOW_HUNTER, 'Survival')).toEqual(['Great Weapon Fighting']);
    });

    it('recommends level-1 spells, two Weapon Masteries and feats per specialization', () => {
      const bm = WOW_HUNTER_GUIDANCE['Beast Mastery'];
      expect(bm.level1Spells).toEqual(['Ensnaring Strike', 'Speak with Animals']);
      expect(bm.weaponMastery).toEqual(['Heavy Crossbows', 'Longbows', 'Muskets']);
      expect(bm.weaponMasteryCount).toBe(2);
      expect(bm.levelTip).toEqual({ level: 6, text: 'You gain Pet Specialization instead of Roving.' });
      expect(bm.feats).toEqual(['Crossbow Expert', 'Medium Armor Master', 'Piercer', 'Sharpshooter', 'Weapon Master']);
      const mm = WOW_HUNTER_GUIDANCE['Marksmanship'];
      expect(mm.level1Spells).toEqual(['Cure Wounds', 'Ensnaring Strike']);
      expect(mm.weaponMastery).toEqual(['Heavy Crossbows', 'Longbows', 'Muskets']);
      expect(mm.feats).toEqual(['Crossbow Expert', 'Medium Armor Master', 'Piercer', 'Sharpshooter']);
      expect(mm.levelTip).toBeUndefined();
      const sv = WOW_HUNTER_GUIDANCE['Survival'];
      expect(sv.level1Spells).toEqual(['Cure Wounds', 'Ensnaring Strike']);
      expect(sv.weaponMastery).toEqual(['Glaives', 'Halberds', 'Pikes']);
      expect(sv.feats).toEqual(['Great Weapon Master', 'Poisoner', 'Polearm Master', 'Sentinel']);
      for (const g of Object.values(WOW_HUNTER_GUIDANCE)) expect(g.cantrips).toBeUndefined();
      expect(recommendedStartingSpells(WOW_HUNTER, 'Survival')).toEqual(['Cure Wounds', 'Ensnaring Strike']);
    });

    it('suggests spells for levels 1 to 5, with the WoW traps and Serpent Sting', () => {
      for (const spec of WOW_HUNTER_SPECIALIZATIONS) {
        expect(WOW_HUNTER_SUGGESTED_SPELLS[spec].map(r => r.level)).withContext(spec).toEqual([1, 2, 3, 4, 5]);
        expect(WOW_HUNTER_SUGGESTED_SPELLS[spec][0].spells).withContext(spec).toEqual(['Freezing Trap']);
        expect(WOW_HUNTER_SUGGESTED_SPELLS[spec][2].spells).withContext(spec).toContain('Serpent Sting');
      }
      expect(WOW_HUNTER_SUGGESTED_SPELLS['Survival'][4].spells).toEqual(['Explosive Trap', 'Steel Wind Strike']);
      expect(WOW_HUNTER_SUGGESTED_SPELLS['Marksmanship'][4].spells).toEqual(['Conjure Volley', 'Swift Quiver']);
    });

    it('is the only variant that keeps hunter pets', () => {
      expect(HERO_CLASSES.filter(h => h.hunterPets)).toEqual([WOW_HUNTER]);
    });
  });

  describe('Mage (Wizard)', () => {
    const mage = (overrides: { subclass?: string | null; specialization?: string | null; clazz?: string } = {}) =>
      ({ clazz: 'Wizard', subclass: null, specialization: 'Frost', ...overrides });
    const flat = (spec: string) => WOW_MAGE_SUGGESTED_SPELLS[spec].flatMap(r => r.spells);

    it('reads "Mage (Wizard)" on the Wizard base class with no fixed subclass, and may respec', () => {
      expect(WOW_MAGE.label).toBe('Mage (Wizard)');
      expect(WOW_MAGE.key).toBe('Wizard (World of Warcraft)');
      expect(WOW_MAGE.name).toBe('Mage');
      expect(WOW_MAGE.baseClass).toBe('Wizard');
      expect(WOW_MAGE.subclass).toBeUndefined();
      expect(WOW_MAGE.subclassTerm).toBe('subclass');
      expect(WOW_MAGE.subclassNote).toBe('Chosen as normal at Wizard level 3');
      expect(WOW_MAGE.subclassLevel).toBeUndefined();
      expect(WOW_MAGE.respecOnLevelUp).toBeTrue();
      expect(WOW_MAGE.spellTable).toEqual([]);
      expect(WOW_MAGE.wowSubclasses).toBeUndefined();
      expect(WOW_MAGE.subclassSpells).toBeUndefined();
      expect(WOW_MAGE.featureCards).toBeUndefined();
      const specs = WOW_MAGE.specializations.map(s => s.name);
      expect(specs).toEqual([...WOW_MAGE_SPECIALIZATIONS]);
      expect(specs).toEqual(['Arcane', 'Fire', 'Frost']);
      expect(Object.keys(WOW_MAGE_GUIDANCE)).toEqual(specs);
      expect(Object.keys(WOW_MAGE_SUGGESTED_SPELLS)).toEqual(specs);
    });

    it('describes intellect, arcane shields, fire and frost, the Legion suspicion and the Kirin Tor', () => {
      for (const word of ['intellect', 'discipline', 'no armor', 'arcane shields', 'fire and frost', 'suspicion',
        'Highborne', 'Burning Legion', 'Kirin Tor of Dalaran']) {
        expect(WOW_MAGE.blurb).withContext(word).toContain(word);
      }
      const desc = (name: string) => WOW_MAGE.specializations.find(s => s.name === name)!.desc;
      expect(desc('Arcane')).toContain('arcane magic');
      expect(desc('Arcane')).toContain('overwhelm');
      expect(desc('Fire')).toContain('combustive flame');
      expect(desc('Frost')).toContain('Freezes');
      expect(desc('Frost')).toContain('shatters');
    });

    it('reminds the player about Kirin Tor renown', () => {
      expect(WOW_MAGE.renownNote).toContain('Kirin Tor');
      expect(WOW_MAGE.renownNote).toContain('by 3');
      expect(WOW_MAGE.renownNote).toContain('ask your DM');
    });

    it('is a WoW mage with any of its specializations, and shows "Mage (Wizard)" as the class name', () => {
      expect(heroClassFor(mage())).toBe(WOW_MAGE);
      expect(heroClassFor(mage({ subclass: 'Evoker' }))).toBe(WOW_MAGE);
      expect(heroClassFor(mage({ subclass: 'Diviner', specialization: 'Arcane' }))).toBe(WOW_MAGE);
      expect(heroClassFor(mage({ clazz: 'wizard', specialization: 'fire' }))).toBe(WOW_MAGE);
      expect(heroClassFor(mage({ specialization: null }))).toBeUndefined();
      expect(heroClassFor(mage({ specialization: null, subclass: 'Evoker' }))).toBeUndefined();
      expect(heroClassFor(mage({ specialization: 'Devastation' }))).toBeUndefined();
      expect(heroClassFor(mage({ clazz: 'Sorcerer' }))).toBeUndefined();
      expect(classDisplayName('Wizard', 'Evoker', 'Frost')).toBe('Mage (Wizard)');
      expect(classDisplayName('Wizard', null, 'Arcane')).toBe('Mage (Wizard)');
      expect(classDisplayName('Wizard', 'Evoker', null)).toBe('Wizard');
      expect(classDisplayName('Wizard', null, null)).toBe('Wizard');
    });

    it('recommends the Evoker for every specialization, shown as the school of evocation', () => {
      for (const spec of WOW_MAGE_SPECIALIZATIONS) {
        expect(recommendedSubclassFor(WOW_MAGE, spec)).withContext(spec).toBe('Evoker');
        expect(WOW_MAGE_GUIDANCE[spec].subclass.name).withContext(spec).toBe(EVOKER_SCHOOL);
        expect(subclassGuidanceName(WOW_MAGE_GUIDANCE[spec])).withContext(spec).toBe('Evoker (school of evocation)');
      }
      expect(EVOKER_SCHOOL_LABEL).toBe('Evoker (school of evocation)');
      expect(subclassOptionLabel(WOW_MAGE, 'Evoker')).toBe('Evoker (school of evocation)');
      expect(subclassOptionLabel(WOW_MAGE, 'evoker')).toBe('Evoker (school of evocation)');
      expect(subclassOptionLabel(WOW_MAGE, 'Abjurer')).toBe('Abjurer');
      // No other class relabels its subclasses, and a base wizard (no hero class) never does.
      expect(subclassOptionLabel(undefined, 'Evoker')).toBe('Evoker');
      expect(subclassOptionLabel(WOW_EVOKER, 'Evoker')).toBe('Evoker');
      for (const v of WOW_CLASS_VARIANTS.filter(x => x !== WOW_MAGE)) {
        for (const g of Object.values(v.guidance ?? {})) {
          expect(g.subclass.label).withContext(v.key).toBeUndefined();
          expect(subclassGuidanceName(g)).withContext(v.key).toBe(g.subclass.name);
        }
      }
      // The Wizard school is a base-game subclass: it marks no hero class and carries no WoW tag.
      expect(heroClassForSubclass('Evoker')).toBeUndefined();
      expect(subclassSource('Evoker')).toBeUndefined();
    });

    it('recommends cantrips, a spellbook and feats per specialization', () => {
      expect(WOW_MAGE.level1SpellsLabel).toBe('Spellbook');
      expect(WOW_MAGE_GUIDANCE['Arcane']).toEqual(jasmine.objectContaining({
        cantrips: ['Light', 'Mage Hand', 'Thunderclap'],
        level1Spells: ['Detect Magic', 'Feather Fall', 'Mage Armor', 'Magic Missile', 'Shield', 'Thunderwave'],
        feats: ['Clearcasting', 'Spell Sniper', 'War Caster'],
      }));
      expect(WOW_MAGE_GUIDANCE['Fire']).toEqual(jasmine.objectContaining({
        cantrips: ['Light', 'Mage Hand', 'Fire Bolt'],
        level1Spells: ['Burning Hands', 'Detect Magic', 'Feather Fall', 'Mage Armor', 'Shield', 'Thunderwave'],
        feats: ['Elemental Adept', 'Hot Streak', 'Spell Sniper', 'War Caster'],
      }));
      expect(WOW_MAGE_GUIDANCE['Frost']).toEqual(jasmine.objectContaining({
        cantrips: ['Light', 'Mage Hand', 'Ray of Frost'],
        level1Spells: ['Detect Magic', 'Feather Fall', 'Frost Nova', 'Ice Knife', 'Mage Armor', 'Shield'],
        feats: ['Fingers of Frost', 'Spell Sniper', 'War Caster'],
      }));
      for (const g of Object.values(WOW_MAGE_GUIDANCE)) {
        expect(g.extraPrepared).toBeUndefined();
        expect(g.weaponMastery).toBeUndefined();
        expect(g.fightingStyles).toBeUndefined();
      }
      for (const v of WOW_CLASS_VARIANTS.filter(x => x !== WOW_MAGE)) {
        expect(v.level1SpellsLabel).withContext(v.key).toBeUndefined();
      }
    });

    it('badges the recommended cantrips and level-1 spellbook spells in the spells step', () => {
      expect(recommendedStartingSpells(WOW_MAGE, 'Frost')).toEqual([
        'Light', 'Mage Hand', 'Ray of Frost',
        'Detect Magic', 'Feather Fall', 'Frost Nova', 'Ice Knife', 'Mage Armor', 'Shield',
      ]);
      expect(recommendedStartingSpells(WOW_MAGE, 'Arcane')).toContain('Thunderclap');
      expect(recommendedStartingSpells(WOW_MAGE, 'Fire')).toContain('Burning Hands');
      expect(recommendedStartingSpells(WOW_MAGE, 'Frost')).toBe(recommendedStartingSpells(WOW_MAGE, 'Frost'));
      expect(recommendedStartingSpells(WOW_MAGE, null)).toEqual([]);
    });

    it('suggests spells for levels 1 to 9 per specialization, with the WoW mage spells', () => {
      for (const spec of WOW_MAGE_SPECIALIZATIONS) {
        expect(WOW_MAGE_SUGGESTED_SPELLS[spec].map(r => r.level)).withContext(spec).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(flat(spec)).withContext(spec).toContain('Create Food and Water');
        expect(flat(spec)).withContext(spec).toContain("Heroes' Feast");
        // Mass Polymorph is a level-7 spell, so it sits in the level-7 row.
        expect(WOW_MAGE_SUGGESTED_SPELLS[spec][6].spells).withContext(spec).toContain('Mass Polymorph');
      }
      expect(WOW_MAGE_SUGGESTED_SPELLS['Arcane'][0].spells)
        .toEqual(['Chromatic Orb', 'Comprehend Languages', 'Disguise Self', 'Find Familiar', 'Frost Nova']);
      expect(flat('Arcane')).toEqual(jasmine.arrayContaining(["Bigby's Hand", "Mordenkainen's Sword", "Otiluke's Resilient Sphere"]));
      expect(WOW_MAGE_SUGGESTED_SPELLS['Fire'][4].spells).toEqual(['Flame Strike', 'Teleportation Circle']);
      expect(WOW_MAGE_SUGGESTED_SPELLS['Fire'][5].spells).toEqual(['Arcane Gate', 'Combustion', "Heroes' Feast"]);
      expect(flat('Fire')).toContain('Meteor Swarm');
      expect(WOW_MAGE_SUGGESTED_SPELLS['Frost'][0].spells).not.toContain('Frost Nova');   // it's in the spellbook
      expect(WOW_MAGE_SUGGESTED_SPELLS['Frost'][2].spells).toContain('Flurry');
      expect(flat('Frost')).toContain("Otiluke's Freezing Sphere");
      expect(flat('Frost')).not.toContain('Flame Strike');
    });

    it("adds Create Food and Water, Flame Strike and Heroes' Feast to the Wizard list for WoW mages only", () => {
      expect(WOW_MAGE.extraSpellList).toBe(WOW_MAGE_EXTRA_SPELLS);
      expect([...WOW_MAGE.extraSpellList!]).toEqual(['Create Food and Water', 'Flame Strike', "Heroes' Feast"]);
      expect(isExtraListSpell(WOW_MAGE, 'flame strike')).toBeTrue();
      expect(isExtraListSpell(WOW_MAGE, 'Blur')).toBeFalse();
      expect(isExtraListSpell(WOW_PRIEST, 'Flame Strike')).toBeFalse();
      expect(isExtraListSpell(undefined, 'Flame Strike')).toBeFalse();
    });
  });

  describe('Monk', () => {
    const monk = (overrides: { subclass?: string | null; specialization?: string | null; clazz?: string } = {}) =>
      ({ clazz: 'Monk', subclass: null, specialization: 'Brewmaster', ...overrides });

    it('reads "Monk" (same-name rule) on the Monk base class with no fixed subclass, and may respec', () => {
      expect(WOW_MONK.label).toBe('Monk');
      expect(WOW_MONK.key).toBe('Monk (World of Warcraft)');
      expect(WOW_MONK.name).toBe('Monk');
      expect(WOW_MONK.baseClass).toBe('Monk');
      expect(WOW_MONK.subclass).toBeUndefined();
      expect(WOW_MONK.subclassNote).toBe('Chosen as normal at Monk level 3');
      expect(WOW_MONK.subclassTerm).toBe('subclass');
      expect(WOW_MONK.subclassLevel).toBeUndefined();
      expect(WOW_MONK.respecOnLevelUp).toBeTrue();
      expect(WOW_MONK.spellTable).toEqual([]);
      expect(WOW_MONK.suggestedSpells).toBeUndefined();
      expect(WOW_MONK.extraSpellList).toBeUndefined();
      expect(WOW_MONK.renownNote).toBeUndefined();
      expect(WOW_MONK.wowSubclasses).toEqual(['Warrior of Mystic Brews']);
      expect(WOW_MONK.featureCards).toBeDefined();
      const specs = WOW_MONK.specializations.map(s => s.name);
      expect(specs).toEqual([...WOW_MONK_SPECIALIZATIONS]);
      expect(specs).toEqual(['Brewmaster', 'Mistweaver', 'Windwalker']);
      expect(Object.keys(WOW_MONK_GUIDANCE)).toEqual(specs);
    });

    it('describes the pandaren, the mogu weapon ban, balance, serenity, mending and brewing', () => {
      for (const word of ['pandaren', 'mogu', 'weapons', 'masters', 'balance', 'serenity', 'mend life', 'brew']) {
        expect(WOW_MONK.blurb).withContext(word).toContain(word);
      }
      const desc = (name: string) => WOW_MONK.specializations.find(s => s.name === name)!.desc;
      expect(desc('Brewmaster')).toContain('drunken');
      expect(desc('Brewmaster')).toContain('brews');
      expect(desc('Mistweaver')).toContain('mists');
      expect(desc('Mistweaver')).toContain('heal');
      expect(desc('Windwalker')).toContain('martial artist');
      expect(desc('Windwalker')).toContain('flurry of strikes');
    });

    it('lists the five monastic orders of Pandaria as panel lore', () => {
      expect(WOW_MONK.lore?.title).toBe('Monastic orders of Pandaria');
      expect(WOW_MONK.lore?.entries).toBe(WOW_MONK_ORDERS);
      expect(WOW_MONK_ORDERS.map(o => o.name)).toEqual([
        'Crane Wing Order', 'Niuzao Sentinels', 'Order of the Broken Temple', 'Order of the Cloud Serpent', 'Shado-Pan',
      ]);
      const desc = (name: string) => WOW_MONK_ORDERS.find(o => o.name === name)!.desc;
      expect(desc('Crane Wing Order')).toContain('Chi-Ji');
      expect(desc('Crane Wing Order')).toContain('adapt');
      expect(desc('Niuzao Sentinels')).toContain('Sha of Fear');
      expect(desc('Order of the Broken Temple')).toContain('Burning Legion');
      expect(desc('Order of the Cloud Serpent')).toContain('cloud serpents');
      expect(desc('Order of the Cloud Serpent')).toContain('windwalker');
      expect(desc('Shado-Pan')).toContain('shadows');
      for (const v of WOW_CLASS_VARIANTS.filter(x => x !== WOW_MONK)) {
        expect(v.lore).withContext(v.key).toBeUndefined();
      }
    });

    it('is a WoW monk with a specialization or the Warrior of Mystic Brews', () => {
      expect(heroClassFor(monk())).toBe(WOW_MONK);
      expect(heroClassFor(monk({ specialization: 'Windwalker', subclass: 'Warrior of the Open Hand' }))).toBe(WOW_MONK);
      expect(heroClassFor(monk({ specialization: null, subclass: WARRIOR_OF_MYSTIC_BREWS }))).toBe(WOW_MONK);
      expect(heroClassFor(monk({ specialization: null }))).toBeUndefined();
      expect(heroClassFor(monk({ specialization: 'Frost' }))).toBeUndefined();
      expect(heroClassFor(monk({ clazz: 'Fighter', subclass: WARRIOR_OF_MYSTIC_BREWS }))).toBeUndefined();
      expect(classDisplayName('Monk', WARRIOR_OF_MYSTIC_BREWS, 'Brewmaster')).toBe('Monk');
    });

    it('recommends Warrior of Mystic Brews / Mercy / the Open Hand, and tags only the Mystic Brews World of Warcraft', () => {
      expect(recommendedSubclassFor(WOW_MONK, 'Brewmaster')).toBe('Warrior of Mystic Brews');
      expect(recommendedSubclassFor(WOW_MONK, 'Mistweaver')).toBe('Warrior of Mercy');
      expect(recommendedSubclassFor(WOW_MONK, 'Windwalker')).toBe('Warrior of the Open Hand');
      expect(subclassSource(WARRIOR_OF_MYSTIC_BREWS)).toBe('World of Warcraft');
      expect(subclassSource('warrior of mystic brews')).toBe('World of Warcraft');
      expect(subclassSource('Warrior of Mercy')).toBeUndefined();
      expect(subclassSource('Warrior of the Open Hand')).toBeUndefined();
    });

    it('recommends feats per specialization, with the ✦ monk feats, and no spells', () => {
      expect(WOW_MONK_GUIDANCE['Brewmaster'].feats)
        .toEqual(['Chef', 'Crusher', 'Elusive Brawler', 'Grappler', 'Sentinel', 'Stagger and Sway']);
      expect(WOW_MONK_GUIDANCE['Mistweaver'].feats)
        .toEqual(['Enveloping Mist', 'Observant', 'Poisoner', 'Shadow Touched', 'Skulker']);
      expect(WOW_MONK_GUIDANCE['Windwalker'].feats).toEqual(['Charger', 'Crusher', 'Fists of Fury', 'Speedy']);
      expect(WOW_MONK_GUIDANCE['Brewmaster'].feats.filter(isWowFeat)).toEqual(['Elusive Brawler', 'Stagger and Sway']);
      expect(WOW_MONK_GUIDANCE['Mistweaver'].feats.filter(isWowFeat)).toEqual(['Enveloping Mist']);
      expect(WOW_MONK_GUIDANCE['Windwalker'].feats.filter(isWowFeat)).toEqual(['Fists of Fury']);
      for (const g of Object.values(WOW_MONK_GUIDANCE)) {
        expect(g.cantrips).toBeUndefined();
        expect(g.level1Spells).toBeUndefined();
        expect(g.subclass.label).toBeUndefined();
      }
      expect(recommendedStartingSpells(WOW_MONK, 'Brewmaster')).toEqual([]);
    });

    it('builds its sheet cards from the Mystic Brews subclass only', () => {
      const cards = (subclass: string | null, level = 6) =>
        WOW_MONK.featureCards!({ level, subclass, stats: { WIS: 16 } }).map(c => c.name);
      expect(cards(WARRIOR_OF_MYSTIC_BREWS)).toEqual(['Warrior of Mystic Brews', 'Mystic Brew']);
      expect(cards(WARRIOR_OF_MYSTIC_BREWS, 3)).toEqual(['Warrior of Mystic Brews']);
      expect(cards('Warrior of Mercy')).toEqual([]);
      expect(cards(null)).toEqual([]);
    });
  });
});
