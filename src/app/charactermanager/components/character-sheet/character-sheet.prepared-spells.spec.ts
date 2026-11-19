import { CharacterSheetComponent } from './character-sheet.component';

// Who may toggle prepared spells on the sheet. The getter only reads
// `editable`, `ownSheet` and the character's campaign, so it is exercised
// straight off the prototype with a stand-in for the component.
describe('CharacterSheetComponent prepared spells', () => {
  const canPrepare =
    (self: { editable: boolean; ownSheet: boolean; pc: { campaignId?: number | string | null } | undefined }): boolean =>
      Object.getOwnPropertyDescriptor(CharacterSheetComponent.prototype, 'canPrepareSpells')!.get!.call(self);

  it('the owner of a character in no campaign may prepare freely', () => {
    const own = { editable: false, ownSheet: true, pc: { campaignId: null } };
    expect(canPrepare(own)).toBeTrue();
    expect(canPrepare({ ...own, pc: {} })).toBeTrue(); // campaignId absent
  });

  it('the owner of a campaign character may not: prepared spells change during a long rest', () => {
    const own = { editable: false, ownSheet: true, pc: { campaignId: 7 } };
    expect(canPrepare(own)).toBeFalse();
    expect(canPrepare({ ...own, pc: { campaignId: 'veiled' } })).toBeFalse(); // demo campaigns use string ids
  });

  it('the DM keeps the toggle through the edit path', () => {
    expect(canPrepare({ editable: true, ownSheet: false, pc: { campaignId: 7 } })).toBeTrue();
  });

  it('a read-only viewer never could', () => {
    expect(canPrepare({ editable: false, ownSheet: false, pc: { campaignId: 7 } })).toBeFalse();
  });

  it('no longer explains itself in a hint line', () => {
    expect(Object.getOwnPropertyDescriptor(CharacterSheetComponent.prototype, 'preparedSpellsHint')).toBeUndefined();
  });
});
