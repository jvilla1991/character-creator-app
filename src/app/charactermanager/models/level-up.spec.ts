import { LevelUpPreview, previewWithSubclass } from './level-up';

/** The level-up preview with a subclass picked: a subclass that brings Spellcasting changes its spell numbers. */
describe('previewWithSubclass', () => {
  const MYSTIC_ARTS = 'Warrior of the Mystic Arts';

  const preview: LevelUpPreview = {
    currentLevel: 2, newLevel: 3, hitDie: 8, conModifier: 1, hpGained: 6, newHpMax: 24,
    currentProfBonus: 2, newProfBonus: 2, currentSpellSlots: {}, newSpellSlots: {},
    subclassDue: true, subclassOptions: ['Warrior of Shadow', MYSTIC_ARTS], asiDue: false, featOptions: [],
    featuresGained: [], fightingStyleDue: false, fightingStyleOptions: [],
    currentCantripsKnown: 0, newCantripsKnown: 0, currentSpellsKnown: 0, newSpellsKnown: 0,
    spellcastingBySubclass: { [MYSTIC_ARTS]: { newSpellSlots: { 1: 2 }, newCantripsKnown: 2, newSpellsKnown: 3 } },
  };

  it('reads with that option\'s slots, cantrips and prepared spells', () => {
    const picked = previewWithSubclass(preview, MYSTIC_ARTS);
    expect(picked).not.toBe(preview);
    expect(picked.newSpellSlots).toEqual({ 1: 2 });
    expect(picked.newCantripsKnown).toBe(2);
    expect(picked.newSpellsKnown).toBe(3);
    // Everything else is the server's preview, the same objects.
    expect(picked.subclassOptions).toBe(preview.subclassOptions);
    expect(picked.currentCantripsKnown).toBe(0);
    expect(picked.hpGained).toBe(6);
    expect(preview.newSpellSlots).toEqual({});
  });

  it('is the preview itself for an option that changes nothing, or no option', () => {
    expect(previewWithSubclass(preview, 'Warrior of Shadow')).toBe(preview);
    expect(previewWithSubclass(preview, null)).toBe(preview);
    expect(previewWithSubclass(preview, undefined)).toBe(preview);
    const older = { ...preview, spellcastingBySubclass: undefined };
    expect(previewWithSubclass(older, MYSTIC_ARTS)).toBe(older);
  });
});
