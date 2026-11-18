import { PcSpell } from './pc';

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
  newSpells?: PcSpell[];
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
