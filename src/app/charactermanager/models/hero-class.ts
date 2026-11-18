import { ContentSource } from './content-source';
import { modFromScore } from '../utils/character-math';
import { WOW_CLASS_VARIANTS } from './wow-class-variants';

/**
 * Hero classes from the World of Warcraft tabletop module. Most are a themed
 * subclass of a base 2024 class, shown in the class list as
 * `[WoW class] ([Base class])`. Storage is the base class plus a fixed subclass —
 * a Death Knight is persisted exactly like a Paladin with
 * `subclass: 'Oath of the Ebon Blade'` — so every rules lookup (hit die, saves,
 * skills, equipment, slots) keeps using the base class.
 *
 * A WoW *variant* (the WoW Druid, see {@link WOW_CLASS_VARIANTS}) has no fixed
 * subclass: it is the base class plus a specialization, and the subclass is
 * chosen normally. Such a character is recognized by base class + a non-null
 * specialization + no hero subclass.
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

/**
 * Recommended starting picks for one specialization — shown as a "Recommended
 * for <spec>" box in the class step and as highlights in the spells step.
 * Guidance only; nothing is auto-selected.
 */
export interface SpecializationGuidance {
  /** A base-class feature choice to suggest, e.g. Primal Order → Magician. */
  featureChoice?: { feature: string; option: string };
  /** Starting cantrips (classes with cantrips at level 1). */
  cantrips?: readonly string[];
  level1Spells: readonly string[];
  /** Weapon Mastery: take at least one of these weapons. */
  weaponMastery?: readonly string[];
  /** The level-2 Fighting Style(s) to take — any one of them. */
  fightingStyles?: readonly string[];
  /** The cantrips to learn with that style when it teaches some (e.g. Blessed Warrior). */
  fightingStyleCantrips?: readonly string[];
  /** The subclass to take when it comes due, with an optional flavour note. */
  subclass: { name: string; note?: string };
  feats: readonly string[];
  /** An extra play tip shown on the sheet panel. */
  tip?: string;
  /** A short aside shown under the class-step box (e.g. another class that fits the role). */
  note?: string;
}

/** One spell level of a specialization's suggested (not always-prepared) spells. */
export interface SuggestedSpellLevel {
  level: number;
  spells: readonly string[];
}

export interface HeroClassOption {
  /**
   * Stable id of the class-step row — what the wizard selects by and saves in
   * its draft. Equals the label for the subclass-based hero classes (so drafts
   * saved before keys existed still restore); differs where the label alone is
   * ambiguous (the WoW Druid's label is just 'Druid').
   */
  key: string;
  /** Display name, e.g. 'Death Knight (Paladin)'. */
  label: string;
  /** Short hero name, e.g. 'Death Knight'. */
  name: string;
  /** The base class stored on the PC (`clazz`). */
  baseClass: string;
  /**
   * The subclass the hero class locks in at creation. Absent for a WoW variant
   * of a base class (the WoW Druid), whose subclass is chosen normally.
   */
  subclass?: string;
  /** Class-step note for a variant without a fixed subclass ('Chosen as normal at Druid level 3'). */
  subclassNote?: string;
  /** What the base class calls its subclass, lower-case ('circle', 'oath'); absent reads 'subclass'. */
  subclassTerm?: string;
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
  /** The feature the hero class grants at level 1, if any. */
  level1Feature?: HeroFeature;
  /** The resource line for a character at `level` with `stats`; null before it unlocks. */
  resource?: (level: number, stats: HeroStats | undefined) => HeroResource | null;
  /** Always-prepared spells outside the table. */
  bonusSpells?: readonly HeroBonusSpell[];
  /** Always-prepared spells by base-class level and specialization. */
  spellTable: readonly HeroSpellRow[];
  /** Recommended starting picks per specialization (wizard guidance). */
  guidance?: Readonly<Record<string, SpecializationGuidance>>;
  /** Suggested spells per specialization, by spell level (sheet panel). */
  suggestedSpells?: Readonly<Record<string, readonly SuggestedSpellLevel[]>>;
  /** A one-line reminder shown in the class step and on the sheet panel. */
  renownNote?: string;
  /** True when the sheet panel shows the WoW druid beast forms. */
  beastForms?: boolean;
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
  key: 'Death Knight (Paladin)',
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

// ── Demon Hunter (Ranger) ────────────────────────────────────────────────────

export const DEMON_HUNTER_SUBCLASS = 'Demon Hunter';

/**
 * Soul Fragments per Long Rest from Ranger level 3: the Wisdom modifier (at
 * least 1), plus 1 from Ranger 13, or plus 2 from Ranger 17. 0 before level 3.
 */
export function soulFragments(level: number, stats: HeroStats | undefined): number {
  if (level < 3) return 0;
  const bonus = level >= 17 ? 2 : level >= 13 ? 1 : 0;
  return Math.max(1, modFromScore(stats?.WIS ?? 10)) + bonus;
}

const DEMON_HUNTER: HeroClassOption = {
  key: 'Demon Hunter (Ranger)',
  label: 'Demon Hunter (Ranger)',
  name: 'Demon Hunter',
  baseClass: 'Ranger',
  subclass: DEMON_HUNTER_SUBCLASS,
  source: 'World of Warcraft',
  blurb: 'A hunter who took demonic power into themselves to fight the Burning Legion, '
    + 'giving up their eyesight for spectral senses. Demon hunters are usually elves — '
    + 'blood, night, or void elves; check with your DM before playing another species.',
  specializationLabel: 'specialization',
  specializations: [
    { name: 'Devourer',  desc: 'A void-magic caster who feeds on the souls of the fallen.' },
    { name: 'Havoc',     desc: 'A fel-fueled melee striker who fights with a blade in each hand.' },
    { name: 'Vengeance', desc: 'A tank who turns demonic power into a shield for their allies.' },
  ],
  respecOnLevelUp: false,
  level1Feature: {
    name: 'Spellcasting Change',
    desc: 'You can use an Arcane Focus (instead of a Druidic Focus) as the spellcasting focus for your Ranger spells.',
  },
  resource: (level, stats) => level >= 3
    ? { name: 'Soul Fragments', amount: `${soulFragments(level, stats)} per Long Rest`, fromLevel: 3 }
    : null,
  spellTable: [
    { classLevel: 3,  all: 'Throw Glaive',     bySpecialization: { Devourer: 'Consume Soul',      Havoc: 'Fel Rush',       Vengeance: 'Infernal Strike' } },
    { classLevel: 5,  all: 'Sigil of Flame',   bySpecialization: { Devourer: 'Misty Step',        Havoc: 'Eye Beam',       Vengeance: 'Fiery Brand' } },
    { classLevel: 9,  all: 'Metamorphosis',    bySpecialization: { Devourer: 'Soul Reap',         Havoc: 'Blink',          Vengeance: 'Demon Spikes' } },
    { classLevel: 13, all: 'Chaos Nova',       bySpecialization: { Devourer: 'Collapsing Star',   Havoc: 'Fire Shield',    Vengeance: 'Banishment' } },
    { classLevel: 17, all: 'Destructive Wave', bySpecialization: { Devourer: 'Steel Wind Strike', Havoc: 'Conjure Volley', Vengeance: 'Sigil of Chains' } },
  ],
};

export const HERO_CLASSES: readonly HeroClassOption[] = [DEATH_KNIGHT, DEMON_HUNTER, ...WOW_CLASS_VARIANTS];

/** One row of the class step: a base class or a hero class layered on one. */
export interface ClassOption {
  /** Unique row id: the base class name, or the hero class's key. */
  key: string;
  /** What the row shows (not unique — the WoW Druid row also reads 'Druid'). */
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
    ...baseNames.map((name): ClassOption => ({ key: name, label: name, baseClass: name, source: 'Base Game' })),
    ...HERO_CLASSES.map((hero): ClassOption => ({
      key: hero.key, label: hero.label, baseClass: hero.baseClass, source: hero.source, hero,
    })),
  ];
}

