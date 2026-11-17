import { heroClassForSubclass } from '../models/hero-class';

/**
 * The class name to show people for a character: the hero-class label when the
 * subclass marks one (`Paladin` + `Oath of the Ebon Blade` → `Death Knight (Paladin)`),
 * otherwise the stored class unchanged. Display only — rules lookups must keep
 * using the stored base class.
 */
export function classDisplayName(clazz: string | null | undefined, subclass?: string | null): string {
  const hero = heroClassForSubclass(subclass);
  if (hero && (clazz ?? '').toLowerCase() === hero.baseClass.toLowerCase()) return hero.label;
  return clazz ?? '';
}
