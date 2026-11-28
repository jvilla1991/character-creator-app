import { PcSpell } from './pc';
import { SubclassChoices } from './arcana-subclasses';

/**
 * What advancing one level grants, computed server-side and rendered by the SPA.
 *
 * The level-up rules engine is server-authoritative (manager-service LevelUpService);
 * the frontend never computes these values from progression tables — it only displays
 * this preview and then commits. Shape mirrors the backend `LevelUpPreview` record.
 */
export interface LevelUpPreview {
  currentLevel: number;
  newLevel: number;
  hitDie: number;
  conModifier: number;
  hpGained: number;
  newHpMax: number;
  currentProfBonus: number;
  newProfBonus: number;
  // Spell slots before/after the level, keyed by spell level (1-9) → max slots.
  // Empty for non-casters. Server-computed (Phase 2); the SPA only renders them.
  currentSpellSlots: { [spellLevel: number]: number };
  newSpellSlots: { [spellLevel: number]: number };
  // Phase 3: whether a subclass choice is due at the new level, and the selectable names.
  // subclassOptions is empty until catalog content is authored server-side, so the SPA
  // shows the picker only when there is something to choose.
  subclassDue: boolean;
  subclassOptions: string[];
  // Phase 4: whether an Ability Score Improvement is due at the new level (4/8/12/16/19,
  // plus Fighter 6/14 and Rogue 10). The SPA builds the +2/+1+1 allocator from pc.stats.
  asiDue: boolean;
  // Feats: selectable General feat names (the ASI alternative). Server-authoritative;
  // non-empty only at an ASI level. Descriptions are looked up locally for display.
  featOptions: string[];
  // Class features automatically gained at the new level (name + server-owned description).
  // Empty when the class/level has no seeded features. Read-only — no choice involved.
  featuresGained: { name: string; desc: string }[];
  // Level-2 Fighting Style feature (Paladin 2, Ranger 2): whether the choice is due and the
  // selectable style names (sorted). Every paladin also gets 'Blessed Warrior', every ranger
  // 'Druidic Warrior', and a Demon Hunter ranger 'Void Warrior'. Optional —
  // the player may skip it. Descriptions are looked up locally (FEAT_DESCRIPTIONS).
  fightingStyleDue: boolean;
  fightingStyleOptions: string[];
  // Cantrips known before/after the level (caster classes; 0 for non-casters). Informational.
  currentCantripsKnown: number;
  newCantripsKnown: number;
  // Prepared/known spells before/after the level (caster classes; 0 for non-casters). The
  // level-up delta is how many new spells the player may add.
  currentSpellsKnown: number;
  newSpellsKnown: number;
  // WoW Druid: the subclass the character's specialization recommends (e.g. Guardian →
  // 'Circle of the Moon'), when the server sends it. Optional — the SPA derives the same
  // value from the hero-class table when it is absent. A highlight only, never enforced.
  recommendedSubclass?: string | null;
  // WoW variants: the level-2 Fighting Style(s) the specialization recommends (Holy →
  // Blessed Warrior; Protection → Interception, Protection; Retribution → Great Weapon
  // Fighting). Optional — the SPA derives the same list from the variant table when absent.
  recommendedFightingStyles?: string[];
  /**
   * Spells a class feature always keeps prepared, gained at this level (a
   * Paladin's Find Steed at 5). The modal shows them and sends the full spell
   * along in `newSpells`; the server marks them `alwaysPrepared`, outside the
   * pick count. A character that passed such a level before the grant existed
   * is owed the ones it missed, so they are listed too. Absent from a server
   * that predates the field.
   */
  alwaysPreparedSpells?: { name: string; grantedBy: string }[];
  /**
   * When a subclass choice is due: the same list for each option that changes it
   * (an oath's 3rd-level spells), keyed by option name. The modal uses the entry
   * for the subclass the player picks; an option without an entry adds nothing.
   */
  alwaysPreparedSpellsBySubclass?: { [subclass: string]: { name: string; grantedBy: string }[] };
  /**
   * When a feat choice is due: for each feat on offer that gives spells of its
   * own (Warlike Familiar's Battle Familiar, a School Adept's rows), the ones the
   * character would be owed on top of `alwaysPreparedSpells`, keyed by feat name.
   * The modal adds the entry for the feat the player picks. The spells of feats
   * the character already has are part of `alwaysPreparedSpells` itself.
   */
  alwaysPreparedSpellsByFeat?: { [feat: string]: { name: string; grantedBy: string }[] };
  /**
   * When a subclass choice is due: for each option that brings Spellcasting of
   * its own (a Monk's Warrior of the Mystic Arts), the new level's slots,
   * cantrips known and prepared spells with that option chosen, keyed by option
   * name. The modal uses the entry for the subclass the player picks in place
   * of the three fields of the same names above. Absent or empty otherwise.
   */
  spellcastingBySubclass?: { [subclass: string]: SubclassSpellcasting };
}

