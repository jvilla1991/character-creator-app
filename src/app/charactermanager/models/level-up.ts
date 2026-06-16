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
}
