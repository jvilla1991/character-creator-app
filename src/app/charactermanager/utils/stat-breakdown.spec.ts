import { PC, PcItem } from '../models/pc';
import { StatAdjustment } from '../models/stat-adjustment';
import { withRecomputedAc } from './armor-math';
import {
  applyAdjustments, breakdownOf, cleanAdjustments, describeAdjustment,
  describeAdjustmentChange, isValidAdjustment,
} from './stat-breakdown';

const armor = (name: string, armorClass: string, equipped = true): PcItem =>
  ({ name, category: 'armor', qty: 1, armorClass, equipped });

/** DEX 14 (+2) in a chain shirt and shield: 13 + 2 + 2 = 17 from the gear alone. */
const pcWith = (overrides: Partial<PC> = {}): PC =>
  ({ id: 1, name: 'Bram', clazz: 'Fighter', level: 3, playerName: 'P',
     stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 10 },
     inventory: [armor('Chain Shirt', '13 + Dex modifier (max 2)'), armor('Shield', '+2')],
     ac: 17, ...overrides } as PC);

const taunka: StatAdjustment = { value: 1, label: 'Taunka' };

describe('stat-breakdown', () => {
  describe('breakdownOf', () => {
    it('splits AC into the automatic lines and nothing else when it all adds up', () => {
      const b = breakdownOf(pcWith(), 'ac');
      expect(b.auto.map(l => `${l.label} ${l.value}`)).toEqual(['Chain Shirt 13', 'Dexterity 2', 'Shield 2']);
      expect(b.adjustments).toEqual([]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(17);
    });

    it('lists the DM lines and counts them toward the saved total', () => {
      const b = breakdownOf(pcWith({ ac: 18, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.adjustments).toEqual([taunka]);
      expect(b.unlabelled).toBe(0);
      expect(b.total).toBe(18);
    });

    it('reports what the saved total has beyond every line as unlabelled', () => {
      const b = breakdownOf(pcWith({ ac: 20, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.unlabelled).toBe(2); // 20 saved, 17 gear + 1 line explained
      expect(b.total).toBe(20);     // the saved number is never second-guessed
    });

    it('reports a saved total below the lines as a negative unlabelled amount', () => {
      expect(breakdownOf(pcWith({ ac: 15 }), 'ac').unlabelled).toBe(-2);
    });

    it('uses the lines as the total when nothing was ever saved', () => {
      const b = breakdownOf(pcWith({ ac: undefined, statAdjustments: { ac: [taunka] } }), 'ac');
      expect(b.total).toBe(18);
      expect(b.unlabelled).toBe(0);
    });
  });

  describe('applyAdjustments', () => {
    it('adds a line and raises the saved total by it', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [taunka], true);
      expect(updated.statAdjustments).toEqual({ ac: [taunka] });
      expect(updated.ac).toBe(18);
    });

    it('removes a line and lowers the saved total by it', () => {
      const pc = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const updated = applyAdjustments(pc, 'ac', [], true);
      expect(updated.statAdjustments).toEqual({ ac: [] });
      expect(updated.ac).toBe(17);
    });

    it('carries the unlabelled rest when asked to keep it', () => {
      const updated = applyAdjustments(pcWith({ ac: 20 }), 'ac', [taunka], true);
      expect(updated.ac).toBe(21); // 17 gear + 1 line + the 3 nobody labelled
    });

    it('drops the unlabelled rest once the DM has dealt with it', () => {
      const removed = applyAdjustments(pcWith({ ac: 20 }), 'ac', [], false);
      expect(removed.ac).toBe(17);

      // "Label it": the rest comes back as a real line, so the total does not move.
      const labelled = applyAdjustments(pcWith({ ac: 20 }), 'ac', [{ value: 3, label: 'Unarmored Defense' }], false);
      expect(labelled.ac).toBe(20);
      expect(breakdownOf(labelled, 'ac').unlabelled).toBe(0);
    });

    it('is pure: the character passed in is untouched', () => {
      const pc = pcWith();
      applyAdjustments(pc, 'ac', [taunka], true);
      expect(pc.ac).toBe(17);
      expect(pc.statAdjustments).toBeUndefined();
    });

    it('trims labels and leaves out lines the server would refuse', () => {
      const updated = applyAdjustments(pcWith(), 'ac', [
        { value: 1, label: '  Taunka ' },
        { value: 0, label: 'Nothing' },
        { value: 2, label: '   ' },
        { value: 1.5, label: 'Half' },
      ], true);
      expect(updated.statAdjustments).toEqual({ ac: [taunka] });
      expect(updated.ac).toBe(18);
    });

    it('produces a line that survives the next armor swap', () => {
      const withLine = applyAdjustments(pcWith(), 'ac', [taunka], true); // 18
      const unequipped = {
        ...withLine,
        inventory: withLine.inventory!.map(i => ({ ...i, equipped: false })),
      };
      const swapped = withRecomputedAc(unequipped, withLine.inventory);
      expect(swapped.ac).toBe(13); // unarmored 10 + Dex 2 + Taunka 1
      expect(breakdownOf(swapped, 'ac').adjustments).toEqual([taunka]);
      expect(breakdownOf(swapped, 'ac').unlabelled).toBe(0);
    });
  });

  describe('line rules', () => {
    it('accepts a whole non-zero amount with a label', () => {
      expect(isValidAdjustment(taunka)).toBeTrue();
      expect(isValidAdjustment({ value: -2, label: 'Cursed' })).toBeTrue();
    });

    it('refuses zero, fractions, out-of-range amounts and missing or overlong labels', () => {
      expect(isValidAdjustment({ value: 0, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 1.5, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 100, label: 'x' })).toBeFalse();
      expect(isValidAdjustment({ value: 1, label: '  ' })).toBeFalse();
      expect(isValidAdjustment({ value: 1, label: 'x'.repeat(41) })).toBeFalse();
    });

    it('caps how many lines one number can carry', () => {
      const many = Array.from({ length: 20 }, (_, i) => ({ value: 1, label: `Line ${i}` }));
      expect(cleanAdjustments(many).length).toBe(12);
    });

    it('words a line with its sign', () => {
      expect(describeAdjustment(taunka)).toBe('+1 Taunka');
      expect(describeAdjustment({ value: -2, label: 'Cursed' })).toBe('-2 Cursed');
    });
  });

  describe('describeAdjustmentChange', () => {
    const log = (before: PC, after: PC): string =>
      describeAdjustmentChange('ac', breakdownOf(before, 'ac'), breakdownOf(after, 'ac'));

    it('names an added line and the new total', () => {
      const before = pcWith();
      expect(log(before, applyAdjustments(before, 'ac', [taunka], true)))
        .toBe('DM added +1 Taunka to AC (AC 17 → 18)');
    });

    it('names a removed line and the new total', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      expect(log(before, applyAdjustments(before, 'ac', [], true)))
        .toBe('DM removed +1 Taunka from AC (AC 18 → 17)');
    });

    it('reads a relabel as one line out and one in, with no total when it did not move', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const after = applyAdjustments(before, 'ac', [{ value: 1, label: 'Tough Hide' }], true);
      expect(log(before, after)).toBe('DM added +1 Tough Hide to AC; removed +1 Taunka from AC');
    });

    it('says when an unlabelled amount was cleared', () => {
      const before = pcWith({ ac: 20 });
      expect(log(before, applyAdjustments(before, 'ac', [], false)))
        .toBe('DM cleared an unlabelled +3 on AC (AC 20 → 17)');
    });

    it('says when an unlabelled amount was given a label', () => {
      const before = pcWith({ ac: 20 });
      const after = applyAdjustments(before, 'ac', [{ value: 3, label: 'Unarmored Defense' }], false);
      expect(log(before, after)).toBe('DM labelled +3 on AC as Unarmored Defense');
    });

    it('tells two identical lines apart from one', () => {
      const before = pcWith({ ac: 18, statAdjustments: { ac: [taunka] } });
      const after = applyAdjustments(before, 'ac', [taunka, taunka], true);
      expect(log(before, after)).toBe('DM added +1 Taunka to AC (AC 18 → 19)');
    });
  });
});
