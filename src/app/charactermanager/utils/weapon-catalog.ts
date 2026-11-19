/**
 * Melee or ranged, for the weapons the shop catalog knows — the SRD 2024
 * weapon table, exactly as the backend's `V11__seed_srd_weapons.sql` seeds it
 * (its `details.range`). The server keeps the same table in `WeaponCatalog`,
 * with a test that pins it to the seed; this copy must list the same weapons
 * (weapon-catalog.spec.ts counts them).
 *
 * A weapon on a sheet is a snapshot with no range of its own, so it is looked
 * up here: by catalog key first (stamped on every bought or granted item),
 * then by exact name, ignoring case. Anything else is not a catalog weapon.
 */
const MELEE: Array<[key: string, name: string]> = [
  // Simple
  ['club', 'Club'], ['dagger', 'Dagger'], ['greatclub', 'Greatclub'], ['handaxe', 'Handaxe'],
  ['javelin', 'Javelin'], ['light-hammer', 'Light Hammer'], ['mace', 'Mace'],
  ['quarterstaff', 'Quarterstaff'], ['sickle', 'Sickle'], ['spear', 'Spear'],
  // Martial
  ['battleaxe', 'Battleaxe'], ['flail', 'Flail'], ['glaive', 'Glaive'], ['greataxe', 'Greataxe'],
  ['greatsword', 'Greatsword'], ['halberd', 'Halberd'], ['lance', 'Lance'], ['longsword', 'Longsword'],
  ['maul', 'Maul'], ['morningstar', 'Morningstar'], ['pike', 'Pike'], ['rapier', 'Rapier'],
  ['scimitar', 'Scimitar'], ['shortsword', 'Shortsword'], ['trident', 'Trident'],
  ['war-pick', 'War Pick'], ['warhammer', 'Warhammer'], ['whip', 'Whip'],
];

const RANGED: Array<[key: string, name: string]> = [
  // Simple
  ['dart', 'Dart'], ['light-crossbow', 'Light Crossbow'], ['shortbow', 'Shortbow'], ['sling', 'Sling'],
  // Martial
  ['blowgun', 'Blowgun'], ['hand-crossbow', 'Hand Crossbow'], ['heavy-crossbow', 'Heavy Crossbow'],
  ['longbow', 'Longbow'], ['net', 'Net'],
];

const RANGED_BY_KEY = new Map<string, boolean>();
const RANGED_BY_NAME = new Map<string, boolean>();
for (const [key, name] of MELEE) { RANGED_BY_KEY.set(key, false); RANGED_BY_NAME.set(name.toLowerCase(), false); }
for (const [key, name] of RANGED) { RANGED_BY_KEY.set(key, true); RANGED_BY_NAME.set(name.toLowerCase(), true); }

/** Every catalog weapon key, melee then ranged. */
export const CATALOG_WEAPON_KEYS: readonly string[] = [...MELEE, ...RANGED].map(([key]) => key);

/**
 * Whether a catalog weapon is ranged; undefined when neither the key nor the
 * name is a catalog weapon (the caller then reads the weapon's own name and
 * properties).
 */
export function catalogWeaponRanged(catalogKey: string | null | undefined, name: string | null | undefined): boolean | undefined {
  const byKey = catalogKey ? RANGED_BY_KEY.get(catalogKey.trim().toLowerCase()) : undefined;
  if (byKey !== undefined) return byKey;
  return name ? RANGED_BY_NAME.get(name.trim().toLowerCase()) : undefined;
}
