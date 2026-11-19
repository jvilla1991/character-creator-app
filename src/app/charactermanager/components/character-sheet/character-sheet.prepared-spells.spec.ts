import { CharacterSheetComponent } from './character-sheet.component';

// Who may toggle prepared spells on the sheet. The two getters only read
// `editable`, `ownSheet` and the character's campaign, so they are exercised
// straight off the prototype with a stand-in for the component.
describe('CharacterSheetComponent prepared spells', () => {
  const getter = <T>(name: 'canPrepareSpells' | 'preparedSpellsHint') =>
    (self: { editable: boolean; ownSheet: boolean; pc: { campaignId?: number | string | null } | undefined }): T =>
      Object.getOwnPropertyDescriptor(CharacterSheetComponent.prototype, name)!.get!.call(self);

  const canPrepare = getter<boolean>('canPrepareSpells');
  const hint = getter<string | null>('preparedSpellsHint');

  it('the owner of a character in no campaign may prepare freely, with no hint', () => {
    const own = { editable: false, ownSheet: true, pc: { campaignId: null } };
    expect(canPrepare(own)).toBeTrue();
    expect(hint(own)).toBeNull();
    expect(canPrepare({ ...own, pc: {} })).toBeTrue(); // campaignId absent
  });

  it('the owner of a campaign character may not, and is told why', () => {
    const own = { editable: false, ownSheet: true, pc: { campaignId: 7 } };
    expect(canPrepare(own)).toBeFalse();
    expect(hint(own)).toBe('Prepared spells change during a long rest.');
    expect(canPrepare({ ...own, pc: { campaignId: 'veiled' } })).toBeFalse(); // demo campaigns use string ids
  });

  it('the DM keeps the toggle through the edit path, with no hint', () => {
    const dm = { editable: true, ownSheet: false, pc: { campaignId: 7 } };
    expect(canPrepare(dm)).toBeTrue();
    expect(hint(dm)).toBeNull();
  });

  it('a read-only viewer never could, and gets no hint', () => {
    const viewer = { editable: false, ownSheet: false, pc: { campaignId: 7 } };
    expect(canPrepare(viewer)).toBeFalse();
    expect(hint(viewer)).toBeNull();
  });
});
