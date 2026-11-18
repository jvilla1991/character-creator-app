import { CANTRIP_FIGHTING_STYLES, cantripFightingStyle } from './cantrip-fighting-styles';

describe('cantrip-fighting-styles', () => {
  it('maps each cantrip style to its class list, two cantrips each', () => {
    expect(CANTRIP_FIGHTING_STYLES.map(c => [c.style, c.spellList, c.count])).toEqual([
      ['Blessed Warrior', 'cleric', 2],
      ['Druidic Warrior', 'druid', 2],
      ['Void Warrior', 'warlock', 2],
    ]);
  });

  it('hints Sacred Flame / Spare the Dying and Chill Touch / Mind Sliver; Druidic Warrior has no hint', () => {
    expect(cantripFightingStyle('Blessed Warrior')?.hint).toContain('Sacred Flame and Spare the Dying');
    expect(cantripFightingStyle('Void Warrior')?.hint).toContain('Chill Touch and Mind Sliver');
    expect(cantripFightingStyle('Druidic Warrior')?.hint).toBeUndefined();
  });

  it('is undefined for ordinary styles and blanks', () => {
    expect(cantripFightingStyle('Defense')).toBeUndefined();
    expect(cantripFightingStyle('')).toBeUndefined();
    expect(cantripFightingStyle(null)).toBeUndefined();
  });
});
