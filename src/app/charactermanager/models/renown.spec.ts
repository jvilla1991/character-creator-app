import { RENOWN_MILESTONES, RENOWN_THRESHOLDS, renownFillsFromRight, renownProgress, renownSpan, renownStanding } from './renown';

describe('renown milestones', () => {
  const ranges: [number, number, string][] = [
    [-100, -25, 'Hated'], [-24, -10, 'Hostile'], [-9, -3, 'Unfriendly'],
    [-2, 2, 'Neutral'], [3, 9, 'Friendly'], [10, 24, 'Honored'],
    [25, 49, 'Revered'], [50, 100, 'Exalted'],
  ];
  for (const [min, max, name] of ranges) {
    it(`labels both boundaries of ${name}`, () => {
      expect(renownStanding(min).name).toBe(name);
      expect(renownStanding(max).name).toBe(name);
    });
  }
  // The score where you enter a standing coming from Neutral, and its far end.
  const entry = ([min, max]: [number, number, string]) => max < 0 ? max : min;
  const farEnd = ([min, max]: [number, number, string]) => max < 0 ? min : max;

  it('starts at Neutral and resets progress at each new standing', () => {
    expect(renownStanding(0).name).toBe('Neutral');
    for (const range of ranges) expect(renownProgress(entry(range))).toBe(0);
    expect(renownProgress(100)).toBe(100);
    expect(renownProgress(75)).toBe(50);
  });
  it('fills Neutral 0 to exactly the centre of its bar', () => {
    expect(renownProgress(0)).toBe(50);
  });
  it('tops out at 100% on the far end of every standing', () => {
    for (const range of ranges) expect(renownProgress(farEnd(range))).toBe(100);
  });
  it('fills below-Neutral standings deeper as renown is lost', () => {
    expect(renownProgress(-3)).toBe(0);
    expect(renownProgress(-6)).toBe(50);
    expect(renownProgress(-9)).toBe(100);
    expect(renownProgress(-17)).toBe(50);
    expect(renownProgress(-100)).toBe(100);
  });
  it('draws only the below-Neutral standings from the right', () => {
    expect([-100, -25, -10, -3].every(renownFillsFromRight)).toBeTrue();
    expect([-2, 0, 2, 3, 50, 100].some(renownFillsFromRight)).toBeFalse();
  });
  it('fills the drawn −60…+60 scale with no gaps or overlaps', () => {
    expect(RENOWN_MILESTONES.reduce((sum, tier) => sum + renownSpan(tier), 0)).toBe(121);
    RENOWN_MILESTONES.forEach((tier, i) => {
      const next = RENOWN_MILESTONES[i + 1];
      if (next) expect(next.min as number).toBe(tier.max + 1);
    });
  });
  it('marks where each standing begins, outward from Neutral', () => {
    expect(RENOWN_THRESHOLDS.map(t => t.value)).toEqual([-25, -10, -3, 3, 10, 25, 50]);
    expect(RENOWN_THRESHOLDS.filter(t => t.minor).map(t => t.value)).toEqual([-10, 10]);
  });
  it('pins each threshold to the boundary between its two standings', () => {
    // −3 sits between −3 and −2 (58 of 121 scores in); +3 between +2 and +3 (63).
    const at = (value: number) => RENOWN_THRESHOLDS.find(t => t.value === value)!.percent;
    expect(at(-3)).toBeCloseTo(58 / 121 * 100, 6);
    expect(at(3)).toBeCloseTo(63 / 121 * 100, 6);
    expect(at(-25)).toBeCloseTo(36 / 121 * 100, 6);
    expect(at(50)).toBeCloseTo(110 / 121 * 100, 6);
  });
});
