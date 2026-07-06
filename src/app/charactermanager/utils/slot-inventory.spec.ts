import {
  bulkFromWeight,
  convertPcToSlotInventory,
  isEncumbered,
  itemBulk,
  slotCapacity,
  usedSlots,
} from './slot-inventory';
import { PC, PcItem } from '../models/pc';

const basePC = (overrides: Partial<PC> = {}): PC => ({
  id: 1,
  name: 'Valiant',
  clazz: 'Cleric',
  level: 1,
  playerName: 'Sam',
  race: 'Human',
  stats: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 15, CHA: 8 },
  ...overrides,
});

describe('slot-inventory util', () => {
  describe('bulkFromWeight', () => {
    it('defaults unknown weight to Small (1)', () => {
      expect(bulkFromWeight(undefined)).toBe(1);
    });

    it('maps the DD weight bands inclusively', () => {
      expect(bulkFromWeight(0)).toBe(0.2);
      expect(bulkFromWeight(2)).toBe(1);
      expect(bulkFromWeight(2.1)).toBe(2);
      expect(bulkFromWeight(5)).toBe(2);
      expect(bulkFromWeight(10)).toBe(3);
      expect(bulkFromWeight(35)).toBe(6);
      expect(bulkFromWeight(70)).toBe(9);
      expect(bulkFromWeight(71)).toBe(9);
    });
  });

  describe('itemBulk', () => {
    it('prefers the stamped bulk over the weight band', () => {
      const item: PcItem = { name: 'Chain Mail', category: 'armor', qty: 1, weight: 55, bulk: 9 };
      expect(itemBulk(item)).toBe(9);
      expect(itemBulk({ ...item, bulk: undefined })).toBe(9); // 55 lb band
      expect(itemBulk({ name: 'Rope', category: 'gear', qty: 1 })).toBe(1);
    });
  });

  describe('usedSlots', () => {
    it('multiplies bulk by quantity and skips dropped lines', () => {
      const items: PcItem[] = [
        { name: 'Longsword', category: 'weapon', qty: 2, bulk: 3 },
        { name: 'Dart', category: 'weapon', qty: 5, bulk: 0.2 },
        { name: 'Anvil', category: 'gear', qty: 1, bulk: 9, status: 'dropped' },
      ];
      expect(usedSlots(items)).toBe(7); // 6 + 1, anvil dropped
    });

    it('rounds away 0.2 float drift and tolerates missing inventory', () => {
      const darts: PcItem[] = [{ name: 'Dart', category: 'weapon', qty: 3, bulk: 0.2 }];
      expect(usedSlots(darts)).toBe(0.6);
      expect(usedSlots(undefined)).toBe(0);
    });

    it('gives the free starting box/skin no bulk but 1 slot per extra serving', () => {
      // Starting supplies: rations & water at 5 each — weightless despite bulk: 1.
      const starting: PcItem[] = [
        { catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 5, bulk: 1 },
        { catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 5, bulk: 1 },
      ];
      expect(usedSlots(starting)).toBe(0);

      // Bought extras: 8 rations (3 over) + 6 water (1 over) = 4 slots.
      const stocked: PcItem[] = [
        { catalogKey: 'rations', name: 'Ration box', category: 'gear', qty: 8, bulk: 1 },
        { catalogKey: 'waterskin', name: 'Water skin', category: 'gear', qty: 6, bulk: 1 },
      ];
      expect(usedSlots(stocked)).toBe(4);
    });
  });

  describe('slotCapacity', () => {
    it('gives Medium species 18 + STR mod', () => {
      expect(slotCapacity(basePC())).toBe(20); // STR 14 → +2
    });

    it('gives Small species 14 + STR mod', () => {
      const pc = basePC({ race: 'Halfling', stats: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 12, CHA: 10 } });
      expect(slotCapacity(pc)).toBe(13); // 14 - 1
      expect(slotCapacity(basePC({ race: 'Forest Gnome' }))).toBe(16); // 14 + 2
    });

    it('gives goliaths Powerful Build capacity (22 + 2×STR)', () => {
      const pc = basePC({ race: 'Goliath', stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 12, CHA: 10 } });
      expect(slotCapacity(pc)).toBe(28);
    });

    it('defaults unknown species and missing stats to Medium', () => {
      expect(slotCapacity(basePC({ race: undefined, stats: undefined }))).toBe(18);
    });
  });

  describe('isEncumbered', () => {
    it('flags only when used slots exceed capacity', () => {
      const at = basePC({ inventory: [{ name: 'Crate', category: 'gear', qty: 1, bulk: 20 }] });
      const over = basePC({ inventory: [{ name: 'Crate', category: 'gear', qty: 1, bulk: 20.2 }] });
      expect(isEncumbered(at)).toBe(false); // 20 / 20 — at capacity is fine
      expect(isEncumbered(over)).toBe(true);
    });
  });

  describe('convertPcToSlotInventory (demo mode)', () => {
    it('moves legacy weapons and gear into inventory with bulk stamps', () => {
      const pc = basePC({
        weapons: [{ name: 'Warhammer', dmg: '1d8+2', magic: true, notes: 'family heirloom' }],
        gear: [{ name: 'Rope', equipped: false }],
        inventory: [{ name: 'Potion', category: 'material-component', qty: 1, weight: 0.5, bulk: 1 }],
      });

      const converted = convertPcToSlotInventory(pc);

      expect(converted.weapons).toEqual([]);
      expect(converted.gear).toEqual([]);
      expect(converted.inventory!.length).toBe(3);
      const hammer = converted.inventory!.find(i => i.name === 'Warhammer')!;
      expect(hammer.category).toBe('weapon');
      expect(hammer.damage).toBe('1d8+2');
      expect(hammer.notes).toBe('magic · family heirloom');
      expect(hammer.bulk).toBe(1); // no weight → default
      expect(converted.inventory!.find(i => i.name === 'Rope')!.bulk).toBe(1);
    });

    it('is idempotent and never overwrites an existing bulk', () => {
      const pc = basePC({
        weapons: [],
        gear: [],
        inventory: [{ name: 'Keepsake', category: 'gear', qty: 1, bulk: 0.2 }],
      });

      const once = convertPcToSlotInventory(pc);
      const twice = convertPcToSlotInventory(once);

      expect(twice.inventory).toEqual(once.inventory);
      expect(twice.inventory![0].bulk).toBe(0.2);
    });

    it('does not mutate the input PC', () => {
      const pc = basePC({ weapons: [{ name: 'Club', dmg: '1d4' }], inventory: [] });
      convertPcToSlotInventory(pc);
      expect(pc.weapons!.length).toBe(1);
      expect(pc.inventory!.length).toBe(0);
    });
  });
});
