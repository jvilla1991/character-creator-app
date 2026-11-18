import { consolidateLegacyEquipment, legacyEquipmentLines } from './legacy-equipment';
import { PC } from '../models/pc';

const basePC = (overrides: Partial<PC> = {}): PC => ({
  id: 1,
  name: 'Valiant',
  clazz: 'Cleric',
  level: 1,
  playerName: 'Sam',
  ...overrides,
});

describe('legacy-equipment util', () => {
  describe('legacyEquipmentLines', () => {
    it('maps weapons then gear onto single-unit inventory lines', () => {
      const pc = basePC({
        weapons: [{ name: 'Mace', dmg: '1d6+2' }],
        gear: [{ name: 'Chain Mail', equipped: true }, { name: 'Rope', equipped: false }],
      });

      expect(legacyEquipmentLines(pc)).toEqual([
        { name: 'Mace', category: 'weapon', qty: 1, damage: '1d6+2' },
        { name: 'Chain Mail', category: 'gear', qty: 1, equipped: true },
        { name: 'Rope', category: 'gear', qty: 1 }, // unequipped → no flag at all
      ]);
    });

    it('carries the magic flag and notes into the notes text', () => {
      const pc = basePC({
        weapons: [
          { name: 'Warhammer', dmg: '1d8+2', magic: true, notes: ' family heirloom ' },
          { name: 'Dagger', dmg: '1d4', magic: true },
        ],
        gear: [{ name: 'Holy Symbol', notes: 'silver' }],
      });

      expect(legacyEquipmentLines(pc).map(l => l.notes)).toEqual(['magic · family heirloom', 'magic', 'silver']);
    });

    it('never stamps bulk, and leaves a damage-less weapon without a damage key', () => {
      const lines = legacyEquipmentLines(basePC({
        weapons: [{ name: 'Net', dmg: '' }],
        gear: [{ name: 'Rope' }],
      }));

      expect(lines.every(l => !('bulk' in l))).toBe(true);
      expect('damage' in lines[0]).toBe(false);
    });

    it('returns an empty list when the PC has no legacy arrays', () => {
      expect(legacyEquipmentLines(basePC())).toEqual([]);
      expect(legacyEquipmentLines(basePC({ weapons: [], gear: [] }))).toEqual([]);
    });

    it('does not include the structured inventory', () => {
      const pc = basePC({
        weapons: [{ name: 'Club', dmg: '1d4' }],
        inventory: [{ name: 'Potion', category: 'gear', qty: 1 }],
      });
      expect(legacyEquipmentLines(pc).map(l => l.name)).toEqual(['Club']);
    });
  });

  describe('consolidateLegacyEquipment', () => {
    it('appends the legacy lines after the existing inventory and empties the legacy arrays', () => {
      const pc = basePC({
        weapons: [{ name: 'Mace', dmg: '1d6' }],
        gear: [{ name: 'Shield', equipped: true }],
        inventory: [{ name: 'Potion', category: 'gear', qty: 2, weight: 0.5 }],
      });

      const folded = consolidateLegacyEquipment(pc);

      expect(folded.weapons).toEqual([]);
      expect(folded.gear).toEqual([]);
      expect(folded.inventory).toEqual([
        { name: 'Potion', category: 'gear', qty: 2, weight: 0.5 },
        { name: 'Mace', category: 'weapon', qty: 1, damage: '1d6' },
        { name: 'Shield', category: 'gear', qty: 1, equipped: true },
      ]);
    });

    it('stamps no bulk on any line (that is the slot conversion\'s step)', () => {
      const folded = consolidateLegacyEquipment(basePC({
        weapons: [{ name: 'Mace', dmg: '1d6' }],
        inventory: [{ name: 'Potion', category: 'gear', qty: 1 }],
      }));
      expect(folded.inventory!.every(l => !('bulk' in l))).toBe(true);
    });

    it('is idempotent — a second run adds nothing', () => {
      const once = consolidateLegacyEquipment(basePC({
        weapons: [{ name: 'Mace', dmg: '1d6' }],
        gear: [{ name: 'Rope' }],
        inventory: [{ name: 'Potion', category: 'gear', qty: 1 }],
      }));
      const twice = consolidateLegacyEquipment(once);

      expect(twice.inventory).toEqual(once.inventory);
      expect(twice.inventory!.length).toBe(3);
      expect(twice.weapons).toEqual([]);
      expect(twice.gear).toEqual([]);
    });

    it('does not mutate the input PC, and copies the existing lines', () => {
      const potion = { name: 'Potion', category: 'gear' as const, qty: 1 };
      const pc = basePC({ weapons: [{ name: 'Club', dmg: '1d4' }], inventory: [potion] });

      const folded = consolidateLegacyEquipment(pc);

      expect(pc.weapons!.length).toBe(1);
      expect(pc.inventory!.length).toBe(1);
      expect(folded.inventory![0]).toEqual(potion);
      expect(folded.inventory![0]).not.toBe(potion);
    });

    it('yields an empty inventory for a PC with nothing at all', () => {
      const folded = consolidateLegacyEquipment(basePC());
      expect(folded.inventory).toEqual([]);
      expect(folded.weapons).toEqual([]);
      expect(folded.gear).toEqual([]);
    });
  });
});
