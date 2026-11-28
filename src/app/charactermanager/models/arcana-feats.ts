import { classSlotTable } from '../utils/spell-slots';

/**
 * The feats of the Arcana Unleashed book: ten Origin feats (each the feat of one
 * of the book's backgrounds), fifteen General feats (level 4+), one Fighting
 * Style feat and three Epic Boons (level 19+).
 *
 * As with the World of Warcraft feats (models/wow-feats), the server decides who
 * is offered a feat at a level-up and validates the choice; this table lets the
 * SPA tag the feats, show what each one needs, and mirror the server's gating in
 * demo mode. Their descriptions live with the rest in FEAT_DESCRIPTIONS, their
 * spells in models/granted-spells and their counters in utils/class-resources.
 */
export type ArcanaFeatCategory = 'Origin' | 'General' | 'Fighting Style' | 'Epic Boon';

/** What a feat needs besides its level (and, for Arcane Warrior, the Fighting Style feature). */
export type ArcanaFeatRequirement = 'spellcasting' | 'familiar-friend' | 'magic-initiate';

export interface ArcanaFeat {
  name: string;
  category: ArcanaFeatCategory;
  requires?: ArcanaFeatRequirement;
}

/** The Origin feat the four familiar feats build on. */
export const FAMILIAR_FRIEND = 'Familiar Friend';
/** The Fighting Style feat that teaches two Wizard cantrips. */
export const ARCANE_WARRIOR = 'Arcane Warrior';
/** The Origin feat that teaches one Necromancy cantrip of the player's choice. */
export const ARCANE_UNDERTAKER = 'Arcane Undertaker';
/** The General feat that adds two spells from the Magic Initiate feat's class list. */
export const MAGIC_CONNOISSEUR = 'Magic Connoisseur';
/** The repeatable Epic Boon; offered and stored per school: 'Boon of Magic School Mastery (Evocation)'. */
export const SCHOOL_MASTERY = 'Boon of Magic School Mastery';

/** The eight schools of magic, in the book's order. */
export const SCHOOLS_OF_MAGIC: readonly string[] = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
];

const origin = (name: string): ArcanaFeat => ({ name, category: 'Origin' });
const general = (name: string, requires?: ArcanaFeatRequirement): ArcanaFeat =>
  ({ name, category: 'General', ...(requires ? { requires } : {}) });
const boon = (name: string, requires?: ArcanaFeatRequirement): ArcanaFeat =>
  ({ name, category: 'Epic Boon', ...(requires ? { requires } : {}) });

/** Every Arcana Unleashed feat, by category and then by name: the book's order. */
export const ARCANA_FEATS: readonly ArcanaFeat[] = [
  origin('Arcane Artist'), origin('Arcane Eloquence'), origin('Arcane Infiltrator'), origin('Arcane Omens'),
  origin('Arcane Overload'), origin('Arcane Safeguard'), origin(ARCANE_UNDERTAKER), origin(FAMILIAR_FRIEND),
  origin('Portal Jumper'), origin('Transmuted Anatomy'),
  general('Abjuration Adept', 'spellcasting'), general('Conjuration Adept', 'spellcasting'),
  general('Divination Adept', 'spellcasting'), general('Elemental Familiar', 'familiar-friend'),
  general('Enchantment Adept', 'spellcasting'), general('Evocation Adept', 'spellcasting'),
  general('Illusion Adept', 'spellcasting'), general(MAGIC_CONNOISSEUR, 'magic-initiate'),
  general('Necromancy Adept', 'spellcasting'), general('Otherworldly Familiar', 'familiar-friend'),
  general('Soothing Familiar', 'familiar-friend'), general('Spell Resistant'),
  general('Spell Subterfuge', 'spellcasting'), general('Transmutation Adept', 'spellcasting'),
  general('Warlike Familiar', 'familiar-friend'),
  { name: ARCANE_WARRIOR, category: 'Fighting Style' },
  boon('Boon of Erupting Spellpower', 'spellcasting'), boon(SCHOOL_MASTERY, 'spellcasting'),
  boon('Boon of the Iron Mind'),
];

/** Hover text for a ✦ Arcana Unleashed feat. */
export const ARCANA_FEAT_NOTE = 'Arcana Unleashed feat';

/** A requirement as shown to people, after "Prerequisite:". */
export const ARCANA_REQUIREMENT_TEXT: Readonly<Record<ArcanaFeatRequirement, string>> = {
  'spellcasting': 'Spellcasting or Pact Magic feature',
  'familiar-friend': 'Familiar Friend feat',
  'magic-initiate': 'Magic Initiate feat',
};

const lower = (name: string | null | undefined): string => (name ?? '').trim().toLowerCase();

/** 'Boon of Magic School Mastery (Evocation)' — the name the boon is offered and stored under for a school. */
export function schoolMasteryFeat(school: string): string {
  return `${SCHOOL_MASTERY} (${school})`;
}

