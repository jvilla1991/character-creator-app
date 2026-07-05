import { computeAc, parseArmorClass, shieldBonus, withRecomputedAc } from './armor-math';
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

  describe('withRecomputedAc', () => {
    it('recomputes when the equipped-armor picture changed', () => {
      const before: PcItem[] = [armor('Plate', '18', false)];
      const after = pcWith(10, [armor('Plate', '18', true)]);
      expect(withRecomputedAc(after, before).ac).toBe(18);
    });

    it('leaves a hand-set AC alone for unrelated inventory edits', () => {
      const inventory = [armor('Plate', '18'), { name: 'Rope', category: 'gear' as const, qty: 2 }];
      const pc = { ...pcWith(10, inventory), ac: 25 }; // DM hand-set
      const edited = { ...pc, inventory: [inventory[0], { ...inventory[1], qty: 1 }] };
      expect(withRecomputedAc(edited, inventory).ac).toBe(25);
    });
  });
});
