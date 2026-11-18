import { demoFightingStyleOptions, demoSubclassOptions } from './pc.demo-data';

describe('pc.demo-data (WoW mirrors)', () => {
  it('offers Blessed Warrior to every paladin and Druidic Warrior to every ranger at level 2', () => {
    expect(demoFightingStyleOptions('Paladin', undefined, 2)).toContain('Blessed Warrior');
    expect(demoFightingStyleOptions('Paladin', undefined, 2)).not.toContain('Druidic Warrior');
    expect(demoFightingStyleOptions('Ranger', undefined, 2)).toContain('Druidic Warrior');
    expect(demoFightingStyleOptions('Ranger', undefined, 2)).not.toContain('Void Warrior');
    expect(demoFightingStyleOptions('Ranger', 'Demon Hunter', 2)).toEqual(
      jasmine.arrayContaining(['Druidic Warrior', 'Void Warrior']));
    expect(demoFightingStyleOptions('Paladin', undefined, 3)).toEqual([]);
  });

  it('offers Oath of the Holy only to WoW paladins', () => {
    expect(demoSubclassOptions('Paladin', 'Holy')).toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', 'Retribution')).toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', null)).not.toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', 'Blood')).not.toContain('Oath of the Holy');
    expect(demoSubclassOptions('Druid', 'Balance')).not.toContain('Oath of the Holy');
  });
});
