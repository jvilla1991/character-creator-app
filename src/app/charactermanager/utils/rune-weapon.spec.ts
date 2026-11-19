import { PC, PcItem } from '../models/pc';
import {
  bloodRuneTempHp, isRangedWeapon, isRuneforger, meleeWeapons, runeName, runeWeaponOf,
} from './rune-weapon';

describe('rune weapon util', () => {
  const weapon = (name: string, over: Partial<PcItem> = {}): PcItem =>
    ({ name, category: 'weapon', qty: 1, ...over });

  const knight = (over: Partial<PC> = {}): PC => ({
    id: 9, name: 'Thorne', clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Blood',
    level: 5, playerName: 'Sam',
    stats: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
    inventory: [
      weapon('Greatsword', { damage: '2d6 slashing', properties: ['heavy', 'two-handed'] }),
      weapon('Longbow', { properties: ['ammunition (150/600)', 'heavy'] }),
      weapon('Handaxe', { properties: ['light', 'thrown (20/60)'] }),
      weapon('Mace', { status: 'dropped' }),
      { name: 'Chain Mail', category: 'armor', qty: 1 },
    ],
    weapons: [{ name: 'Runeblade', dmg: '1d8' }, { name: 'Light Crossbow', dmg: '1d8' }],
    ...over,
  } as PC);

  it('a Runeforger is an Ebon Blade paladin of level 3 or higher', () => {
    expect(isRuneforger(knight())).toBeTrue();
    expect(isRuneforger(knight({ level: 2 }))).toBeFalse();
    expect(isRuneforger(knight({ subclass: 'Oath of Devotion' }))).toBeFalse();
    expect(isRuneforger(knight({ clazz: 'Ranger' }))).toBeFalse();
    expect(isRuneforger(null)).toBeFalse();
  });

  it('tells ranged weapons by the Ammunition property or a telling name', () => {
    expect(isRangedWeapon('Hand Cannon', ['Ammunition (30/90)'])).toBeTrue();
    expect(isRangedWeapon('Shortbow')).toBeTrue();
    expect(isRangedWeapon('Heavy Crossbow')).toBeTrue();
    expect(isRangedWeapon('Sling')).toBeTrue();
    expect(isRangedWeapon('Dart', ['finesse', 'thrown (20/60)'])).toBeTrue();
    expect(isRangedWeapon('Dagger', ['finesse', 'light', 'thrown (20/60)'])).toBeFalse();
    expect(isRangedWeapon('Longsword', ['versatile (1d10)'])).toBeFalse();
  });

  it('lists melee weapons from the inventory, then the older weapon list, without ranged or dropped ones', () => {
    expect(meleeWeapons(knight())).toEqual([
      { name: 'Greatsword', damage: '2d6 slashing' },
      { name: 'Handaxe', damage: null },
      { name: 'Runeblade', damage: '1d8' },
    ]);
    expect(meleeWeapons({})).toEqual([]);
  });

  it('the rune weapon is unset when nothing is stored or the stored weapon is gone', () => {
    expect(runeWeaponOf(knight())).toBeNull();
    expect(runeWeaponOf(knight({ runeWeapon: 'greatsword' }))).toBe('Greatsword'); // the sheet's spelling
    expect(runeWeaponOf(knight({ runeWeapon: 'Frostmourne' }))).toBeNull();        // sold since
    expect(runeWeaponOf(knight({ runeWeapon: 'Mace' }))).toBeNull();               // dropped
    expect(runeWeaponOf(knight({ runeWeapon: 'Greatsword', level: 2 }))).toBeNull();
  });

  it('names the rune after its type', () => {
    expect(runeName(knight())).toBe('Blood Rune');
    expect(runeName(knight({ specialization: 'Frost' }))).toBe('Frost Rune');
    expect(runeName(knight({ specialization: null }))).toBe('Rune');
  });

  it('the Blood Rune gives Charisma modifier + level in temporary Hit Points, only when inscribed', () => {
    expect(bloodRuneTempHp(knight(), true)).toBe(8);   // +3 + 5
    expect(bloodRuneTempHp(knight(), false)).toBe(0);
    expect(bloodRuneTempHp(knight({ specialization: 'Frost' }), true)).toBe(0);
    expect(bloodRuneTempHp(knight({ level: 2 }), true)).toBe(0);
    // Never below zero: CHA 3 is −4, plus level 3.
    expect(bloodRuneTempHp(knight({ level: 3, stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 3 } }), true))
      .toBe(0);
  });
});
