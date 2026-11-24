import { PC } from './pc';
import {
  ARCANE_UNDERTAKER, ARCANE_WARRIOR, FAMILIAR_FRIEND, MAGIC_CONNOISSEUR, highestSpellSlotLevel, masteredSchool,
} from './arcana-feats';
import { featNamesOn } from './character-feats';
import { spellKey } from './spell-names';

/**
 * Spells a class feature always keeps prepared (2024 PHB). They are saved on the
 * character like any other spell, marked `alwaysPrepared` with the feature as
 * `grantedBy`, so they can be cast from the spellbook and never count against
 * the prepared-spell limit.
 *
 * Level 1 is the create wizard's: it adds these on top of the player's picks.
 * From level 2 the server owns the list (its ClassSpellGrants table: a Paladin's
 * Divine Smite at 2 and Find Steed at 5, a Warlock's Contact Other Plane at 9, a
 * Bard's Power Words at 20, and the spell list of every base-game subclass —
 * Oath of Devotion Spells, Life Domain Spells, ...) and names the ones a
 * character is owed in the level-up preview. It lists the two level-1 grants
 * below as well, so a Ranger or Druid made before the wizard added them picks
 * them up at the next level-up.
 *
 * Species spells and the World of Warcraft hero-class and oath tables are not
 * here: those are shown by their own sheet panels from the character's species,
 * subclass, specialization and level.
 */
export interface SpellGrant {
  /** The spell's name, as the spell data spells it. */
  name: string;
  /** The feature that grants it, shown beside the spell ('Favored Enemy'). */
  grantedBy: string;
}

/** Class (lower-case) to the spells its level-1 features always keep prepared. */
export const LEVEL1_CLASS_SPELL_GRANTS: Readonly<Record<string, readonly SpellGrant[]>> = {
  druid: [{ name: 'Speak with Animals', grantedBy: 'Druidic' }],
  ranger: [{ name: "Hunter's Mark", grantedBy: 'Favored Enemy' }],
};

const NO_GRANTS: readonly SpellGrant[] = [];

/**
 * The always-prepared spells a new character of this class starts with; empty
 * for most classes. A World of Warcraft class stored under the same base class
 * (WoW Druid, Hunter, Demon Hunter) keeps the feature, so it gets the same spells.
 */
export function level1ClassSpellGrants(clazz: string | null | undefined): readonly SpellGrant[] {
  return LEVEL1_CLASS_SPELL_GRANTS[(clazz ?? '').trim().toLowerCase()] ?? NO_GRANTS;
}

/** What the DM's "Grant spells" form records as the source of an always-prepared spell. */
export const DM_GRANT_SOURCE = 'DM grant';

// ── Magic Initiate (Origin feat) ─────────────────────────────────────────────

/**
 * A Magic Initiate Origin feat (2024 PHB): two cantrips and one level-1 spell
 * from one class's spell list. The spell is always prepared. A character gets
 * the feat from a background (Acolyte, Guide, Sage, ...) or a Human's Versatile
 * trait, and picks its spells in the create wizard's spells step.
 */
export interface MagicInitiateFeat {
  /** The feat name as stored on the character ('Magic Initiate (Cleric)'). */
  feat: string;
  /** The class whose spell list it draws from, lower-case ('cleric'). */
  spellList: string;
  /** The class name for display ('Cleric'). */
  className: string;
}

export const MAGIC_INITIATE_CANTRIPS = 2;
export const MAGIC_INITIATE_SPELLS = 1;

const MAGIC_INITIATE_NAME = /^Magic Initiate \((Cleric|Druid|Wizard)\)$/;

/** The Magic Initiate feat behind a feat name; undefined for every other feat. */
export function magicInitiateFeat(feat: string | null | undefined): MagicInitiateFeat | undefined {
  const match = MAGIC_INITIATE_NAME.exec((feat ?? '').trim());
  return match ? { feat: match[0], spellList: match[1].toLowerCase(), className: match[1] } : undefined;
}

/** The Magic Initiate feats among a character's feat names, in order. */
export function magicInitiateFeats(feats: readonly string[]): MagicInitiateFeat[] {
  return feats.flatMap(name => {
    const feat = magicInitiateFeat(name);
    return feat ? [feat] : [];
  });
}

