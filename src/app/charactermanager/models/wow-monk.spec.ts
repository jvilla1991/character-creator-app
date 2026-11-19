import {
  MYSTIC_BREW_RULES, WARRIOR_OF_MYSTIC_BREWS, martialArtsDie, monkFeatureCards, mysticBrewCard, mysticBrewSaveDc,
  mysticBrewsCard, refreshingDipDice,
} from './wow-monk';
import { FeatureCard, FeatureCardInput } from './hero-class';

describe('wow-monk (Warrior of Mystic Brews cards)', () => {
  const brewer = (level: number, WIS = 16, overrides: Partial<FeatureCardInput> = {}): FeatureCardInput =>
    ({ level, subclass: WARRIOR_OF_MYSTIC_BREWS, stats: { DEX: 16, WIS }, ...overrides });
  const stat = (card: FeatureCard, label: string) => card.stats!.find(s => s.label === label)?.value;
  const row = (card: FeatureCard, name: string) => card.rows.find(r => r.name === name);

  it('scales the Martial Arts die with Monk level: d6, d8 from 5, d10 from 11, d12 from 17', () => {
    expect([1, 4, 5, 10, 11, 16, 17, 20].map(martialArtsDie)).toEqual([6, 6, 8, 8, 10, 10, 12, 12]);
  });

  it('works out the brew save DC (8 + WIS + PB) and the Refreshing Dip pool (WIS + half the level, at least 1)', () => {
    expect(mysticBrewSaveDc(brewer(6))).toBe(14);                    // 8 + 3 + 3
    expect(mysticBrewSaveDc(brewer(6, 16, { prof: 4 }))).toBe(15);   // stored proficiency wins
    expect(mysticBrewSaveDc(brewer(17, 20))).toBe(19);               // 8 + 5 + 6
    expect(refreshingDipDice(brewer(6))).toBe(6);                    // 3 + 3
    expect(refreshingDipDice(brewer(11))).toBe(8);                   // 3 + 5
    expect(refreshingDipDice(brewer(17, 20))).toBe(13);              // 5 + 8
    // WIS ≤ 0
    expect(mysticBrewSaveDc(brewer(6, 8))).toBe(10);                 // 8 − 1 + 3
    expect(refreshingDipDice(brewer(6, 8))).toBe(2);                 // −1 + 3
    expect(mysticBrewSaveDc(brewer(6, 10))).toBe(11);                // WIS +0
    expect(refreshingDipDice(brewer(6, 10))).toBe(3);
    expect(refreshingDipDice(brewer(6, 1))).toBe(1);                 // −5 + 3 → at least one die
    expect(refreshingDipDice({ level: 6, subclass: WARRIOR_OF_MYSTIC_BREWS })).toBe(3);   // no stats → WIS 10
  });

  it('shows nothing before Monk 3 or for another subclass', () => {
    expect(monkFeatureCards(brewer(2))).toEqual([]);
    expect(monkFeatureCards(brewer(6, 16, { subclass: 'Warrior of Mercy' }))).toEqual([]);
    expect(monkFeatureCards(brewer(6, 16, { subclass: null }))).toEqual([]);
  });

  it('at Monk 3 shows Bonus Proficiencies and Drunken Technique with a d6 Martial Arts die, and no brews yet', () => {
    const cards = monkFeatureCards(brewer(3));
    expect(cards.map(c => c.name)).toEqual([WARRIOR_OF_MYSTIC_BREWS]);
    const card = cards[0];
    expect(card.source).toBe('Warrior of Mystic Brews 3');
    expect(stat(card, 'Martial Arts')).toBe('d6');
    expect(card.rows.map(r => r.name)).toEqual(['Bonus Proficiencies', 'Drunken Technique']);
    expect(row(card, 'Bonus Proficiencies')!.text).toContain("Brewer's Supplies");
    expect(row(card, 'Drunken Technique')!.text).toContain('Patient Defense');
    expect(mysticBrewCard(brewer(5))).toBeNull();
    expect(monkFeatureCards(brewer(3, 16, { subclass: 'warrior of mystic brews' })).length).toBe(1);
  });

  it('at Monk 6 adds Tipsy Sway and the Mystic Brew card: Cinnamon Dragon 4d8, Heavenly Spirit, Refreshing Dip 6d8', () => {
    const [features, brew] = monkFeatureCards(brewer(6));
    expect(features.rows.map(r => r.name)).toEqual(['Bonus Proficiencies', 'Drunken Technique', 'Tipsy Sway']);
    expect(stat(features, 'Martial Arts')).toBe('d8');
    expect(brew.name).toBe('Mystic Brew');
    expect(brew.source).toBe('Warrior of Mystic Brews 6');
    expect(brew.summary).toBe(MYSTIC_BREW_RULES);
    for (const part of ["Short or Long Rest", "Brewer's Supplies", 'Only you can drink', '1 minute', '1 hour',
      '8 hours', '1 Focus Point']) {
      expect(brew.summary).withContext(part).toContain(part);
    }
    expect(brew.stats).toEqual([
      { label: 'Martial Arts', value: 'd8' }, { label: 'Brew save DC', value: '14' }, { label: 'Refreshing Dip', value: '6d8' },
    ]);
    expect(brew.rows.map(r => r.name)).toEqual(['Cinnamon Dragon', 'Heavenly Spirit', 'Refreshing Dip']);
    const dragon = row(brew, 'Cinnamon Dragon')!;
    expect(dragon.kind).toBe('4d8 Fire');
    for (const part of ['30-ft. Cone', 'DC 14 Dexterity save', 'Poisoned', 'half damage']) {
      expect(dragon.text).withContext(part).toContain(part);
    }
    expect(row(brew, 'Heavenly Spirit')!.text).toContain('two of Cold, Necrotic, Psychic, or Radiant');
    expect(row(brew, 'Refreshing Dip')!.kind).toBe('6d8 pool');
  });

  it('at Monk 11 adds the Wizened Brewer brews with a d10 die', () => {
    const brew = mysticBrewCard(brewer(11))!;
    expect(brew.rows.map(r => r.name)).toEqual([
      'Cinnamon Dragon', 'Heavenly Spirit', 'Refreshing Dip', 'Blue Lightning', "Drunkard's Luck", 'Stumbling Monk',
    ]);
    expect(row(brew, 'Cinnamon Dragon')!.kind).toBe('4d10 Fire');
    expect(row(brew, 'Refreshing Dip')!.kind).toBe('8d10 pool');
    expect(row(brew, 'Blue Lightning')!.kind).toContain('Wizened Brewer');
    expect(stat(brew, 'Brew save DC')).toBe('15');   // 8 + 3 + 4
    expect(row(brew, 'Master Brewer')).toBeUndefined();
  });

  it('at Monk 17 adds Master Brewer (combine two options) and Intoxicated Frenzy, with a d12 die', () => {
    const [features, brew] = monkFeatureCards(brewer(17, 20));
    expect(features.rows.map(r => r.name)).toContain('Intoxicated Frenzy');
    expect(stat(features, 'Martial Arts')).toBe('d12');
    expect(row(brew, 'Master Brewer')!.text).toContain('combine two');
    expect(row(brew, 'Cinnamon Dragon')!.kind).toBe('4d12 Fire');
    expect(stat(brew, 'Brew save DC')).toBe('19');
    expect(stat(brew, 'Refreshing Dip')).toBe('13d12');
    expect(brew.rows.length).toBe(7);
  });

  it('keeps a WIS ≤ 0 brewer playable: lower DC, at least one Refreshing Dip die', () => {
    const brew = mysticBrewCard(brewer(6, 3))!;   // WIS −4
    expect(stat(brew, 'Brew save DC')).toBe('7');   // 8 − 4 + 3
    expect(stat(brew, 'Refreshing Dip')).toBe('1d8');
    expect(row(brew, 'Cinnamon Dragon')!.text).toContain('DC 7 Dexterity save');
  });
});
