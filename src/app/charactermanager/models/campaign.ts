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
}

export type CampaignTint = 'celestial' | 'violet' | 'gold' | 'crimson' | 'emerald';

/**
 * Variant-rule opt-ins chosen at campaign creation (immutable afterward —
 * the backend pins them on update). Extensible: future Darker Dungeons
 * rules (Wear & Tear, …) add keys here, not new columns.
 */
export interface CampaignVariantRules {
  slotInventory?: boolean;
}

/** Member-visible campaign header — what a player's sheet may know about it. */
export interface CampaignSummary {
  id: string;
  name: string;
  variantRules: CampaignVariantRules;
}

/** A new campaign as drafted in the create-campaign modal (pre-id, pre-seed). */
export interface CampaignDraft {
  name: string;
  setting: string;
  tint: CampaignTint;
  variantRules: CampaignVariantRules;
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
