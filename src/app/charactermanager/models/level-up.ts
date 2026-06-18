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
}

/** Player choices sent when committing a level-up (all optional). At an ASI level, exactly
 *  one of abilityIncreases / feat is sent. */
export interface LevelUpChoices {
  subclass?: string;
  abilityIncreases?: { [ability: string]: number };
  feat?: string;
}
