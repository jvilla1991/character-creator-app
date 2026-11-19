import { CATALOG_WEAPON_KEYS, catalogWeaponRanged } from './weapon-catalog';
import { isRangedWeapon, meleeWeapons } from './rune-weapon';
import { PcItem } from '../models/pc';

describe('weapon catalog (melee or ranged)', () => {
  // The backend seed (V11) has these 37 weapons; its WeaponCatalogSeedTest pins
  // the server table to the seed, and this pins the client table to the same list.
  const SEEDED_MELEE = [
    'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light-hammer', 'mace', 'quarterstaff', 'sickle',
    'spear', 'battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword', 'halberd', 'lance', 'longsword',
    'maul', 'morningstar', 'pike', 'rapier', 'scimitar', 'shortsword', 'trident', 'war-pick', 'warhammer', 'whip',
  ];
  const SEEDED_RANGED = [
    'dart', 'light-crossbow', 'shortbow', 'sling', 'blowgun', 'hand-crossbow', 'heavy-crossbow', 'longbow', 'net',
  ];

  it('lists exactly the 37 SRD weapons the backend seeds', () => {
    expect(CATALOG_WEAPON_KEYS.length).toBe(37);
    expect([...CATALOG_WEAPON_KEYS].sort()).toEqual([...SEEDED_MELEE, ...SEEDED_RANGED].sort());
  });

  it('answers melee or ranged for every one of them, by key', () => {
    for (const key of SEEDED_MELEE) expect(catalogWeaponRanged(key, null)).withContext(key).toBeFalse();
    for (const key of SEEDED_RANGED) expect(catalogWeaponRanged(key, null)).withContext(key).toBeTrue();
  });

  it('matches by exact name when there is no key, ignoring case', () => {
    expect(catalogWeaponRanged(null, 'LIGHT CROSSBOW')).toBeTrue();
    expect(catalogWeaponRanged(null, ' war pick ')).toBeFalse();
    expect(catalogWeaponRanged(null, 'Javelin')).toBeFalse(); // thrown, but a melee weapon
    expect(catalogWeaponRanged(null, 'Dart')).toBeTrue();     // thrown, and a ranged weapon
  });

  it('has no answer for a weapon the catalog does not know', () => {
    expect(catalogWeaponRanged(null, "Greataxe 'Splitter'")).toBeUndefined();
    expect(catalogWeaponRanged('frostmourne', 'Frostmourne')).toBeUndefined();
    expect(catalogWeaponRanged(null, null)).toBeUndefined();
  });

  describe('isRangedWeapon', () => {
    it('lets the catalog key win over a renamed item', () => {
      expect(isRangedWeapon('Heartseeker', null, 'longbow')).toBeTrue();
      expect(isRangedWeapon('Bowbreaker', null, 'greataxe')).toBeFalse(); // the name alone would say ranged
    });

    it('falls back to properties and name for custom weapons', () => {
      expect(isRangedWeapon('Musket')).toBeTrue();
      expect(isRangedWeapon('Pistol')).toBeTrue();
      expect(isRangedWeapon('Elven Courtbow')).toBeTrue();
      expect(isRangedWeapon('Thunder Tube', ['Ammunition (40/120)'])).toBeTrue();
      expect(isRangedWeapon("Greataxe 'Splitter'")).toBeFalse();
      expect(isRangedWeapon('Handaxes (4)')).toBeFalse();
    });
  });

  it('the rune weapon list uses the catalog key on inventory items', () => {
    const item = (name: string, catalogKey?: string): PcItem => ({ name, catalogKey, category: 'weapon', qty: 1 });
    const inventory = [item('Heartseeker', 'longbow'), item('Bowbreaker', 'greataxe'), item('Dart')];
    expect(meleeWeapons({ inventory }).map(w => w.name)).toEqual(['Bowbreaker']);
  });
});
