import { ContentSource } from './content-source';
import { modFromScore } from '../utils/character-math';

/**
 * Hero classes from the World of Warcraft tabletop module. Each is a themed
 * subclass of a base 2024 class, shown in the class list as
 * `[WoW class] ([Base class])`. Storage is the base class plus a fixed subclass —
 * a Death Knight is persisted exactly like a Paladin with
 * `subclass: 'Oath of the Ebon Blade'` — so every rules lookup (hit die, saves,
 * skills, equipment, slots) keeps using the base class.
 *
 * Everything class-specific — the specialization picker, the level-1 feature,
 * the resource line and the always-prepared spell table — lives in
 * {@link HERO_CLASSES}, so components never special-case a hero class. Adding
 * one is one entry in that table.
 */

/** One specialization a hero class can take (a Death Knight's rune, a Demon Hunter's spec). */
export interface SpecializationOption {
  name: string;
  /** One-line description shown on the picker card and the sheet panel. */
  desc: string;
}

/** A named feature shown on the hero-class panel. */
export interface HeroFeature {
  name: string;
  desc: string;
}

/** A per-character resource line on the panel (e.g. "Death Coil pool · 3d8"). */
export interface HeroResource {
  name: string;
  /** The computed amount, already formatted ("3d8", "2 per Long Rest"). */
  amount: string;
  /** Base-class level the resource unlocks at. */
  fromLevel: number;
}

/** The ability scores a resource can scale with. */
export type HeroStats = Partial<Record<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', number>>;

/**
 * One base-class-level row of an always-prepared spell table: the spell every
 * member gets (`all`) plus one per specialization, keyed by specialization name.
 */
export interface HeroSpellRow {
  classLevel: number;
  all: string;
  bySpecialization: Readonly<Record<string, string>>;
}

/** A spell granted outside the table (e.g. the Death Knight's Rune Strike at Paladin 2). */
export interface HeroBonusSpell {
  name: string;
  classLevel: number;
  /** Shown as the "granted by" tag, e.g. 'Runic Smite'. */
  grantedBy: string;
}

export interface HeroClassOption {
  /** Display name, e.g. 'Death Knight (Paladin)'. */
  label: string;
  /** Short hero name, e.g. 'Death Knight'. */
  name: string;
  /** The base class stored on the PC (`clazz`). */
  baseClass: string;
  /** The subclass the hero class locks in at creation. */
  subclass: string;
  source: ContentSource;
  /** One- or two-sentence description shown in the class step. */
  blurb: string;
  /** What this class calls its specialization, lower-case ('rune', 'specialization'). */
  specializationLabel: string;
  /** Appended to the specialization name for display ('Rune' → "Frost Rune"); absent shows the bare name. */
  specializationSuffix?: string;
  specializations: readonly SpecializationOption[];
  /** True when the specialization may be changed on level-up. */
  respecOnLevelUp: boolean;
  /** The feature the hero class grants at level 1. */
  level1Feature: HeroFeature;
  /** The resource line for a character at `level` with `stats`; null before it unlocks. */
  resource?: (level: number, stats: HeroStats | undefined) => HeroResource | null;
  /** Always-prepared spells outside the table. */
  bonusSpells?: readonly HeroBonusSpell[];
  /** Always-prepared spells by base-class level and specialization. */
  spellTable: readonly HeroSpellRow[];
}

// ── Death Knight (Paladin) — Oath of the Ebon Blade ──────────────────────────

export const EBON_BLADE_SUBCLASS = 'Oath of the Ebon Blade';

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

/** Death Coil pool size: 1 + CHA modifier, never below one die. */
export function deathCoilDice(stats: HeroStats | undefined): number {
  return Math.max(1, 1 + modFromScore(stats?.CHA ?? 10));
}

