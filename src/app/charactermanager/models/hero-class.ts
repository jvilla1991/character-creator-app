import { ContentSource } from './content-source';
import { modFromScore } from '../utils/character-math';
import { WOW_CLASS_VARIANTS } from './wow-class-variants';
import { arcanaSubclass } from './arcana-subclasses';

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
 * One base-class-level row of an always-prepared spell table: the spell (or
 * spells — an Evoker row grants two) every member gets (`all`) plus the spell(s)
 * per specialization, keyed by specialization name.
 */
export interface HeroSpellRow {
  classLevel: number;
  all: string | readonly string[];
  bySpecialization: Readonly<Record<string, string | readonly string[]>>;
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
  /** Level-1 spells (absent for classes without spells, e.g. the Rogue). */
  level1Spells?: readonly string[];
  /** Weapon Mastery: take at least one of these weapons (or `weaponMasteryCount` of them). */
  weaponMastery?: readonly string[];
  /** How many of `weaponMastery` to take ('Any two of …'); absent reads 'At least one of …'. */
  weaponMasteryCount?: number;
  /**
   * The Fighting Style(s) to take — any one of them. Chosen at the class's
   * {@link HeroClassOption.fightingStyleLevel} (level 2; level 1 for a Fighter).
   */
  fightingStyles?: readonly string[];
  /** The cantrips to learn with that style when it teaches some (e.g. Blessed Warrior). */
  fightingStyleCantrips?: readonly string[];
  /**
   * Spells worth preparing beyond the cantrips and level-1 picks (a WoW Evoker's
   * list mixes level-1 and level-2 spells). Badged in the spells step like
   * `level1Spells`; spells above level 1 simply don't appear there yet.
   */
  extraPrepared?: readonly string[];
  /** Metamagic options to take (Sorcerer, from level 2). Text only — Metamagic isn't modelled. */
  metamagic?: readonly string[];
  /** The damage type(s) to pick for Draconic Sorcery's level-6 Elemental Affinity, as running text ('Cold or Fire'). */
  elementalAffinity?: string;
  /**
   * The subclass to take when it comes due, with an optional flavour note.
   * `name` is the stored subclass name (what pickers match on); `label`, when
   * set, is how guidance text shows it — the Wizard's 'Evoker' reads
   * 'Evoker (school of evocation)' so it isn't mistaken for the Evoker class.
   */
  subclass: { name: string; label?: string; note?: string };
  feats: readonly string[];
  /** An extra play tip shown on the sheet panel. */
  tip?: string;
  /** A tip tied to a base-class level (e.g. Rogue 5: Cunning Strike's Poison), shown in the class-step box and on the panel. */
  levelTip?: { level: number; text: string };
  /** A short aside shown under the class-step box (e.g. another class that fits the role). */
  note?: string;
  /**
   * Eldritch Invocations to take (Warlock). Invocations are not modelled in this
   * app, so these are recommendation text only — nothing is granted or tracked.
   */
  invocations?: InvocationGuidance;
  /**
   * Battle Master maneuvers worth considering (WoW Warrior). Maneuvers and
   * Superiority Dice are not modelled in this app, so these are recommendation
   * text only — nothing is granted or tracked.
   */
  maneuvers?: readonly string[];
}

/** Recommended Eldritch Invocations by when they are taken. */
export interface InvocationGuidance {
  /** The level-1 invocation. */
  level1?: readonly string[];
  /** The invocations gained at level 2. */
  level2?: readonly string[];
  /** Invocations worth considering from level 5. */
  fromLevel5?: readonly string[];
}

/** One labelled row of recommended invocations, as shown in the class step and on the sheet. */
export interface InvocationRow {
  label: string;
  names: readonly string[];
}

/** One base-class-level row of a WoW-only subclass's always-prepared spells (e.g. Oath of the Holy). */
export interface SubclassSpellRow {
  classLevel: number;
  spells: readonly string[];
}

/** What a computed sheet card (e.g. the WoW Shaman's Totems) is built from. */
export interface FeatureCardInput {
  /** Base-class level. */
  level: number;
  subclass?: string | null;
  stats?: HeroStats;
  /** Proficiency bonus; derived from the level when absent. */
  prof?: number | null;
}

/** One line of a computed sheet card: an option, a rider, or a feature gained at a later level. */
export interface FeatureCardRow {
  name: string;
  /** Short tag after the name ('2d8 Cold', 'Reaction · Barbarian 6'). */
  kind?: string;
  text: string;
  /** Spells the row lets you cast, looked up by name in the spell data. */
  spells?: readonly string[];
}

