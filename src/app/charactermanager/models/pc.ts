/** A spell as stored on a character — lean subset of DndSpell plus enrichment fields */
export interface PcSpell {
  lvl: number;
  name: string;
  school: string;
  time: string;
  prepared: boolean;
  // Enrichment fields (optional — populated from DndSpell at selection time)
  concentration?: boolean;
  ritual?: boolean;
  range?: string;
  components?: string[];
  duration?: string;
  description?: string;
  material?: string;
  higherLevelSlot?: string;
}

export interface PC {
  // --- Core (backend-persisted) ---
  id: number;
  name: string;
  clazz: string;
  level: number;
  playerName: string; // kept for backend compat; new field is `player`

  // --- Rich fields (client-side for now; migrate backend after Phase 1) ---
  player?: string;
  party?: string;
  race?: string;
  subclass?: string;
  background?: string;
  alignment?: string;
  portraitInitials?: string;
  portraitTint?: 'celestial' | 'gold' | 'crimson' | 'violet' | 'emerald';

  // Combat
  hp?: { cur: number; max: number; temp: number };
  ac?: number;
  init?: number;
  speed?: number;
  prof?: number;
  stats?: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };
  saves?: Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'>;
  skills?: { [skillName: string]: 'prof' | 'expert' };
  conditions?: string[];

  // Wealth
  coins?: { cp: number; sp: number; ep: number; gp: number; pp: number };

  // Spells
  spellSlots?: { [level: number]: { max: number; used: number } };
  spells?: PcSpell[];

  // Inventory
  weapons?: Array<{ name: string; magic?: boolean; dmg: string; notes?: string }>;
  gear?: Array<{ name: string; magic?: boolean; equipped?: boolean; notes?: string }>;

  // Narrative
  features?: Array<{ name: string; source: string; desc: string }>;
  traits?: { Personality: string; Ideals: string; Bonds: string; Flaws: string };
  bio?: string;
  notes?: string; // DM-only notes

  // Proficiencies / origin (populated in later wizard steps)
  languages?: string[];
  toolProfs?: string[];
  feat?: string; // origin feat name
}