const DEATH_KNIGHT: HeroClassOption = {
  label: 'Death Knight (Paladin)',
  name: 'Death Knight',
  baseClass: 'Paladin',
  subclass: EBON_BLADE_SUBCLASS,
  source: 'World of Warcraft',
  blurb: 'A risen knight sworn to the Ebon Blade, fighting with rune-carved steel '
    + 'and the necrotic and frost magic that once animated them.',
  specializationLabel: 'rune',
  specializationSuffix: 'Rune',
  specializations: [
    { name: 'Blood',  desc: 'A self-sustaining tank who feeds on the life of foes to stay standing.' },
    { name: 'Frost',  desc: 'An icy striker who fights with a weapon in each hand.' },
    { name: 'Unholy', desc: 'Spreads disease and commands undead minions to overwhelm the enemy.' },
  ],
  respecOnLevelUp: true,
  level1Feature: { name: 'Death Coil', desc: DEATH_COIL_DESC },
  resource: (_level, stats) => ({ name: 'Death Coil pool', amount: `${deathCoilDice(stats)}d8`, fromLevel: 1 }),
  // Rune Strike is always prepared from Paladin level 2 (it rides on Runic Smite).
  bonusSpells: [{ name: 'Rune Strike', classLevel: 2, grantedBy: 'Runic Smite' }],
  spellTable: [
    { classLevel: 3,  all: 'Death Grip',          bySpecialization: { Blood: 'Vampiric Blood',          Frost: 'Chains of Ice',      Unholy: 'Scourge Strike' } },
    { classLevel: 5,  all: 'Death and Decay',     bySpecialization: { Blood: 'Spiritual Weapon',        Frost: 'Frostscythe',        Unholy: 'Ray of Enfeeblement' } },
    { classLevel: 9,  all: 'Summon Undead',       bySpecialization: { Blood: 'Leeching Strike',         Frost: 'Remorseless Winter', Unholy: 'Bestow Curse' } },
    { classLevel: 13, all: 'Freedom of Movement', bySpecialization: { Blood: "Evard's Black Tentacles", Frost: 'Ice Storm',          Unholy: 'Blight' } },
    { classLevel: 17, all: 'Circle of Power',     bySpecialization: { Blood: 'Bonestorm',               Frost: 'Cone of Cold',       Unholy: 'Contagion' } },
  ],
};

export const HERO_CLASSES: readonly HeroClassOption[] = [DEATH_KNIGHT];

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

/** The hero class a character is, by base class + subclass; undefined for everyone else. */
export function heroClassFor(
  pc: { clazz?: string | null; subclass?: string | null } | null | undefined,
): HeroClassOption | undefined {
  const hero = heroClassForSubclass(pc?.subclass);
  return hero && (pc?.clazz ?? '').toLowerCase() === hero.baseClass.toLowerCase() ? hero : undefined;
}

/** "Frost Rune" / "Havoc" — a specialization as shown to people. */
export function specializationTitle(hero: HeroClassOption, name: string): string {
  return hero.specializationSuffix ? `${name} ${hero.specializationSuffix}` : name;
}

/** "Rune" / "Specialization" — the label capitalized for headings. */
export function specializationHeading(hero: HeroClassOption): string {
  const l = hero.specializationLabel;
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export interface HeroSpellEntry {
  name: string;
  /** Base-class level the spell is gained at. */
  classLevel: number;
  /** What granted it: a bonus-spell source (e.g. 'Runic Smite'), 'All', or the specialization. */
  grantedBy: string;
}

/**
 * The always-prepared spells a hero-class character has at `level`, in table
 * order: bonus spells first (e.g. Rune Strike from 2), then for each reached row
 * the shared spell and the spell for the character's specialization. No
 * specialization → only the shared column.
 */
export function heroClassSpells(
  hero: HeroClassOption, level: number, specialization: string | null | undefined,
): HeroSpellEntry[] {
  const out: HeroSpellEntry[] = [];
  for (const bonus of hero.bonusSpells ?? []) {
    if (level >= bonus.classLevel) out.push({ name: bonus.name, classLevel: bonus.classLevel, grantedBy: bonus.grantedBy });
  }
  for (const row of hero.spellTable) {
    if (level < row.classLevel) break;
    out.push({ name: row.all, classLevel: row.classLevel, grantedBy: 'All' });
    const own = specialization ? row.bySpecialization[specialization] : undefined;
    if (own) out.push({ name: own, classLevel: row.classLevel, grantedBy: specialization! });
  }
  return out;
}
