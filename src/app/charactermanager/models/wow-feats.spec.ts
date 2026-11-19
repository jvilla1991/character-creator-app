import { FEAT_DESCRIPTIONS } from '../services/dnd-resources.service';
import { WOW_FEATS, WOW_MAGE_FEATS, featPrerequisite, featSource, isWowFeat } from './wow-feats';
import { WOW_MAGE_GUIDANCE } from './wow-class-variants';

describe('wow-feats', () => {
  it('lists the three World of Warcraft mage feats', () => {
    expect(WOW_MAGE_FEATS.map(f => f.name)).toEqual(['Clearcasting', 'Fingers of Frost', 'Hot Streak']);
    for (const f of WOW_MAGE_FEATS) {
      expect(WOW_FEATS).toContain(f);
      expect(f.prerequisite).withContext(f.name).toBeUndefined();   // just the General feats' level 4+
    }
  });

  it('tags them World of Warcraft (case-insensitive) and leaves every PHB feat on the base game', () => {
    expect(isWowFeat('Clearcasting')).toBeTrue();
    expect(isWowFeat('fingers of frost')).toBeTrue();
    expect(isWowFeat(' Hot Streak ')).toBeTrue();
    expect(featSource('Hot Streak')).toBe('World of Warcraft');
    for (const name of ['War Caster', 'Spell Sniper', 'Elemental Adept', 'Alert', '', null, undefined]) {
      expect(isWowFeat(name)).withContext(String(name)).toBeFalse();
      expect(featSource(name)).withContext(String(name)).toBe('Base Game');
      expect(featPrerequisite(name)).withContext(String(name)).toBeUndefined();
    }
    const wow = Object.keys(FEAT_DESCRIPTIONS).filter(isWowFeat);
    expect(wow.sort()).toEqual(WOW_FEATS.map(f => f.name).sort());
  });

  it('describes each mage feat in its own words: +1 INT and its rider', () => {
    for (const f of WOW_MAGE_FEATS) {
      expect(FEAT_DESCRIPTIONS[f.name]).withContext(f.name).toContain('Increase your Intelligence by 1 (max 20)');
    }
    const cc = FEAT_DESCRIPTIONS['Clearcasting'];
    for (const part of ['Critical Hit with a spell attack', 'Reaction to cast a cantrip', 'casting time of an action',
      'Force damage', 'any 1 on a damage die as a 2']) {
      expect(cc).withContext(part).toContain(part);
    }
    const fof = FEAT_DESCRIPTIONS['Fingers of Frost'];
    for (const part of ['ignores Resistance to Cold', 'Restrained condition', 'd4s equal to your Proficiency Bonus']) {
      expect(fof).withContext(part).toContain(part);
    }
    const hs = FEAT_DESCRIPTIONS['Hot Streak'];
    for (const part of ['ignores Resistance to Fire', 'starts burning', 'already burning', 'increases by 1d4']) {
      expect(hs).withContext(part).toContain(part);
    }
  });

  it('is what the mage guidance recommends — one feat per specialization', () => {
    expect(WOW_MAGE_GUIDANCE['Arcane'].feats.filter(isWowFeat)).toEqual(['Clearcasting']);
    expect(WOW_MAGE_GUIDANCE['Fire'].feats.filter(isWowFeat)).toEqual(['Hot Streak']);
    expect(WOW_MAGE_GUIDANCE['Frost'].feats.filter(isWowFeat)).toEqual(['Fingers of Frost']);
  });
});