/** A computed sheet card (Totems, Raging Elements, …) — text only, never persisted. */
export interface FeatureCard {
  name: string;
  /** Where it comes from, e.g. 'Barbarian 3'. */
  source: string;
  summary?: string;
  /** Computed numbers shown as a stat row (save DC, attack bonus). */
  stats?: readonly { label: string; value: string }[];
  /** A small heading above the rows (e.g. 'World of Warcraft maneuvers'). */
  rowsTitle?: string;
  rows: readonly FeatureCardRow[];
  /** A closing note under the rows (e.g. that maneuvers aren't tracked). */
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
  /**
   * True when the locked subclass is an ordinary base-game one (the Evoker's
   * Draconic Sorcery): the subclass alone then does NOT mark the hero class —
   * the character also needs one of its specializations — and the subclass
   * keeps its base-game source tag.
   */
  sharedSubclass?: boolean;
  /** Heading of the always-prepared spell table on the sheet; absent reads '<subclass> Spells'. */
  spellTableTitle?: string;
  /** A one-line aside under the blurb (class step) and on the sheet panel, e.g. the usual starting level. */
  heroNote?: string;
  /** Class-step note for a variant without a fixed subclass ('Chosen as normal at Druid level 3'). */
  subclassNote?: string;
  /** What the base class calls its subclass, lower-case ('circle', 'oath'); absent reads 'subclass'. */
  subclassTerm?: string;
  /**
   * The base-class level the subclass is chosen at; absent reads 3. A Warlock
   * picks its patron at level 1, in the creation wizard's subclass picker.
   */
  subclassLevel?: number;
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
  /**
   * What the class step calls the guidance's `level1Spells` row; absent reads
   * 'Level 1 spells'. A wizard keeps them in a spellbook ('Spellbook').
   */
  level1SpellsLabel?: string;
  /** Recommended starting picks per specialization (wizard guidance). */
  guidance?: Readonly<Record<string, SpecializationGuidance>>;
  /** Suggested spells per specialization, by spell level (sheet panel). */
  suggestedSpells?: Readonly<Record<string, readonly SuggestedSpellLevel[]>>;
  /** A one-line flavour note under the suggested spells (every specialization). */
  suggestedSpellsNote?: string;
  /** Recommended invocations that are World of Warcraft additions (marked ✦; full text not yet published). */
  wowInvocations?: readonly string[];
  /** Recommended Battle Master maneuvers that are World of Warcraft additions (marked ✦). */
  wowManeuvers?: readonly string[];
  /**
   * The base-class level the recommended Fighting Style is chosen at; absent
   * reads 2 (Paladin, Ranger). A Fighter picks it at level 1.
   */
  fightingStyleLevel?: number;
  /**
   * WoW-only subclasses a variant can take (offered by the server), with their
   * always-prepared spells by base-class level — e.g. Oath of the Holy.
   */
  subclassSpells?: Readonly<Record<string, readonly SubclassSpellRow[]>>;
  /** WoW-only subclasses a variant can take that have no always-prepared spells (e.g. Swashbuckler). */
  wowSubclasses?: readonly string[];
  /**
   * Base spells from other class lists that this variant adds to its base
   * class's spell list (e.g. the WoW Priest's Blur and Levitate). Class spell
   * pickers offer them to this variant only; the base class is unchanged.
   */
  extraSpellList?: readonly string[];
  /** A one-line reminder shown in the class step and on the sheet panel. */
  renownNote?: string;
  /** A short lore list on the sheet panel (e.g. the WoW Monk's monastic orders of Pandaria). Text only. */
  lore?: { title: string; entries: readonly HeroFeature[] };
  /** True when the sheet panel shows the WoW druid beast forms. */
  beastForms?: boolean;
  /**
   * True when a Beast Master of this variant keeps a WoW pet (the WoW Hunter):
   * the sheet panel shows the Pet card with its family selector.
   */
  hunterPets?: boolean;
  /** Computed sheet cards for this character (e.g. the WoW Shaman's Totems and path cards). */
  featureCards?: (input: FeatureCardInput) => readonly FeatureCard[];
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

/**
 * The hero class a stored subclass represents (e.g. Ebon Blade → Death Knight), if
 * any. A shared base-game subclass (the Evoker's Draconic Sorcery) represents
 * nothing on its own.
 */
export function heroClassForSubclass(subclass: string | null | undefined): HeroClassOption | undefined {
  return subclass ? HERO_CLASSES.find(h => h.subclass === subclass && !h.sharedSubclass) : undefined;
}

/**
 * The hero class a character is; undefined for everyone else.
 * - Subclass-based hero classes: base class + the hero subclass.
 * - WoW variants without a fixed subclass (WoW Druid, WoW Paladin, Priest, Shaman, Warrior): base
 *   class + one of the variant's specializations + no hero subclass, or base class
 *   + one of the variant's WoW-only subclasses (Oath of the Holy, Swashbuckler,
 *   Path of the Elements, Shadow Domain). A druid, paladin, cleric, rogue, barbarian or fighter with neither is a
 *   plain base-game character.
 * - A hero class whose locked subclass is a shared base-game one (Evoker: Sorcerer +
 *   Draconic Sorcery): base class + that subclass + one of its specializations. A
 *   Draconic Sorcery sorcerer without one is a plain sorcerer.
 * Subclass-based hero classes are matched first, so a Demon Hunter ranger is never
 * read as the WoW Hunter.
 */
export function heroClassFor(
  pc: { clazz?: string | null; subclass?: string | null; specialization?: string | null } | null | undefined,
): HeroClassOption | undefined {
  const clazz = (pc?.clazz ?? '').toLowerCase();
  const bySubclass = heroClassForSubclass(pc?.subclass);
  if (bySubclass) return clazz === bySubclass.baseClass.toLowerCase() ? bySubclass : undefined;
  const spec = (pc?.specialization ?? '').toLowerCase();
  // A WoW-only subclass (Oath of the Holy, Swashbuckler) marks its variant even without a specialization.
  const byVariantSubclass = variantForSubclass(pc?.subclass);
  if (byVariantSubclass && byVariantSubclass.baseClass.toLowerCase() === clazz) return byVariantSubclass;
  if (!spec) return undefined;
  // The specialization must be one of the variant's own (a paladin with 'Frost' and no
  // Ebon Blade is not a WoW Paladin).
  const sub = (pc?.subclass ?? '').toLowerCase();
  return HERO_CLASSES.find(h => (!h.subclass || (!!h.sharedSubclass && h.subclass.toLowerCase() === sub))
    && h.baseClass.toLowerCase() === clazz
    && h.specializations.some(s => s.name.toLowerCase() === spec));
}

/** A variant's WoW-only subclasses: those with always-prepared spells, then the rest. */
export function wowOnlySubclasses(hero: HeroClassOption): readonly string[] {
  return [...Object.keys(hero.subclassSpells ?? {}), ...(hero.wowSubclasses ?? [])];
}

/** The variant that owns a WoW-only subclass (Oath of the Holy → WoW Paladin, Swashbuckler → WoW Rogue), case-insensitive. */
function variantForSubclass(subclass: string | null | undefined): HeroClassOption | undefined {
  const name = (subclass ?? '').toLowerCase();
  if (!name) return undefined;
  return HERO_CLASSES.find(h => wowOnlySubclasses(h).some(k => k.toLowerCase() === name));
}

/**
 * The content source of a subclass name when it comes from another book: the
 * WoW module (a hero subclass or a variant's WoW-only subclass) or Arcana
 * Unleashed (its eight subclasses); undefined for base-game ones.
 */
export function subclassSource(subclass: string | null | undefined): ContentSource | undefined {
  return (heroClassForSubclass(subclass) ?? variantForSubclass(subclass) ?? arcanaSubclass(subclass))?.source;
}

/** The subclass a specialization's guidance recommends (e.g. Guardian → Circle of the Moon). */
export function recommendedSubclassFor(
  hero: HeroClassOption | undefined, specialization: string | null | undefined,
): string | undefined {
  return specialization ? hero?.guidance?.[specialization]?.subclass.name : undefined;
}

/** How guidance text shows a recommended subclass: its label when it has one, else its name. */
export function subclassGuidanceName(guidance: SpecializationGuidance): string {
  return guidance.subclass.label ?? guidance.subclass.name;
}

/**
 * How a subclass picker option reads for this hero class: the guidance label of
 * the matching recommended subclass ('Evoker' → 'Evoker (school of evocation)'
 * for a WoW Mage), else the name unchanged. Display only — the stored value
 * stays the name.
 */
export function subclassOptionLabel(hero: HeroClassOption | undefined, name: string): string {
  const n = name.toLowerCase();
  const match = Object.values(hero?.guidance ?? {}).find(g => !!g.subclass.label && g.subclass.name.toLowerCase() === n);
  return match?.subclass.label ?? name;
}

/** The base-class level a variant's subclass is chosen at (3 unless the class says otherwise). */
export function subclassLevelOf(hero: HeroClassOption | undefined): number {
  return hero?.subclassLevel ?? 3;
}

/**
 * The class-step guidance label for the recommended subclass: 'Level 3 subclass',
 * or just the class's own term ('Patron') when it is picked at level 1 in the wizard.
 */
export function subclassGuidanceLabel(hero: HeroClassOption): string {
  if (subclassLevelOf(hero) === 1) {
    const term = hero.subclassTerm ?? 'subclass';
    return term.charAt(0).toUpperCase() + term.slice(1);
  }
  return `Level ${subclassLevelOf(hero)} subclass`;
}

/** Hover text for a ✦ World of Warcraft invocation. */
export const WOW_INVOCATION_NOTE = 'Full text TBD — World of Warcraft invocations update.';

/** True when a recommended invocation is a World of Warcraft addition (case-insensitive). */
export function isWowInvocation(hero: HeroClassOption | undefined, name: string): boolean {
  const n = name.toLowerCase();
  return !!hero?.wowInvocations?.some(i => i.toLowerCase() === n);
}

/** Hover text for a ✦ World of Warcraft maneuver. */
export const WOW_MANEUVER_NOTE = "Its text is on your sheet's Battle Master card once you take that subclass.";

/** True when a recommended maneuver is a World of Warcraft addition (case-insensitive). */
export function isWowManeuver(hero: HeroClassOption | undefined, name: string): boolean {
  const n = name.toLowerCase();
  return !!hero?.wowManeuvers?.some(m => m.toLowerCase() === n);
}

/** The base-class level a variant's recommended Fighting Style is chosen at (2 unless the class says otherwise). */
export function fightingStyleLevelOf(hero: HeroClassOption | undefined): number {
  return hero?.fightingStyleLevel ?? 2;
}

const INVOCATION_ROWS_CACHE =new WeakMap<InvocationGuidance, readonly InvocationRow[]>();

/**
 * A guidance's recommended invocations as labelled rows (level 1, level 2,
 * from level 5), skipping empty ones; empty when there are none. Cached per
 * guidance so template bindings see a stable array.
 */
export function invocationRows(guidance: SpecializationGuidance | null | undefined): readonly InvocationRow[] {
  const inv = guidance?.invocations;
  if (!inv) return [];
  let rows = INVOCATION_ROWS_CACHE.get(inv);
  if (!rows) {
    rows = [
      { label: 'Level 1 invocation', names: inv.level1 ?? [] },
      { label: 'Level 2 invocations', names: inv.level2 ?? [] },
      { label: 'From level 5, consider', names: inv.fromLevel5 ?? [] },
    ].filter(r => r.names.length > 0);
    INVOCATION_ROWS_CACHE.set(inv, rows);
  }
  return rows;
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
    list = [...(guidance.cantrips ?? []), ...(guidance.level1Spells ?? []), ...(guidance.extraPrepared ?? [])];
    RECOMMENDED_SPELLS_CACHE.set(cacheKey, list);
  }
  return list;
}