/** The school behind a 'Boon of Magic School Mastery (…)' name; undefined for anything else. */
export function masteredSchool(feat: string | null | undefined): string | undefined {
  const name = lower(feat);
  return SCHOOLS_OF_MAGIC.find(school => lower(schoolMasteryFeat(school)) === name);
}

/**
 * A feat name without its per-character part: the school of a Boon of Magic
 * School Mastery is dropped, every other name comes back trimmed. Descriptions
 * and prerequisites are looked up by this name.
 */
export function baseFeatName(feat: string | null | undefined): string {
  return masteredSchool(feat) ? SCHOOL_MASTERY : (feat ?? '').trim();
}

/** The table entry behind a feat name (case-insensitive; a school mastery by its base name). */
export function arcanaFeat(name: string | null | undefined): ArcanaFeat | undefined {
  const key = lower(baseFeatName(name));
  return key ? ARCANA_FEATS.find(f => lower(f.name) === key) : undefined;
}

/** True when a feat name is an Arcana Unleashed feat (case-insensitive). */
export function isArcanaFeat(name: string | null | undefined): boolean {
  return !!arcanaFeat(name);
}

/** What an Arcana Unleashed feat needs beyond its level ('Familiar Friend feat'); undefined when nothing. */
export function arcanaFeatPrerequisite(name: string | null | undefined): string | undefined {
  const requires = arcanaFeat(name)?.requires;
  return requires ? ARCANA_REQUIREMENT_TEXT[requires] : undefined;
}

// ── Who may take which feat (demo mirror of the server's FeatCatalog) ─────────

/**
 * True when a character of this class has the Spellcasting or Pact Magic
 * feature at this level: the full casters, the Warlock, and the half casters
 * Paladin and Ranger from level 1 — every class with a slot table — and a Monk
 * of the Warrior of the Mystic Arts from Monk level 3, whose subclass brings
 * the feature. Eldritch Knight and Arcane Trickster have no slot table here and
 * do not count. Mirrors the server's ClassProgression.hasSpellcastingOrPactMagic.
 */
export function hasSpellcastingOrPactMagic(
  clazz: string | null | undefined, level: number, subclass?: string | null,
): boolean {
  return Object.keys(classSlotTable(clazz ?? undefined, level, subclass)).length > 0;
}

/** The highest spell slot level the table gives at this level (a Warlock's pact slot level); 0 for none. */
export function highestSpellSlotLevel(
  clazz: string | null | undefined, level: number, subclass?: string | null,
): number {
  return Object.keys(classSlotTable(clazz ?? undefined, level, subclass))
    .reduce((max, k) => Math.max(max, Number(k)), 0);
}

/** The character an Arcana Unleashed feat is offered to. */
export interface ArcanaFeatCandidate {
  clazz: string | null | undefined;
  /** The subclass, for the one that brings Spellcasting of its own (Warrior of the Mystic Arts). */
  subclass?: string | null;
  /** The level being reached. */
  newLevel: number;
  /** Names of the feats already on the character (see models/character-feats). */
  feats: readonly string[];
}

const FIGHTING_STYLE_CLASSES = ['fighter', 'paladin', 'ranger'];

function meets(requires: ArcanaFeatRequirement | undefined, c: ArcanaFeatCandidate, held: readonly string[]): boolean {
  switch (requires) {
    case 'spellcasting': return hasSpellcastingOrPactMagic(c.clazz, c.newLevel, c.subclass);
    case 'familiar-friend': return held.includes(lower(FAMILIAR_FRIEND));
    case 'magic-initiate': return held.some(f => f.startsWith('magic initiate'));
    default: return true;
  }
}

/**
 * The Arcana Unleashed feats a character may take at an Ability Score
 * Improvement level, unsorted — the server's rules, for demo mode: General
 * feats from level 4, Arcane Warrior for a class with the Fighting Style
 * feature, Epic Boons from level 19; less every feat whose prerequisite is not
 * met and every feat already taken. Boon of Magic School Mastery is listed once
 * per school not yet taken.
 */
export function arcanaFeatOptions(candidate: ArcanaFeatCandidate): string[] {
  const held = candidate.feats.map(lower);
  const clazz = lower(candidate.clazz);
  const options: string[] = [];
  for (const feat of ARCANA_FEATS) {
    if (feat.category === 'Origin') continue;
    if (feat.category === 'General' && candidate.newLevel < 4) continue;
    if (feat.category === 'Fighting Style' && !FIGHTING_STYLE_CLASSES.includes(clazz)) continue;
    if (feat.category === 'Epic Boon' && candidate.newLevel < 19) continue;
    if (!meets(feat.requires, candidate, held)) continue;
    const names = feat.name === SCHOOL_MASTERY ? SCHOOLS_OF_MAGIC.map(schoolMasteryFeat) : [feat.name];
    options.push(...names.filter(name => !held.includes(lower(name))));
  }
  return options;
}