/** The hero class behind a class-step row key ('Death Knight (Paladin)', 'Druid (World of Warcraft)'). */
export function heroClassByKey(key: string | null | undefined): HeroClassOption | undefined {
  return key ? HERO_CLASSES.find(h => h.key === key) : undefined;
}

/** The hero class a stored subclass represents (e.g. Ebon Blade → Death Knight), if any. */
export function heroClassForSubclass(subclass: string | null | undefined): HeroClassOption | undefined {
  return subclass ? HERO_CLASSES.find(h => h.subclass === subclass) : undefined;
}

/**
 * The hero class a character is; undefined for everyone else.
 * - Subclass-based hero classes: base class + the hero subclass.
 * - WoW variants without a fixed subclass (WoW Druid, WoW Paladin): base class +
 *   one of the variant's specializations + no hero subclass. A druid or paladin
 *   with no specialization is a plain base-game character.
 */
export function heroClassFor(
  pc: { clazz?: string | null; subclass?: string | null; specialization?: string | null } | null | undefined,
): HeroClassOption | undefined {
  const clazz = (pc?.clazz ?? '').toLowerCase();
  const bySubclass = heroClassForSubclass(pc?.subclass);
  if (bySubclass) return clazz === bySubclass.baseClass.toLowerCase() ? bySubclass : undefined;
  const spec = (pc?.specialization ?? '').toLowerCase();
  if (!spec) return undefined;
  // The specialization must be one of the variant's own (a paladin with 'Frost' and no
  // Ebon Blade is not a WoW Paladin).
  return HERO_CLASSES.find(h => !h.subclass && h.baseClass.toLowerCase() === clazz
    && h.specializations.some(s => s.name.toLowerCase() === spec));
}

/** The subclass a specialization's guidance recommends (e.g. Guardian → Circle of the Moon). */
export function recommendedSubclassFor(
  hero: HeroClassOption | undefined, specialization: string | null | undefined,
): string | undefined {
  return specialization ? hero?.guidance?.[specialization]?.subclass.name : undefined;
}

const NO_SPELLS: readonly string[] = [];
const RECOMMENDED_SPELLS_CACHE = new Map<string, readonly string[]>();

/**
 * The cantrips + level-1 spells a specialization's guidance recommends, as one
 * stable (cached) array so template bindings don't see a new reference each pass.
 */
export function recommendedStartingSpells(
  hero: HeroClassOption | undefined, specialization: string | null | undefined,
): readonly string[] {
  const guidance = specialization ? hero?.guidance?.[specialization] : undefined;
  if (!hero || !guidance) return NO_SPELLS;
  const cacheKey = `${hero.key}|${specialization}`;
  let list = RECOMMENDED_SPELLS_CACHE.get(cacheKey);
  if (!list) {
    list = [...(guidance.cantrips ?? []), ...guidance.level1Spells];
    RECOMMENDED_SPELLS_CACHE.set(cacheKey, list);
  }
  return list;
}

/** The level-2 Fighting Style(s) a specialization's guidance recommends (e.g. Protection → Interception, Protection). */
export function recommendedFightingStylesFor(
  hero: HeroClassOption | undefined, specialization: string | null | undefined,
): readonly string[] {
  return (specialization && hero?.guidance?.[specialization]?.fightingStyles) || NO_SPELLS;
}

/** "A", "A or B", "A, B, or C" — a choice list in running text. */
export function orList(items: readonly string[]): string {
  if (items.length <= 2) return items.join(' or ');
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
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
