import {
  applyCastToPc,
  applyLongRestToSlots,
  castableLevels,
  castWarning,
  findComponentLine,
  needsCostlyComponent,
} from './spellcasting';
import { PC, PcItem, PcSpell } from '../models/pc';

const spell = (overrides: Partial<PcSpell> = {}): PcSpell => ({
  lvl: 1,
  name: 'Chromatic Orb',
  school: 'Evocation',
  time: '1 action',
  prepared: true,
  ...overrides,
});

const componentLine = (overrides: Partial<PcItem> = {}): PcItem => ({
  catalogKey: 'mc-revivify',
  name: 'Diamonds (Revivify)',
  category: 'material-component',
  qty: 2,
  consumedOnCast: true,
  spell: 'Revivify',
  ...overrides,
});

const basePC = (overrides: Partial<PC> = {}): PC => ({
  id: 1,
  name: 'Valiant',
  clazz: 'Cleric',
  level: 5,
  playerName: 'Sam',
  spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 3 }, 3: { max: 2, used: 0 } },
  spells: [
    spell({ lvl: 0, name: 'Sacred Flame' }),
    spell({ lvl: 1, name: 'Cure Wounds' }),
    spell({
      lvl: 3, name: 'Revivify',
      components: ['v', 'm'], material: 'diamonds worth 300+ GP, which the spell consumes',
    }),
  ],
  inventory: [componentLine()],
  ...overrides,
});

describe('spellcasting util', () => {
  describe('castableLevels', () => {
    it('lists the spell level and higher levels with a free slot', () => {
      expect(castableLevels(basePC(), spell({ lvl: 1, name: 'Cure Wounds' }))).toEqual([1, 3]);
    });

    it('skips exhausted levels and levels below the spell', () => {
      expect(castableLevels(basePC(), spell({ lvl: 2 }))).toEqual([3]);
    });

    it('is empty for cantrips and for slotless PCs', () => {
      expect(castableLevels(basePC(), spell({ lvl: 0 }))).toEqual([]);
      expect(castableLevels(basePC({ spellSlots: undefined }), spell({ lvl: 1 }))).toEqual([]);
    });
  });

  describe('costly components', () => {
    it('needs one only with m + a GP amount in the material text', () => {
      expect(needsCostlyComponent(spell({ components: ['v', 'm'], material: 'a pearl worth 100+ GP' }))).toBeTrue();
      expect(needsCostlyComponent(spell({ components: ['v', 'm'], material: 'a pinch of sand' }))).toBeFalse();
      expect(needsCostlyComponent(spell({ components: ['v', 's'], material: 'a pearl worth 100+ GP' }))).toBeFalse();
      expect(needsCostlyComponent(spell({}))).toBeFalse();
    });

    it('matches the inventory line by spell name, skipping dropped and empty lines', () => {
      const inv = [
        componentLine({ status: 'dropped' }),
        componentLine({ qty: 0 }),
        componentLine({ catalogKey: 'live' }),
      ];
      expect(findComponentLine(inv, 'Revivify')?.catalogKey).toBe('live');
      expect(findComponentLine(inv, 'Identify')).toBeUndefined();
    });

    it('warns only when a costly component is required and absent', () => {
      const pc = basePC();
      expect(castWarning(pc, pc.spells![2])).toBeNull();
      const broke = basePC({ inventory: [] });
      expect(castWarning(broke, broke.spells![2])).toContain('Missing material component');
      expect(castWarning(pc, pc.spells![1])).toBeNull(); // no component spell
    });
  });

  describe('applyCastToPc', () => {
    it('spends a slot at the cast level and leaves the input untouched', () => {
      const pc = basePC();
      const after = applyCastToPc(pc, 'Cure Wounds', 1);
      expect(after.spellSlots![1]).toEqual({ max: 4, used: 2 });
      expect(pc.spellSlots![1]).toEqual({ max: 4, used: 1 });
    });

    it('upcasts by spending the chosen higher slot', () => {
      const after = applyCastToPc(basePC(), 'Cure Wounds', 3);
      expect(after.spellSlots![3]).toEqual({ max: 2, used: 1 });
      expect(after.spellSlots![1]).toEqual({ max: 4, used: 1 });
    });

    it('cantrips spend nothing', () => {
      const after = applyCastToPc(basePC(), 'Sacred Flame', 0);
      expect(after.spellSlots).toEqual(basePC().spellSlots);
    });

    it('throws on an unknown spell or an unavailable slot', () => {
      expect(() => applyCastToPc(basePC(), 'Wish', 9)).toThrow();
      expect(() => applyCastToPc(basePC(), 'Cure Wounds', 2)).toThrow(); // level 2 exhausted
      expect(() => applyCastToPc(basePC(), 'Revivify', 1)).toThrow();    // below spell level
    });

    it('decrements a consumed-on-cast component line and removes it at zero', () => {
      const first = applyCastToPc(basePC(), 'Revivify', 3);
      expect(first.inventory![0].qty).toBe(1);
      const second = applyCastToPc({ ...first, spellSlots: basePC().spellSlots }, 'Revivify', 3);
      expect(second.inventory).toEqual([]);
    });

    it('leaves a reusable component untouched and casts fine without one', () => {
      const reusable = basePC({ inventory: [componentLine({ consumedOnCast: false })] });
      expect(applyCastToPc(reusable, 'Revivify', 3).inventory![0].qty).toBe(2);
      const missing = basePC({ inventory: [] });
      expect(applyCastToPc(missing, 'Revivify', 3).inventory).toEqual([]);
    });
  });

  describe('applyLongRestToSlots', () => {
    it('restores every level to zero used, keeping max', () => {
      expect(applyLongRestToSlots(basePC().spellSlots)).toEqual(
        { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } });
      expect(applyLongRestToSlots(undefined)).toBeUndefined();
    });
  });
});
