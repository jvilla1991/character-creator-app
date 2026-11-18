import { HERO_CLASSES } from './hero-class';
import { WOW_CLASS_VARIANTS, WOW_DRUID, WOW_DRUID_SUGGESTED_SPELLS } from './wow-class-variants';

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
});
