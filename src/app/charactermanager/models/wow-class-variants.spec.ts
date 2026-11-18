import { HERO_CLASSES } from './hero-class';
import {
  WOW_CLASS_VARIANTS, WOW_DRUID, WOW_DRUID_SUGGESTED_SPELLS, WOW_PALADIN, WOW_PALADIN_GUIDANCE,
  WOW_PALADIN_SUGGESTED_SPELLS, WOW_ROGUE, WOW_ROGUE_GUIDANCE, WOW_SHAMAN, WOW_SHAMAN_GUIDANCE, WOW_WARLOCK,
  WOW_WARLOCK_GUIDANCE, WOW_WARLOCK_INVOCATIONS, WOW_WARLOCK_SUGGESTED_SPELLS, WOW_WARRIOR, WOW_WARRIOR_GUIDANCE,
  WOW_WARRIOR_MANEUVERS, WOW_WARRIOR_SPECIALIZATIONS, variantLabel,
} from './wow-class-variants';

describe('wow-class-variants', () => {
  it('registers every variant as a hero class without a fixed subclass', () => {
    for (const variant of WOW_CLASS_VARIANTS) {
      expect(HERO_CLASSES).toContain(variant);
      expect(variant.subclass).toBeUndefined();
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
    for (const v of [WOW_DRUID, WOW_PALADIN, WOW_ROGUE, WOW_SHAMAN, WOW_WARLOCK]) {
      expect(v.wowManeuvers).withContext(v.key).toBeUndefined();
      expect(v.fightingStyleLevel).withContext(v.key).toBeUndefined();
      for (const g of Object.values(v.guidance ?? {})) {
        expect(g.maneuvers).withContext(v.key).toBeUndefined();
      }
    }
  });

  it('leaves the other variants on the level-3 subclass default, with no invocations', () => {
    for (const v of [WOW_DRUID, WOW_PALADIN, WOW_ROGUE, WOW_SHAMAN, WOW_WARRIOR]) {
      expect(v.subclassLevel).withContext(v.key).toBeUndefined();
      expect(v.wowInvocations).withContext(v.key).toBeUndefined();
      expect(v.suggestedSpellsNote).withContext(v.key).toBeUndefined();
      for (const g of Object.values(v.guidance ?? {})) {
        expect(g.invocations).withContext(v.key).toBeUndefined();
      }
    }
  });
});
