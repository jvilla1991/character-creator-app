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