// ── Spells a feat names (Arcana Unleashed) ───────────────────────────────────
// The client copy of the server's FeatSpellGrants. The create wizard saves an
// Origin feat's spells on the new character; from then on the server names the
// ones a character is owed in the level-up preview, and these tables only back
// demo mode. Every such spell is saved with the feat as `grantedBy`, a leveled
// one always prepared.

/** Feat → the spells it names (a cantrip is simply known). */
export const FEAT_SPELLS: Readonly<Record<string, readonly string[]>> = {
  'Arcane Artist': ['Minor Illusion'],
  'Arcane Eloquence': ['Vicious Mockery'],
  'Arcane Infiltrator': ['Friends'],
  'Arcane Omens': ['Guidance'],
  'Arcane Overload': ['Fire Bolt'],
  'Arcane Safeguard': ['Resistance'],
  [FAMILIAR_FRIEND]: ['Find Familiar'],
  'Warlike Familiar': ['Battle Familiar'],
};

/**
 * School Adept feat → its spells for spell slot levels 1, 2, 3, 4 and 5. A
 * character has the rows for its highest slot level and lower, so a new row
 * arrives with each new slot level.
 */
export const SCHOOL_ADEPT_SPELLS: Readonly<Record<string, readonly string[]>> = {
  'Abjuration Adept': ['Shield', 'Lesser Restoration', 'Protection from Energy', 'Banishment', 'Mass Cure Wounds'],
  'Conjuration Adept': ['Entangle', 'Misty Step', 'Conjure Animals', 'Dimension Door', 'Conjure Elemental'],
  'Divination Adept': ['Detect Evil and Good', 'Mind Spike', 'Clairvoyance', 'Divination', 'Scrying'],
  'Enchantment Adept': ['Dissonant Whispers', 'Enthrall', 'Hold Person', 'Dominate Beast', 'Modify Memory'],
  'Evocation Adept': ['Chromatic Orb', 'Shatter', 'Fireball', 'Vitriolic Sphere', 'Wall of Force'],
  'Illusion Adept': ['Silent Image', 'Phantasmal Force', 'Major Image', 'Hallucinatory Terrain', 'Seeming'],
  'Necromancy Adept': ['Inflict Wounds', 'Ray of Enfeeblement', 'Vampiric Touch', 'Blight', 'Raise Dead'],
  'Transmutation Adept': ['Jump', 'Spider Climb', 'Slow', 'Polymorph', 'Animate Objects'],
};

/** A table's own spelling of a feat name (case and spaces aside); undefined when it is not in it. */
function tableKey(table: Readonly<Record<string, unknown>>, feat: string | null | undefined): string | undefined {
  const name = (feat ?? '').trim().toLowerCase();
  return name ? Object.keys(table).find(key => key.toLowerCase() === name) : undefined;
}

/**
 * The spells one feat gives: the spells it names, or a School Adept's rows up to
 * `highestSlotLevel` (the character's highest spell slot level; 0 without
 * slots). Empty for every other feat.
 */
export function featSpellGrants(feat: string | null | undefined, highestSlotLevel = 0): SpellGrant[] {
  const grants: SpellGrant[] = [];
  const named = tableKey(FEAT_SPELLS, feat);
  if (named) grants.push(...FEAT_SPELLS[named].map(name => ({ name, grantedBy: named })));
  const adept = tableKey(SCHOOL_ADEPT_SPELLS, feat);
  if (adept) {
    const rows = SCHOOL_ADEPT_SPELLS[adept].slice(0, Math.max(0, highestSlotLevel));
    grants.push(...rows.map(name => ({ name, grantedBy: adept })));
  }
  return grants;
}

/** Every spell a character's feats give it, in the order the feats are held, each spell once. */
export function featSpellGrantsThrough(feats: readonly string[], highestSlotLevel = 0): SpellGrant[] {
  const byName = new Map<string, SpellGrant>();
  for (const feat of feats) {
    for (const grant of featSpellGrants(feat, highestSlotLevel)) {
      if (!byName.has(grant.name.toLowerCase())) byName.set(grant.name.toLowerCase(), grant);
    }
  }
  return [...byName.values()];
}

type FeatSpellOwner = Pick<PC, 'clazz' | 'feat' | 'features' | 'spells'>;

