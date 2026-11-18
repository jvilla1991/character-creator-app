import { heroClassFor } from '../models/hero-class';

/**
 * The class name to show people for a character: the hero-class label when the
 * subclass marks one (`Paladin` + `Oath of the Ebon Blade` → `Death Knight (Paladin)`),
 * otherwise the stored class unchanged. A WoW Druid (Druid + specialization, no
 * hero subclass) reads just `Druid` — the sheet header suffix shows the spec.
 * Display only — rules lookups must keep using the stored base class.
 */
export function classDisplayName(
  clazz: string | null | undefined, subclass?: string | null, specialization?: string | null,
): string {
  const hero = heroClassFor({ clazz, subclass, specialization });
  return hero ? hero.label : clazz ?? '';
}
