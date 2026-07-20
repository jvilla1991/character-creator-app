import { MAX_LEVEL, isReadyToLevel, xpForNextLevel, xpProgressPct } from './xp-thresholds';

describe('xp-thresholds', () => {

  describe('xpForNextLevel', () => {
    it('level 1 needs 300 total XP for level 2', () => {
      expect(xpForNextLevel(1)).toBe(300);
    });

    it('level 4 needs 6500 total XP for level 5', () => {
      expect(xpForNextLevel(4)).toBe(6_500);
    });

    it('level 19 needs 355000 total XP for level 20', () => {
      expect(xpForNextLevel(19)).toBe(355_000);
    });

    it('returns null at max level', () => {
      expect(xpForNextLevel(MAX_LEVEL)).toBeNull();
      expect(xpForNextLevel(25)).toBeNull();
    });
  });

  describe('isReadyToLevel', () => {
    it('true once total XP reaches the next threshold', () => {
      expect(isReadyToLevel(1, 300)).toBeTrue();
      expect(isReadyToLevel(1, 299)).toBeFalse();
    });

    it('never ready at max level', () => {
      expect(isReadyToLevel(MAX_LEVEL, 9_999_999)).toBeFalse();
    });
  });

  describe('xpProgressPct', () => {
    // The bar's fill must be the SAME ratio as the "{xp} / {next} XP" label
    // beside it: total XP over the next level's total threshold.
    it('matches the label ratio (total XP / next-level threshold)', () => {
      expect(xpProgressPct(1, 150)).toBe(50);          // 150 / 300
      expect(xpProgressPct(2, 300)).toBeCloseTo(300 / 900 * 100, 6);
      expect(xpProgressPct(4, 1_300)).toBe(20);        // 1300 / 6500
    });

    it('is 0 with no XP', () => {
      expect(xpProgressPct(1, 0)).toBe(0);
      expect(xpProgressPct(10, 0)).toBe(0);
    });

    it('caps at 100 when XP passes the threshold before leveling', () => {
      expect(xpProgressPct(1, 300)).toBe(100);
      expect(xpProgressPct(1, 5_000)).toBe(100);
    });

    it('is 100 at max level', () => {
      expect(xpProgressPct(MAX_LEVEL, 0)).toBe(100);
      expect(xpProgressPct(MAX_LEVEL, 400_000)).toBe(100);
    });

    it('never goes below 0', () => {
      expect(xpProgressPct(1, -50)).toBe(0);
    });

    it('moves as awards land (live-session reactivity contract)', () => {
      const before = xpProgressPct(3, 1_000); // of the 2700 needed for L4
      const after = xpProgressPct(3, 1_500);
      expect(after).toBeGreaterThan(before);
      expect(after).toBeCloseTo(1_500 / 2_700 * 100, 6);
    });
  });
});
