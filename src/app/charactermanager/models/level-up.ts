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
}
