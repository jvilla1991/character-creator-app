import { HERO_CLASSES } from './hero-class';
import {
  WOW_CLASS_VARIANTS, WOW_DRUID, WOW_DRUID_SUGGESTED_SPELLS, WOW_PALADIN, WOW_PALADIN_GUIDANCE,
  WOW_PALADIN_SUGGESTED_SPELLS, WOW_ROGUE, WOW_ROGUE_GUIDANCE, WOW_SHAMAN, WOW_SHAMAN_GUIDANCE, variantLabel,
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
});
