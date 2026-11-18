import { HERO_CLASSES } from './hero-class';
import {
  WOW_CLASS_VARIANTS, WOW_DRUID, WOW_DRUID_SUGGESTED_SPELLS, WOW_PALADIN, WOW_PALADIN_GUIDANCE,
  WOW_PALADIN_SUGGESTED_SPELLS,
} from './wow-class-variants';

describe('wow-class-variants', () => {
  it('registers every variant as a hero class without a fixed subclass', () => {
    for (const variant of WOW_CLASS_VARIANTS) {
      expect(HERO_CLASSES).toContain(variant);
      expect(variant.subclass).toBeUndefined();
      expect(variant.source).toBe('World of Warcraft');
      // WoW name == base name → the row reads just the base name, told apart by the source tag.
      expect(variant.label).toBe(variant.baseClass);
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
});
