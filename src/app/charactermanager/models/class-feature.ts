/**
 * One row of a class's level 2–20 feature roadmap, as served by the backend's
 * class-feature catalog (the same catalog level-up grants from). `subclass` is
 * true when the character's subclass grants the feature rather than the class.
 */
export interface ClassFeatureProgressionEntry {
  level: number;
  name: string;
  desc: string;
  subclass: boolean;
}