/**
 * True when a spell name is on a variant's added spell list (the WoW Priest's
 * Blur, Haste and others), case-insensitive; false for every other class.
 */
export function isExtraListSpell(hero: HeroClassOption | undefined, name: string): boolean {
  const n = name.toLowerCase();
  return !!hero?.extraSpellList?.some(s => s.toLowerCase() === n);
}

/** The Fighting Style(s) a specialization's guidance recommends (e.g. Protection → Interception, Protection). */
export function recommendedFightingStylesFor(
  hero: HeroClassOption | undefined, specialization: string | null | undefined,
): readonly string[] {
  return (specialization && hero?.guidance?.[specialization]?.fightingStyles) || NO_SPELLS;
}

const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'two', 3: 'three', 4: 'four' };

/** 'At least one of' / 'Any two of' / 'Include' (one weapon) — how the Weapon Mastery recommendation reads. */
export function weaponMasteryLead(guidance: SpecializationGuidance): string {
  if (guidance.weaponMastery?.length === 1) return 'Include';
  const n = guidance.weaponMasteryCount;
  return n && n > 1 ? `Any ${COUNT_WORDS[n] ?? n} of` : 'At least one of';
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
  /** What granted it: a bonus-spell source (e.g. 'Runic Smite'), 'All', or the specialization; '' when obvious. */
  grantedBy: string;
}

/**
 * The always-prepared spells of a variant's WoW-only subclass (Oath of the Holy)
 * at `level`, in table order; empty for any other subclass.
 */
export function subclassSpellsFor(
  hero: HeroClassOption | undefined, subclass: string | null | undefined, level: number,
): HeroSpellEntry[] {
  const name = (subclass ?? '').toLowerCase();
  const key = Object.keys(hero?.subclassSpells ?? {}).find(k => k.toLowerCase() === name);
  if (!hero || !key) return [];
  return hero.subclassSpells![key]
    .filter(row => level >= row.classLevel)
    .flatMap(row => row.spells.map(spell => ({ name: spell, classLevel: row.classLevel, grantedBy: '' })));
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
    for (const name of spellNames(row.all)) out.push({ name, classLevel: row.classLevel, grantedBy: 'All' });
    const own = specialization ? row.bySpecialization[specialization] : undefined;
    for (const name of spellNames(own)) out.push({ name, classLevel: row.classLevel, grantedBy: specialization! });
  }
  return out;
}

/** A spell-table cell as a list: one name, several, or none. */
export function spellNames(cell: string | readonly string[] | undefined): readonly string[] {
  if (!cell) return [];
  return typeof cell === 'string' ? [cell] : cell;
}
