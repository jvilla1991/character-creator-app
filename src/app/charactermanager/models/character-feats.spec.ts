import { featNamesOn, isFeatEntry } from './character-feats';

describe('character-feats', () => {
  const feature = (name: string, source: string) => ({ name, source, desc: '' });

  it('reads the Origin feat and every features entry, each once, in the order stored', () => {
    expect(featNamesOn(null)).toEqual([]);
    expect(featNamesOn({})).toEqual([]);
    expect(featNamesOn({ feat: ' Familiar Friend ' })).toEqual(['Familiar Friend']);
    expect(featNamesOn({
      feat: 'Familiar Friend',
      features: [
        feature('Familiar Friend', 'Familiar Trainer · Origin Feat'),
        feature('Magic Initiate (Wizard)', 'Human (World of Warcraft) · Origin Feat'),
        feature('Second Wind', 'Fighter 1'),
        feature('Arcane Warrior', 'Fighting Style (Level 2)'),
        feature('Spell Resistant', 'Feat (Level 4)'),
        feature('portal jumper', 'Feat'),
        feature('  ', 'Feat'),
      ],
    })).toEqual(['Familiar Friend', 'Magic Initiate (Wizard)', 'Second Wind', 'Arcane Warrior', 'Spell Resistant',
      'portal jumper']);
  });

  it('tells a feat entry from a class feature by the source it was saved with', () => {
    for (const source of ['Feat', 'feat (level 4)', 'Feat (Level 19)', 'Sage · Origin Feat',
      'Human (World of Warcraft) · Origin Feat', 'Fighting Style (Level 2)']) {
      expect(isFeatEntry({ source })).withContext(source).toBeTrue();
    }
    for (const source of ['Fighter 1', 'Paladin 2', 'DM Grant', 'Species', '', null, undefined]) {
      expect(isFeatEntry({ source })).withContext(String(source)).toBeFalse();
    }
  });
});
