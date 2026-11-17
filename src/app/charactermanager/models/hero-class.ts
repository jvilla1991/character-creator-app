import { ContentSource } from './content-source';

/**
 * Hero classes from the World of Warcraft tabletop module. Each is a themed
 * subclass of a base 2024 class, shown in the class list as
 * `[WoW class] ([Base class])`. Storage is the base class plus a fixed subclass —
 * a Death Knight is persisted exactly like a Paladin with
 * `subclass: 'Oath of the Ebon Blade'` — so every rules lookup (hit die, saves,
 * skills, equipment, slots) keeps using the base class.
 *
 * Adding a future hero class (e.g. Demon Hunter (Ranger)) is one entry in
 * {@link HERO_CLASSES}.
 */

/** Death Knight rune specialization, persisted on the PC as `rune`. */
export type Rune = 'Blood' | 'Frost' | 'Unholy';

export interface RuneOption {
  name: Rune;
  desc: string;
}

export const RUNE_OPTIONS: readonly RuneOption[] = [
  { name: 'Blood',  desc: 'A self-sustaining tank who feeds on the life of foes to stay standing.' },
  { name: 'Frost',  desc: 'An icy striker who fights with a weapon in each hand.' },
  { name: 'Unholy', desc: 'Spreads disease and commands undead minions to overwhelm the enemy.' },
];

export interface HeroClassOption {
  /** Display name, e.g. 'Death Knight (Paladin)'. */
  label: string;
  /** The base class stored on the PC (`clazz`). */
  baseClass: string;
  /** The subclass the hero class locks in at creation. */
  subclass: string;
  source: ContentSource;
  /** One- or two-sentence description shown in the class step. */
  blurb: string;
  /** True when the wizard must collect a rune (Death Knight). */
  runeRequired: boolean;
}

export const EBON_BLADE_SUBCLASS = 'Oath of the Ebon Blade';

export const HERO_CLASSES: readonly HeroClassOption[] = [
  {
    label: 'Death Knight (Paladin)',
    baseClass: 'Paladin',
    subclass: EBON_BLADE_SUBCLASS,
    source: 'World of Warcraft',
    blurb: 'A risen knight sworn to the Ebon Blade, fighting with rune-carved steel '
      + 'and the necrotic and frost magic that once animated them.',
    runeRequired: true,
  },
];

/** One row of the class step: a base class or a hero class layered on one. */
export interface ClassOption {
  label: string;
  baseClass: string;
  source: ContentSource;
  hero?: HeroClassOption;
}

/**
 * The full class list: the base class names in their given (API) order, then
 * the hero classes in table order. Hero classes are grouped after the base list
 * rather than interleaved alphabetically so the familiar 12 stay where players
 * expect them.
 */
export function buildClassOptions(baseNames: readonly string[]): ClassOption[] {
  return [
    ...baseNames.map((name): ClassOption => ({ label: name, baseClass: name, source: 'Base Game' })),
    ...HERO_CLASSES.map((hero): ClassOption => ({
      label: hero.label, baseClass: hero.baseClass, source: hero.source, hero,
    })),
  ];
}

export function heroClassByLabel(label: string | null | undefined): HeroClassOption | undefined {
  return label ? HERO_CLASSES.find(h => h.label === label) : undefined;
}

/** The hero class a stored subclass represents (e.g. Ebon Blade → Death Knight), if any. */
export function heroClassForSubclass(subclass: string | null | undefined): HeroClassOption | undefined {
  return subclass ? HERO_CLASSES.find(h => h.subclass === subclass) : undefined;
}

// ── Oath of the Ebon Blade: always-prepared spells ───────────────────────────

/** One Paladin-level row of the oath spell table: the shared spell plus one per rune. */
export interface OathSpellRow {
  paladinLevel: number;
  all: string;
  Blood: string;
  Frost: string;
  Unholy: string;
}

export const EBON_BLADE_OATH_SPELLS: readonly OathSpellRow[] = [
  { paladinLevel: 3,  all: 'Death Grip',           Blood: 'Vampiric Blood',          Frost: 'Chains of Ice',      Unholy: 'Scourge Strike' },
  { paladinLevel: 5,  all: 'Death and Decay',      Blood: 'Spiritual Weapon',        Frost: 'Frostscythe',        Unholy: 'Ray of Enfeeblement' },
  { paladinLevel: 9,  all: 'Summon Undead',        Blood: 'Leeching Strike',         Frost: 'Remorseless Winter', Unholy: 'Bestow Curse' },
  { paladinLevel: 13, all: 'Freedom of Movement',  Blood: "Evard's Black Tentacles", Frost: 'Ice Storm',          Unholy: 'Blight' },
  { paladinLevel: 17, all: 'Circle of Power',      Blood: 'Bonestorm',               Frost: 'Cone of Cold',       Unholy: 'Contagion' },
];

/** Rune Strike is always prepared from Paladin level 2 (it rides on Runic Smite). */
export const RUNE_STRIKE = { name: 'Rune Strike', paladinLevel: 2 } as const;

export interface OathSpellEntry {
  name: string;
  /** Paladin level the spell is gained at. */
  paladinLevel: number;
  /** Which column granted it: 'Runic Smite' (Rune Strike), 'All', or the rune. */
  grantedBy: 'Runic Smite' | 'All' | Rune;
}

/**
 * The always-prepared Ebon Blade spells a character has at `level`, in table
 * order: Rune Strike (from 2), then for each reached row the shared spell and
 * the spell for the character's rune. No rune → only the shared column.
 */
export function ebonBladeOathSpells(level: number, rune: Rune | null | undefined): OathSpellEntry[] {
  const out: OathSpellEntry[] = [];
  if (level >= RUNE_STRIKE.paladinLevel) {
    out.push({ name: RUNE_STRIKE.name, paladinLevel: RUNE_STRIKE.paladinLevel, grantedBy: 'Runic Smite' });
  }
  for (const row of EBON_BLADE_OATH_SPELLS) {
    if (level < row.paladinLevel) break;
    out.push({ name: row.all, paladinLevel: row.paladinLevel, grantedBy: 'All' });
    if (rune) out.push({ name: row[rune], paladinLevel: row.paladinLevel, grantedBy: rune });
  }
  return out;
}

/**
 * Death Coil — the Ebon Blade's replacement for Lay On Hands (paraphrased).
 * Shown on the sheet for Ebon Blade characters from level 1.
 */
export const DEATH_COIL_DESC =
  'Replaces Lay On Hands. You have a pool of d8s equal to 1 + your Charisma modifier. '
  + 'As a Bonus Action, choose a creature within 60 feet and spend dice from the pool: '
  + 'it makes a Constitution saving throw or takes necrotic damage equal to the roll — '
  + 'or, if it is Undead, it regains that many hit points instead. '
  + 'Your creature type is Undead.';
