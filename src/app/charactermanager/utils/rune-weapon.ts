import { PC } from '../models/pc';
import { EBON_BLADE_SUBCLASS } from '../models/hero-class';
import { modFromScore } from './character-math';

/**
 * Death Knight Runeforging (World of Warcraft tabletop module): from Paladin
 * level 3 the knight's rune sits on one melee weapon, chosen as a long rest
 * ends. `pc.runeWeapon` holds that weapon's NAME — weapons on a sheet have no
 * id. These rules mirror the server's `LongRestRules`, which has the last word.
 */

/** A melee weapon the hero has, as the rune picker lists it. */
export interface MeleeWeapon {
  name: string;
  damage: string | null;
}

/** A Death Knight who has Runeforging: Paladin + Oath of the Ebon Blade, level 3 or higher. */
export function isRuneforger(pc: Pick<PC, 'clazz' | 'subclass' | 'level'> | null | undefined): boolean {
  return (pc?.clazz ?? '').trim().toLowerCase() === 'paladin'
    && (pc?.subclass ?? '').trim().toLowerCase() === EBON_BLADE_SUBCLASS.toLowerCase()
    && (pc?.level ?? 0) >= 3;
}

// A sheet's weapon entries carry no melee/ranged flag (only the shop catalog
// does), so this reads what they do carry: the Ammunition property, or a
// telling name. Same test as the server.
const RANGED_NAME = /(bow\b|\bsling\b|\bdarts?\b|\bblowgun\b|\bmusket\b|\bpistol\b|\bnet\b)/i;

export function isRangedWeapon(name: string, properties?: string[] | null): boolean {
  if ((properties ?? []).some(p => (p ?? '').trim().toLowerCase().startsWith('ammunition'))) return true;
  return RANGED_NAME.test(name);
}

/**
 * The melee weapons the hero has, in sheet order and without repeats:
 * inventory weapons that are not dropped, then the older free-text weapon list.
 */
export function meleeWeapons(pc: Pick<PC, 'inventory' | 'weapons'>): MeleeWeapon[] {
  const byKey = new Map<string, MeleeWeapon>();
  for (const item of pc.inventory ?? []) {
    const name = (item.name ?? '').trim();
    if (!name || item.category !== 'weapon' || item.status === 'dropped') continue;
    if (isRangedWeapon(name, item.properties)) continue;
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), { name, damage: item.damage ?? null });
  }
  for (const weapon of pc.weapons ?? []) {
    const name = (weapon.name ?? '').trim();
    if (!name || isRangedWeapon(name)) continue;
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), { name, damage: weapon.dmg || null });
  }
  return [...byKey.values()];
}

/**
 * The weapon the rune is on right now, in the sheet's own spelling, or null:
 * nothing recorded, not a Runeforging Death Knight, or the recorded weapon is
 * no longer on the sheet (which counts as unset).
 */
export function runeWeaponOf(pc: PC): string | null {
  if (!isRuneforger(pc)) return null;
  const stored = (pc.runeWeapon ?? '').trim().toLowerCase();
  if (!stored) return null;
  return meleeWeapons(pc).find(w => w.name.toLowerCase() === stored)?.name ?? null;
}

/** "Blood Rune" — or just "Rune" when no rune type is recorded. */
export function runeName(pc: Pick<PC, 'specialization'>): string {
  const spec = (pc.specialization ?? '').trim();
  return spec ? `${spec} Rune` : 'Rune';
}

export function isBloodRune(pc: Pick<PC, 'specialization'>): boolean {
  return (pc.specialization ?? '').trim().toLowerCase() === 'blood';
}

/**
 * Temporary Hit Points a Blood-rune Death Knight gains on finishing a long
 * rest with the rune inscribed: Charisma modifier + Paladin level, never below
 * zero. `inscribed` is whether a weapon will carry the rune once this rest's
 * choice is applied. Zero for everyone else.
 */
export function bloodRuneTempHp(pc: PC, inscribed: boolean): number {
  if (!inscribed || !isRuneforger(pc) || !isBloodRune(pc)) return 0;
  return Math.max(0, modFromScore(pc.stats?.CHA ?? 10) + (pc.level ?? 0));
}
