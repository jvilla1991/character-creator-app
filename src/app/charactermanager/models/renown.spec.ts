import { renownProgress, renownStanding } from './renown';

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
});