/** True when the character already has a feat's spell: marked always prepared, or a cantrip it knows. */
function holdsFeatSpell(pc: FeatSpellOwner, grant: SpellGrant): boolean {
  const key = spellKey(grant.name);
  return (pc.spells ?? []).some(s => spellKey(s.name) === key && (!!s.alwaysPrepared || s.lvl === 0));
}

/**
 * The feat spells a character should have at `level` and does not have yet —
 * the feat part of the server's level-up preview (`alwaysPreparedSpells`), for
 * demo mode.
 */
export function featSpellsOwed(pc: FeatSpellOwner, level: number): SpellGrant[] {
  return featSpellGrantsThrough(featNamesOn(pc), highestSpellSlotLevel(pc.clazz, level))
    .filter(grant => !holdsFeatSpell(pc, grant));
}

/**
 * For each feat on offer that gives spells of its own, the ones the character
 * would be owed at `level` on top of {@link featSpellsOwed} — the server's
 * `alwaysPreparedSpellsByFeat`, for demo mode. Feats that add nothing are left out.
 */
export function featSpellsOwedByFeat(
  pc: FeatSpellOwner, featOptions: readonly string[], level: number,
): { [feat: string]: SpellGrant[] } {
  const byFeat: { [feat: string]: SpellGrant[] } = {};
  const base = featSpellsOwed(pc, level).map(g => spellKey(g.name));
  const highest = highestSpellSlotLevel(pc.clazz, level);
  for (const option of featOptions) {
    const owed = featSpellGrants(option, highest)
      .filter(grant => !holdsFeatSpell(pc, grant) && !base.includes(spellKey(grant.name)));
    if (owed.length) byFeat[option] = owed;
  }
  return byFeat;
}

// ── Spells the player picks for a feat ───────────────────────────────────────

/**
 * One group of spells the player picks for a feat, in the spell picker: Magic
 * Initiate's two cantrips and a level 1 spell, Arcane Undertaker's Necromancy
 * cantrip, Arcane Warrior's two Wizard cantrips, Magic Connoisseur's level 1 and
 * level 2 spell, Boon of Magic School Mastery's two spells of one school.
 */
export interface FeatSpellChoice {
  /** The feat, as stored on the character ('Boon of Magic School Mastery (Evocation)'). */
  feat: string;
  /** Tells the feat's groups apart ('cantrips', 'level1', 'rote', 'signature'). */
  key: string;
  /** Heading above the picker. */
  label: string;
  /** One line under the heading saying what to pick. */
  hint: string;
  /** Class spell lists to pick from, lower-case; empty means any spell. */
  spellLists: readonly string[];
  /** The only school allowed, as the spell data spells it ('necromancy'); absent means any. */
  school?: string;
  /** Lowest and highest spell level allowed (0 is a cantrip). */
  minLevel: number;
  maxLevel: number;
  /** How many cantrips, and how many leveled spells, to pick. */
  cantrips: number;
  spells: number;
}

/** True when a spell's level and school fit a choice, whichever class list it is on. */
export function featChoiceFits(choice: FeatSpellChoice, spell: { level: number; school: string }): boolean {
  if (spell.level < choice.minLevel || spell.level > choice.maxLevel) return false;
  if (spell.level === 0 ? choice.cantrips === 0 : choice.spells === 0) return false;
  return !choice.school || (spell.school ?? '').toLowerCase() === choice.school;
}

/** True when a spell may be picked for a choice: it fits, and it is on one of the choice's class lists. */
export function featChoiceAllows(
  choice: FeatSpellChoice, spell: { level: number; school: string; classes: readonly string[] },
): boolean {
  return featChoiceFits(choice, spell)
    && (!choice.spellLists.length || choice.spellLists.some(list => (spell.classes ?? []).includes(list)));
}

/** True when the picks made for a choice are exactly what it asks for. */
export function featChoiceSatisfied(choice: FeatSpellChoice, picks: readonly { level: number }[]): boolean {
  return picks.filter(s => s.level === 0).length === choice.cantrips
    && picks.filter(s => s.level > 0).length === choice.spells;
}

/**
 * What an Origin feat lets a new character pick, in the create wizard's spells
 * step: Magic Initiate's two cantrips and one always-prepared level 1 spell,
 * Arcane Undertaker's one Cleric or Wizard cantrip of the Necromancy school.
 * Undefined for every other feat.
 */