/** A level-up preview's spellcasting numbers with one subclass option chosen. */
export interface SubclassSpellcasting {
  newSpellSlots: { [spellLevel: number]: number };
  newCantripsKnown: number;
  newSpellsKnown: number;
}

/**
 * The level-up preview as it reads with a subclass picked: when the server
 * sent that option's spellcasting (`spellcastingBySubclass`: a Monk picking the
 * Warrior of the Mystic Arts), its slots, cantrips known and prepared spells
 * replace the preview's own. The preview itself when the option changes nothing.
 */
export function previewWithSubclass(preview: LevelUpPreview, subclass: string | null | undefined): LevelUpPreview {
  const casting = subclass ? preview.spellcastingBySubclass?.[subclass] : undefined;
  return casting ? { ...preview, ...casting } : preview;
}

/**
 * How this level's hit points are determined. Mirrors the backend `HpMode` enum — the JSON value
 * must be the enum name ('AVERAGE' | 'ROLL'). In ROLL mode the *server* rolls the hit die; the
 * client only chooses the mode, never the result. 'AVERAGE' is the default everywhere.
 */
export type HpMode = 'AVERAGE' | 'ROLL';

/** Player choices sent when committing a level-up (all optional). At an ASI level, exactly
 *  one of abilityIncreases / feat is sent. hpMode is only sent when the player picks 'ROLL'
 *  (omitting it lets the server default to 'AVERAGE'). */
export interface LevelUpChoices {
  subclass?: string;
  abilityIncreases?: { [ability: string]: number };
  feat?: string;
  /**
   * Spells learned this level. A spell picked for the feat taken in the same
   * request (Arcane Warrior's cantrips, Magic Connoisseur's and Boon of Magic
   * School Mastery's spells) carries that feat's name as its `grantedBy`: that is
   * how the server tells it from the class's own picks. A spell picked for a
   * subclass feature carries the feature's name the same way ('Student of
   * Arcana', 'Magical Mastery', 'Arcane Archer Lore').
   */
  newSpells?: PcSpell[];
  /**
   * What the player chose for the subclass at this level (an Arcana Domain
   * cleric's skill, an Arcane Archer's replacement skills): the keys present
   * replace the stored ones. Checked against the character as it will be at the
   * new level, with the subclass chosen in this same request.
   */
  subclassChoices?: SubclassChoices;
  /**
   * Subclass picks being swapped out, by spell name: at most one per feature
   * (Student of Arcana, Magical Mastery), each with its replacement in
   * `newSpells` under the same `grantedBy`.
   */
  forgetSpells?: string[];
  hpMode?: HpMode;
  /**
   * The level-2 Fighting Style, only when `fightingStyleDue`. 'Blessed Warrior', 'Druidic
   * Warrior' and 'Void Warrior' must come with exactly two Cleric / Druid / Warlock cantrips
   * in `newSpells` (on top of any class cantrip allowance).
   */
  fightingStyle?: string;
  /** Hero classes that respec on level-up only: the new specialization, sent only when it changes. */
  specialization?: string;
}
