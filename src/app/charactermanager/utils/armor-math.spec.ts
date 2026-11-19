import { acAutoLines, computeAc, parseArmorClass, shieldBonus, withRecomputedAc } from './armor-math';
import { PC, PcItem } from '../models/pc';

const pcWith = (dex: number, inventory: PcItem[]): PC =>
  ({ id: 1, name: 'X', clazz: 'Fighter', level: 1, playerName: 'P',
     stats: { STR: 10, DEX: dex, CON: 10, INT: 10, WIS: 10, CHA: 10 },
     ac: 12, inventory } as PC);

const armor = (name: string, armorClass: string, equipped = true): PcItem =>
  ({ name, category: 'armor', qty: 1, armorClass, equipped });

describe('armor-math', () => {
  describe('parseArmorClass', () => {
    it('parses every catalog shape', () => {
      expect(parseArmorClass('11 + Dex modifier')).toEqual({ base: 11, dex: 'full' });
      expect(parseArmorClass('14 + Dex modifier (max 2)')).toEqual({ base: 14, dex: 'max2' });
      expect(parseArmorClass('17')).toEqual({ base: 17, dex: 'none' });
      expect(parseArmorClass('+2')).toBeNull();      // shields handled separately
      expect(parseArmorClass(undefined)).toBeNull();
      expect(parseArmorClass('mystery plate')).toBeNull();
    });

    it('reads shield bonuses', () => {
      expect(shieldBonus('+2')).toBe(2);
      expect(shieldBonus('14')).toBe(0);
      expect(shieldBonus(undefined)).toBe(0);
    });
  });

  describe('computeAc', () => {
    it('light armor adds full Dex; a shield stacks', () => {
      const pc = pcWith(16, [armor('Studded Leather', '12 + Dex modifier'), armor('Shield', '+2')]);
      expect(computeAc(pc)).toBe(12 + 3 + 2); // 17
    });

    it('medium armor caps Dex at 2; heavy ignores it', () => {
      expect(computeAc(pcWith(18, [armor('Half Plate', '15 + Dex modifier (max 2)')]))).toBe(17);
      expect(computeAc(pcWith(18, [armor('Plate', '18')]))).toBe(18);
    });

    it('uses the highest-base armor when several are equipped', () => {
      const pc = pcWith(12, [armor('Leather', '11 + Dex modifier'), armor('Chain Mail', '16')]);
      expect(computeAc(pc)).toBe(16);
    });

    it('falls back to unarmored 10 + Dex (shield still counts)', () => {
      expect(computeAc(pcWith(14, []))).toBe(12);
      expect(computeAc(pcWith(14, [armor('Shield', '+2')]))).toBe(14);
    });

    it('ignores dropped and unequipped armor', () => {
      const pc = pcWith(10, [
        { ...armor('Plate', '18'), status: 'dropped' as const },
        armor('Chain Mail', '16', false),
      ]);
      expect(computeAc(pc)).toBe(10);
    });
  });

  describe('acAutoLines', () => {
    it('names the armor, the Dex it lets through and each shield', () => {
      const pc = pcWith(16, [armor('Studded Leather', '12 + Dex modifier'), armor('Shield', '+2')]);
      expect(acAutoLines(pc)).toEqual([
        { label: 'Studded Leather', value: 12 },
        { label: 'Dexterity', value: 3 },
        { label: 'Shield', value: 2 },
      ]);
    });

    it('says when medium armor caps Dex, and only then', () => {
      const capped = acAutoLines(pcWith(18, [armor('Half Plate', '15 + Dex modifier (max 2)')]));
      expect(capped[1]).toEqual({ label: 'Dexterity', value: 2, note: 'capped at +2 by medium armor' });

      const uncapped = acAutoLines(pcWith(12, [armor('Half Plate', '15 + Dex modifier (max 2)')]));
      expect(uncapped[1]).toEqual({ label: 'Dexterity', value: 1 });
    });

    it('shows that heavy armor adds no Dex', () => {
      expect(acAutoLines(pcWith(18, [armor('Plate', '18')]))).toEqual([
        { label: 'Plate', value: 18 },
        { label: 'Dexterity', value: 0, note: 'heavy armor adds none' },
      ]);
    });

    it('starts from unarmored 10 with nothing worn; a negative Dex counts too', () => {
      expect(acAutoLines(pcWith(8, []))).toEqual([
        { label: 'Unarmored', value: 10 },
        { label: 'Dexterity', value: -1 },
      ]);
    });

    it('always adds up to computeAc', () => {
      const pc = pcWith(14, [armor('Leather', '11 + Dex modifier'), armor('Chain Mail', '16'), armor('Shield', '+2')]);
      expect(acAutoLines(pc).reduce((sum, line) => sum + line.value, 0)).toBe(computeAc(pc));
    });
  });

  describe('withRecomputedAc', () => {
    const taunka = { ac: [{ value: 1, label: 'Taunka' }] };

    it('moves the saved AC by what the armor change is worth', () => {
      const before: PcItem[] = [armor('Plate', '18', false)];
      const after = { ...pcWith(10, [armor('Plate', '18', true)]), ac: 10 }; // was unarmored 10
      expect(withRecomputedAc(after, before).ac).toBe(18);
    });

    it('leaves a hand-set AC alone for unrelated inventory edits', () => {
      const inventory = [armor('Plate', '18'), { name: 'Rope', category: 'gear' as const, qty: 2 }];
      const pc = { ...pcWith(10, inventory), ac: 25 }; // DM hand-set
      const edited = { ...pc, inventory: [inventory[0], { ...inventory[1], qty: 1 }] };
      expect(withRecomputedAc(edited, inventory).ac).toBe(25);
    });

    it('keeps a DM adjustment line through equipping armor', () => {
      const before: PcItem[] = [armor('Chain Shirt', '13 + Dex modifier (max 2)', false)];
      const after = {
        ...pcWith(14, [armor('Chain Shirt', '13 + Dex modifier (max 2)', true)]),
        ac: 13,                 // unarmored 10 + Dex 2 + Taunka 1
        statAdjustments: taunka,
      };
      const result = withRecomputedAc(after, before);
      expect(result.ac).toBe(16); // 13 + Dex 2 + Taunka 1
      expect(result.statAdjustments).toEqual(taunka);
    });

    it('keeps a DM adjustment line through taking armor and a shield off', () => {
      const before: PcItem[] = [armor('Plate', '18'), armor('Shield', '+2')];
      const after = {
        ...pcWith(12, [armor('Plate', '18', false), armor('Shield', '+2', false)]),
        ac: 21,                 // 18 + shield 2 + Taunka 1
        statAdjustments: taunka,
      };
      expect(withRecomputedAc(after, before).ac).toBe(12); // unarmored 10 + Dex 1 + Taunka 1
    });

    it('keeps a dropped or sold armor line out, and the adjustment in', () => {
      const before: PcItem[] = [armor('Leather', '11 + Dex modifier')];
      const after = { ...pcWith(14, []), ac: 14, statAdjustments: taunka }; // 11 + 2 + 1, armor now gone
      expect(withRecomputedAc(after, before).ac).toBe(13); // 10 + 2 + 1
    });

    it('carries an older hand-typed difference that has no line yet', () => {
      const before: PcItem[] = [armor('Leather', '11 + Dex modifier', false)];
      const after = { ...pcWith(10, [armor('Leather', '11 + Dex modifier', true)]), ac: 13 }; // 10 + 3 typed by hand
      expect(withRecomputedAc(after, before).ac).toBe(14); // 11 + the same 3
    });

    it('builds the total from the lines when no AC was ever saved', () => {
      const before: PcItem[] = [];
      const after = { ...pcWith(10, [armor('Plate', '18')]), ac: undefined, statAdjustments: taunka };
      expect(withRecomputedAc(after, before).ac).toBe(19);
    });
  });
});
