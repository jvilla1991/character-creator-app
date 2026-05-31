/** Generic reference returned in D&D API list items and nested objects */
export interface DndResource {
  index: string;
  name: string;
  url: string;
}

/** Wrapper shape for all D&D API list endpoints */
export interface DndListResponse<T> {
  count: number;
  results: T[];
}

/** /api/2024/species/{index} */
export interface DndSpecies {
  index: string;
  name: string;
  size: string;
  speed: number;
  traits: DndResource[];
  subspecies: DndResource[];
}

/** Proficiency choice block inside a class or background */
export interface ProficiencyChoice {
  desc: string;
  choose: number;
  type: string;
}

/** /api/2024/classes/{index} */
export interface DndClass {
  index: string;
  name: string;
  hit_die: number;
  saving_throws: DndResource[];
  proficiency_choices: ProficiencyChoice[];
  proficiencies: DndResource[];
  subclasses: DndResource[];
}

/** /api/2024/backgrounds/{index} */
export interface DndBackground {
  index: string;
  name: string;
  /** The three ability scores this background can boost (+2/+1 split) */
  ability_scores: DndResource[];
  proficiencies: DndResource[];
  feat?: DndResource;
  /** Source book — Player's Handbook, Heroes of Faerun, Forge of the Artificer */
  source?: string;
}

/** Backgrounds grouped by source book for display in the wizard */
export interface BackgroundGroup {
  source: string;
  backgrounds: string[];
}

// ── Spell reference data (SRD 5.2 asset) ─────────────────────────────────────

export type SpellSchool =
  'abjuration' | 'conjuration' | 'divination' | 'enchantment' |
  'evocation'  | 'illusion'   | 'necromancy' | 'transmutation';

export type SpellComponent = 'v' | 's' | 'm';

/** Full spell record as it appears in srd-5.2-spells.json */
export interface DndSpell {
  name: string;
  level: number;
  school: SpellSchool;
  classes: string[];          // lowercase: 'bard', 'cleric', etc.
  actionType: string;         // 'action' | 'bonus action' | 'reaction'
  concentration: boolean;
  ritual: boolean;
  range: string;
  components: SpellComponent[];
  duration: string;
  description: string;
  material?: string;          // text of material component
  castingTime?: string;       // for multi-action casts (e.g. "1 hour")
  castingTrigger?: string;    // reaction trigger condition
  cantripUpgrade?: string;    // cantrip damage scaling text
  higherLevelSlot?: string;   // upcast description
}

// ── Starting equipment types ──────────────────────────────────────────────────

export interface WeaponEntry {
  name: string;
  dmg: string;
  notes?: string;
  magic?: boolean;
}

export interface GearEntry {
  name: string;
  notes?: string;
  equipped?: boolean;
  magic?: boolean;
}

export interface EquipmentOptionA {
  weapons: WeaponEntry[];
  gear: GearEntry[];
  gp: number;
}

export interface ClassEquipment {
  optionA: EquipmentOptionA;
  optionB: { gp: number };
}
