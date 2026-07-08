/**
 * A campaign a Dungeon Master runs. Membership is the persisted `campaign_id`
 * FK on the PC (see PC.campaignId); this model is the source of truth for the
 * DM-facing fields. `party` is a legacy display label kept for backend compat.
 */
export interface Campaign {
  id: string;
  party: string;        // legacy display label (defaults to the campaign name)
  name: string;
  setting: string;
  session: number;
  next: string;         // e.g. "Thu · Jun 12"
  arc: string;
  tint: CampaignTint;
  chronicle: string;    // prose recap (DM-facing)
  secrets: string;      // DM-only, never shown to players
  threads: string[];    // open plot threads
  inviteCode?: string;  // players join by entering this (Phase 3)
  variantRules?: CampaignVariantRules; // creation-time opt-ins, immutable
  gameTime?: CampaignGameTime | null;  // in-world clock; null until set
  location?: CampaignLocation | null;  // party's current place; null until set
  weekDays?: string[] | null;          // ordered weekday names; null = free-text weekdays
}

/** A named, ordered week the DM can pick instead of typing custom day names. */
export interface WeekdayPreset {
  key: string;
  label: string;
  days: string[];
}

/**
 * Built-in week templates for the create-campaign modal and the dashboard's
 * week editor. The DM can also enter a fully custom ordered list.
 */
export const WEEKDAY_PRESETS: WeekdayPreset[] = [
  {
    key: 'real-world', label: 'Real-world (7 days)',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  {
    key: 'forgotten-realms', label: 'Forgotten Realms tenday',
    days: ['First-day', 'Second-day', 'Third-day', 'Fourth-day', 'Fifth-day',
           'Sixth-day', 'Seventh-day', 'Eighth-day', 'Ninth-day', 'Tenth-day'],
  },
  {
    key: 'eberron', label: 'Eberron (7 days)',
    days: ['Sul', 'Mol', 'Zol', 'Wir', 'Zor', 'Far', 'Sar'],
  },
  {
    key: 'exandria', label: 'Exandria (7 days)',
    days: ['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', "Da'leysen"],
  },
];

/** The kinds of place the party can be — drives the type chip on the sheet. */
export type LocationType = 'Settlement' | 'Wilderness' | 'Dungeon';

export const LOCATION_TYPES: LocationType[] = ['Settlement', 'Wilderness', 'Dungeon'];

/**
 * The party's current location, set by the DM in Session Mode and shown at the
 * top of every member's character sheet. `name` is free text; `type` is one of
 * the three {@link LocationType}s. Null/absent = never set.
 */
export interface CampaignLocation {
  name: string;
  type: LocationType;
}

export type CampaignTint = 'celestial' | 'violet' | 'gold' | 'crimson' | 'emerald';

/**
 * Variant-rule opt-ins chosen at campaign creation (immutable afterward —
 * the backend pins them on update). Extensible: future Darker Dungeons
 * rules (Wear & Tear, …) add keys here, not new columns.
 */
export interface CampaignVariantRules {
  slotInventory?: boolean;
  survivalConditions?: boolean;
  strictComponents?: boolean;
}

/** Segment of the in-world day; each worsens survival conditions in its way. */
export type TimeOfDay = 'morning' | 'noon' | 'night';

/**
 * The campaign's persisted in-world clock. Date parts are FREE TEXT the DM
 * curates ("1492 DR" / "Hammer" / "3rd" — any homebrew calendar); advancing
 * time only cycles the day segments, never the date. The weekday history
 * drives the week counter: re-entering a previously seen weekday marks a
 * completed week. Null/absent = never set. (Pre-v2 clocks stored numbers and
 * dawn/dusk segments — normalizeGameTime converts them on read.)
 */
export interface CampaignGameTime {
  year: string;
  month: string;
  day: string;
  timeOfDay: TimeOfDay;
  weekday: string | null;
  weekdaysSeen: string[];
  week: number;
}

/** Member-visible campaign header — what a player's sheet may know about it. */
export interface CampaignSummary {
  id: string;
  name: string;
  variantRules: CampaignVariantRules;
  location: CampaignLocation | null;
}

/** A new campaign as drafted in the create-campaign modal (pre-id, pre-seed). */
export interface CampaignDraft {
  name: string;
  setting: string;
  tint: CampaignTint;
  variantRules: CampaignVariantRules;
  gameTime?: CampaignGameTime;  // optional in-world start date
  weekDays?: string[] | null;   // optional defined week (editable later)
}

/** Dice & rolling preferences, persisted to localStorage under `tm_dice`. */
export interface DicePrefs {
  style: 'digital' | 'manual';
  showMods: boolean;
  advPrompt: boolean;
  critFx: boolean;
}

/** The signed-in user as shown in the settings panel / account row. */
export interface CurrentUser {
  name: string;
  email: string;
  initials: string;
  tint: CampaignTint;
  title?: string;
  member_since?: string;
}
