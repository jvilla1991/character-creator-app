import { PC, PcSpell } from '../models/pc';
import {
  draftBlockedReason, draftChoices, draftTempHp, hasLongRestChoices, startLongRestDraft,
} from './long-rest-choices';

describe('long rest choices util', () => {
  const spell = (name: string, lvl: number, prepared?: boolean): PcSpell =>
    ({ name, lvl, school: 'Evocation', time: '1 action', ...(prepared === undefined ? {} : { prepared }) } as PcSpell);

  const cleric = (over: Partial<PC> = {}): PC => ({
    id: 7, name: 'Mira', clazz: 'Cleric', level: 5, playerName: 'Sam',
    spells: [spell('Guidance', 0, true), spell('Bless', 1, true), spell('Command', 1, false), spell('Aid', 2)],
    ...over,
  } as PC);

  const knight = (over: Partial<PC> = {}): PC => ({
    id: 9, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood',
    level: 5, playerName: 'Sam',
    stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
    inventory: [
      { name: 'Greatsword', category: 'weapon', qty: 1 },
      { name: 'Maul', category: 'weapon', qty: 1 },
    ],
    ...over,
  } as PC);

  it('knows who has something to choose', () => {
    expect(hasLongRestChoices(cleric())).toBeTrue();
    expect(hasLongRestChoices(knight())).toBeTrue();                       // rune weapon
    expect(hasLongRestChoices(cleric({ clazz: 'Bard' }))).toBeFalse();     // no change at a long rest
    expect(hasLongRestChoices(cleric({ spells: [spell('Guidance', 0)] }))).toBeFalse(); // only cantrips
    expect(hasLongRestChoices(cleric({ clazz: 'Fighter', spells: [] }))).toBeFalse();
    expect(hasLongRestChoices(knight({ level: 2 }))).toBeFalse();          // no Runeforging, no spells
  });

  it('starts from the sheet: prepared leveled spells (a missing flag counts) and the current rune weapon', () => {
    expect(startLongRestDraft(cleric())).toEqual({
      pcId: 7, originalSpells: ['Bless', 'Aid'], spells: ['Bless', 'Aid'], originalRune: null, rune: null,
    });
    const draft = startLongRestDraft(knight({ runeWeapon: 'greatsword' }));
    expect(draft.originalRune).toBe('Greatsword');
    expect(draft.rune).toBe('Greatsword');
  });

  it('picks up the choices the server is already holding after a reload', () => {
    const draft = startLongRestDraft(cleric(), { preparedSpells: ['Command', 'Aid', 'Gone Spell'] });
    expect(draft.originalSpells).toEqual(['Bless', 'Aid']);
    expect(draft.spells).toEqual(['Command', 'Aid']); // a spell no longer on the sheet is dropped

    const rune = startLongRestDraft(knight({ runeWeapon: 'Greatsword' }), { runeWeapon: 'maul' });
    expect(rune.originalRune).toBe('Greatsword');
    expect(rune.rune).toBe('Maul');
  });

  it('sends only what the player changed', () => {
    const draft = startLongRestDraft(cleric());
    expect(draftChoices(draft)).toEqual({});
    expect(draftChoices(null)).toEqual({});
    expect(draftChoices({ ...draft, spells: ['Aid', 'Bless'] })).toEqual({});   // same list, other order
    expect(draftChoices({ ...draft, spells: ['Command', 'Aid'] })).toEqual({ preparedSpells: ['Command', 'Aid'] });

    const rune = startLongRestDraft(knight({ runeWeapon: 'Greatsword' }));
    expect(draftChoices(rune)).toEqual({});
    expect(draftChoices({ ...rune, rune: 'Maul' })).toEqual({ runeWeapon: 'Maul' });
  });

  it('holds Ready back until a Death Knight with a melee weapon has picked one for the rune', () => {
    const fresh = startLongRestDraft(knight());
    expect(draftBlockedReason(knight(), fresh)).toBe('Choose the weapon that carries your rune first.');
    expect(draftBlockedReason(knight(), { ...fresh, rune: 'Maul' })).toBeNull();
    // Nothing to inscribe: not held back.
    const unarmed = knight({ inventory: [] });
    expect(draftBlockedReason(unarmed, startLongRestDraft(unarmed))).toBeNull();
    // Everyone else is never held back.
    expect(draftBlockedReason(cleric(), startLongRestDraft(cleric()))).toBeNull();
    expect(draftBlockedReason(knight(), null)).toBeNull();
  });

  it('works out the Blood Rune temporary Hit Points from the draft', () => {
    const fresh = startLongRestDraft(knight());
    expect(draftTempHp(knight(), fresh)).toBe(0);                        // no weapon chosen yet
    expect(draftTempHp(knight(), { ...fresh, rune: 'Maul' })).toBe(8);   // +3 CHA + level 5
    expect(draftTempHp(knight({ specialization: 'Frost' }), { ...fresh, rune: 'Maul' })).toBe(0);
    expect(draftTempHp(knight({ runeWeapon: 'Maul' }), null)).toBe(8);   // no draft: the sheet decides
    expect(draftTempHp(cleric(), startLongRestDraft(cleric()))).toBe(0);
  });
});
