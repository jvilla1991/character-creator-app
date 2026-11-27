
import { StatAdjustments } from './stat-adjustment';
import type { SubclassChoices } from './arcana-subclasses';

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
  /**
   * True for a leveled spell a feature always keeps prepared (a Ranger's
   * Hunter's Mark, a Paladin's Find Steed, a DM grant marked so). It is outside
   * the prepared list: it never counts against the prepared-spell limit, cannot
   * be unprepared, and is not part of a long-rest spell change. Set by the
   * create wizard, a level-up or the DM; read it through isAlwaysPrepared().
   */
  alwaysPrepared?: boolean;
  /** What gives an always-prepared spell, shown beside it ('Favored Enemy'). */
  grantedBy?: string;
}

/**
 * An item a character owns — the client mirror of the backend inventory JSON
 * entry. Mirrors PcSpell: a lean, self-contained snapshot (denormalized from the
 * SRD catalog at purchase time) so the sheet renders without a catalog lookup.
 */
export interface PcItem {
  catalogKey?: string;          // SRD slug, e.g. 'longsword'; absent for ad-hoc items
  name: string;
  category: 'weapon' | 'armor' | 'material-component' | 'gear' | 'transport' | 'treasure';
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

/**
 * A purse. The game uses three coins: copper, silver and gold
 * (1 gp = 10 sp = 100 cp). Electrum and platinum are not part of it.
 */
export interface Coins {
  cp: number;
  sp: number;
  gp: number;
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
  // Where the species comes from ('World of Warcraft'), the lineage chosen for it
  // ('Night Elf', 'Taunka') and its size ('Small' | 'Medium'). All three are set by
  // the create wizard for a World of Warcraft species and null for everyone else
  // (a base-game species reads its size from its name — see slotCapacity).
  // Omitting them on an update keeps the stored values.
  speciesSource?: string | null;
  lineage?: string | null;
  size?: string | null;
  subclass?: string;
  // Hero-class specialization (a Death Knight's rune, a Demon Hunter's spec — see
  // HERO_CLASSES); null for everyone else. Older payloads called this `rune`.
  specialization?: string | null;
  // World of Warcraft Hunter pet family (bare name from HUNTER_PET_FAMILIES, e.g.
  // 'Wolf', 'Mechanized Animal'). Only a WoW hunter with the Beast Master subclass
  // may set it (the server 400s otherwise); null for everyone else. Omitting it on
  // an update keeps the stored value.
  petFamily?: string | null;
  // Death Knight Runeforging: the NAME of the melee weapon the rune is inscribed
  // on (weapons have no id). Set as a long rest ends or from the sheet; a name
  // that no longer matches a melee weapon on the sheet counts as unset — read it
  // through runeWeaponOf() in utils/rune-weapon.ts.
  runeWeapon?: string | null;
  // Limited-use class features (Second Wind, Rage, Lay On Hands, ...): how much
  // of each is USED, keyed by resource — { secondWind: 1 }. The maximum is
  // computed (utils/class-resources.ts), never stored; read it through
  // classResourceStates(). The server cleans the map on every save.
  classResources?: Record<string, number> | null;
  // What the character chose for its subclass (an Arcana Domain cleric's skill,
  // an Arcane Archer's replacement skills and Arcane Shot options, a Vestige
  // Patron's vestige type and domain); null for everyone else. Server-owned:
  // only a level-up and PCService.setSubclassChoices write it, and a generic
  // save never changes it. The spells picked for a subclass feature are not
  // here: they sit in `spells` with the feature as their `grantedBy`.
  subclassChoices?: SubclassChoices | null;
  background?: string;
  alignment?: string;
  portraitInitials?: string;
  portraitTint?: 'celestial' | 'gold' | 'crimson' | 'violet' | 'emerald';
  // The uploaded portrait's version, or null/absent when the character has
  // none. Server-owned: it moves only through the portrait endpoints
  // (PortraitService), and it is the cache key for the image.
  portraitVersion?: number | null;

  // Combat
  hp?: { cur: number; max: number; temp: number };
  // Saved total: the lines the app works out (armor, Dex, shields) plus every
  // adjustment line below. Read it through acBreakdown() in utils/armor-math.ts
  // when the parts matter.
  ac?: number;
  // DM-added lines on calculated numbers, keyed by the number they adjust
  // ({ ac: [{ value: 1, label: 'Taunka' }] }). In a campaign only the DM's save
  // changes them (the server keeps the stored lines on an owner's update);
  // omitting the field on an update keeps the stored value.
  statAdjustments?: StatAdjustments | null;
  init?: number;
  speed?: number;
  prof?: number;
  stats?: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };
  saves?: Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'>;
  skills?: { [skillName: string]: 'prof' | 'expert' };
  conditions?: string[];
  // Conditions the character is immune to (green chips; `conditions` are the
  // red ones). Never both: an active condition wins. Absent = none. In a
  // campaign the player changes only this list; the DM changes both.
  conditionImmunities?: string[];
  // 2024 PHB Exhaustion level, 0–6: each level is −2 to all d20 Tests and
  // −5 ft Speed; level 6 kills the character. Absent/null = 0 (never tracked).
  // Kept nullable end-to-end — the backend preserves the stored value when an
  // update body carries null (like survival), so a payload built from a
  // projection that lacks the field can never wipe a real level.
  exhaustion?: number;
  // Spent hit dice (max = level). Server-owned: only the session short-rest
  // spend / long-rest restore endpoints mutate it — generic PC updates never
  // change it, so it rides read-only through the serialize seam.
  hitDiceUsed?: number;
  // Heroic Inspiration meter (server-owned like hitDiceUsed): the DM awards
  // pips one at a time; the fifth pip empties the meter and lights the badge.
  inspirationPips?: number;
  heroicInspiration?: boolean;
  // Darker Dungeons survival stages (0–6 each); only meaningful in campaigns
  // with the survivalConditions variant. Absent = never tracked (all zeros).
  survival?: PcSurvival;

  // Wealth
  coins?: Coins;

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
  notes?: string; // The player's own notes (narrative, like bio). NOT DM-only: the backend
                  // files it under Narrative and hides it from the DM's member projection.

  // Proficiencies / origin (populated in later wizard steps)
  languages?: string[];
  toolProfs?: string[];
  feat?: string; // origin feat name
}