export function originFeatSpellChoice(feat: string | null | undefined): FeatSpellChoice | undefined {
  const initiate = magicInitiateFeat(feat);
  if (initiate) {
    return {
      feat: initiate.feat, key: 'spells', label: initiate.feat,
      hint: `Pick two ${initiate.className} cantrips and one level 1 ${initiate.className} spell. `
        + 'The spell is always prepared and does not count against your prepared spells.',
      spellLists: [initiate.spellList], minLevel: 0, maxLevel: 1,
      cantrips: MAGIC_INITIATE_CANTRIPS, spells: MAGIC_INITIATE_SPELLS,
    };
  }
  if ((feat ?? '').trim().toLowerCase() === ARCANE_UNDERTAKER.toLowerCase()) {
    return {
      feat: ARCANE_UNDERTAKER, key: 'cantrip', label: ARCANE_UNDERTAKER,
      hint: 'Pick one Cleric or Wizard cantrip of the Necromancy school.',
      spellLists: ['cleric', 'wizard'], school: 'necromancy', minLevel: 0, maxLevel: 0, cantrips: 1, spells: 0,
    };
  }
  return undefined;
}

/** Highest spell level Boon of Magic School Mastery's Signature Arcanum may have. */
export const SIGNATURE_ARCANUM_MAX_LEVEL = 7;

/**
 * What a feat taken at a level-up lets the player pick; empty for a feat
 * without picks. The server checks the number, spell level and school of the
 * picks (its FeatSpellGrants.pickRule); the class lists are this table's alone.
 *
 * @param clazz the character's class, whose list Boon of Magic School Mastery's level 1 spell comes from
 * @param magicInitiateList the class list of the character's Magic Initiate feat ('cleric'), for Magic Connoisseur
 */
export function levelUpFeatSpellChoices(
  feat: string | null | undefined, clazz: string | null | undefined, magicInitiateList = '',
): FeatSpellChoice[] {
  const name = (feat ?? '').trim();
  const lower = name.toLowerCase();
  if (lower === ARCANE_WARRIOR.toLowerCase()) {
    return [{
      feat: ARCANE_WARRIOR, key: 'cantrips', label: 'Arcane Warrior Cantrips',
      hint: 'Pick two Wizard cantrips. Mage Hand and Ray of Frost are a good pair.',
      spellLists: ['wizard'], minLevel: 0, maxLevel: 0, cantrips: 2, spells: 0,
    }];
  }
  if (lower === MAGIC_CONNOISSEUR.toLowerCase()) {
    if (!magicInitiateList) return [];
    const list = magicInitiateList.toLowerCase();
    const className = list.charAt(0).toUpperCase() + list.slice(1);
    const pick = (level: number): FeatSpellChoice => ({
      feat: MAGIC_CONNOISSEUR, key: `level${level}`, label: `Magic Connoisseur, Level ${level} Spell`,
      hint: `Pick one level ${level} ${className} spell. It is always prepared, and you can cast it once per Long Rest without a spell slot.`,
      spellLists: [list], minLevel: level, maxLevel: level, cantrips: 0, spells: 1,
    });
    return [pick(1), pick(2)];
  }
  const school = masteredSchool(name);
  if (school) {
    const own = (clazz ?? '').trim().toLowerCase();
    const common = { feat: name, school: school.toLowerCase(), cantrips: 0, spells: 1 };
    return [
      {
        ...common, key: 'rote', label: 'Rote Casting',
        hint: `Pick one level 1 ${school} spell from your class's spell list. It is always prepared, and you can cast it without a spell slot.`,
        spellLists: own ? [own] : [], minLevel: 1, maxLevel: 1,
      },
      {
        ...common, key: 'signature', label: 'Signature Arcanum',
        hint: `Pick one ${school} spell of level ${SIGNATURE_ARCANUM_MAX_LEVEL} or lower. It is always prepared, and you can cast it once per Long Rest without a spell slot.`,
        spellLists: [], minLevel: 1, maxLevel: SIGNATURE_ARCANUM_MAX_LEVEL,
      },
    ];
  }
  return [];
}

/** True when a feat taken at a level-up comes with spells to pick. */
export function hasLevelUpFeatSpellChoices(feat: string | null | undefined): boolean {
  const lower = (feat ?? '').trim().toLowerCase();
  return lower === ARCANE_WARRIOR.toLowerCase() || lower === MAGIC_CONNOISSEUR.toLowerCase() || !!masteredSchool(feat);
}
