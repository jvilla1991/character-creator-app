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

/**
 * An item a character owns — the client mirror of the backend inventory JSON
 * entry. Mirrors PcSpell: a lean, self-contained snapshot (denormalized from the
 * SRD catalog at purchase time) so the sheet renders without a catalog lookup.
 */
export interface PcItem {
  catalogKey?: string;          // SRD slug, e.g. 'longsword'; absent for ad-hoc items
  name: string;
  category: 'weapon' | 'armor' | 'material-component' | 'gear';
  qty: number;
  unitCostCp?: number;          // unit price paid, in copper
  weight?: number;
  bulk?: number;                // Darker Dungeons object bulk; stamped at purchase/conversion
  // category-specific snapshot fields (optional)
  damage?: string;              // weapons
  properties?: string[];        // weapons
  armorClass?: string;          // armor
  consumedOnCast?: boolean;     // material components
  spell?: string;               // material component → consuming spell
  equipped?: boolean;
  notes?: string;
  // Drop lifecycle: undefined/'active' = owned normally; 'dropped' = flagged to
  // leave behind but still shown (one more click permanently discards it).
  status?: 'active' | 'dropped';
}

/** Darker Dungeons ch. 31 survival-condition stages, 0 (best) to 6 (worst). */
export interface PcSurvival {
  hunger: number;
  thirst: number;
  fatigue: number;
  /** True once the character's starting Rations/Waterskin have been granted —
   *  guards against re-seeding after the supplies are consumed. */
  seeded?: boolean;
}

export interface PC {
  // --- Core (backend-persisted) ---
  id: number;
  name: string;
  clazz: string;
  level: number;
  // Experience points. Accumulates only (DM awards in Session Mode); level-up
  // stays the explicit player-driven flow. Backend column defaults to 0.
  xp?: number;
  // DM-granted level-up permission: lets the character level once without
  // meeting the XP threshold; the backend clears it when the level-up is
  // applied. Server-owned — generic PC updates never change it.
  pendingLevelGrant?: boolean;
  playerName: string; // kept for backend compat; new field is `player`

  // --- Rich fields (client-side for now; migrate backend after Phase 1) ---
  player?: string;
  // Campaign this PC is bound to. Backend stores a numeric FK; the value is
  // compared as a string against Campaign.id (see CampaignService.membersOf).
  campaignId?: number | string | null;
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
  // Darker Dungeons survival stages (0–6 each); only meaningful in campaigns
  // with the survivalConditions variant. Absent = never tracked (all zeros).
  survival?: PcSurvival;

  // Wealth
  coins?: { cp: number; sp: number; ep: number; gp: number; pp: number };

  // Spells
  spellSlots?: { [level: number]: { max: number; used: number } };
  spells?: PcSpell[];

  // Inventory
  weapons?: Array<{ name: string; magic?: boolean; dmg: string; notes?: string }>;
  gear?: Array<{ name: string; magic?: boolean; equipped?: boolean; notes?: string }>;
  // Structured inventory — purchases land here (legacy weapons/gear left as-is).
  inventory?: PcItem[];

  // Narrative
  // One array, two panels: entries tagged category 'other' (species traits,
  // boons, magic-item properties, story rewards) render in the Other Features
  // panel; absent/'class' = Class Features (so all pre-existing data stays put).
  // The column is opaque JSON end-to-end, so the extra key round-trips freely.
  features?: Array<{ name: string; source: string; desc: string; category?: 'class' | 'other' }>;
  traits?: { Personality: string; Ideals: string; Bonds: string; Flaws: string };
  bio?: string;
  notes?: string; // DM-only notes

  // Proficiencies / origin (populated in later wizard steps)
  languages?: string[];
  toolProfs?: string[];
  feat?: string; // origin feat name
}
