import { RENOWN_MILESTONES, RENOWN_THRESHOLDS, renownProgress, renownSpan, renownStanding } from './renown';

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
  it('starts at Neutral and resets progress at each new standing', () => {
    expect(renownStanding(0).name).toBe('Neutral');
    for (const [min] of ranges) expect(renownProgress(min)).toBe(0);
    expect(renownProgress(100)).toBe(100);
    expect(renownProgress(75)).toBe(50);
  });
  it('fills Neutral 0 to exactly the centre of its bar', () => {
    expect(renownProgress(0)).toBe(50);
  });
  it('tops out at 100% on the highest score of every standing', () => {
    for (const [, max] of ranges) expect(renownProgress(max)).toBe(100);
  });
  it('spans the whole −100…+100 scale with no gaps or overlaps', () => {
    expect(RENOWN_MILESTONES.reduce((sum, tier) => sum + renownSpan(tier), 0)).toBe(201);
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
    // −3 sits between −3 and −2 (98 of 201 scores in); +3 between +2 and +3 (103).
    const at = (value: number) => RENOWN_THRESHOLDS.find(t => t.value === value)!.percent;
    expect(at(-3)).toBeCloseTo(98 / 201 * 100, 6);
    expect(at(3)).toBeCloseTo(103 / 201 * 100, 6);
    expect(at(-25)).toBeCloseTo(76 / 201 * 100, 6);
    expect(at(50)).toBeCloseTo(150 / 201 * 100, 6);
  });
});
