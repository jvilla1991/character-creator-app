/**
 * A campaign a Dungeon Master runs. In Phase 1 the link to characters is the
 * free-text `party` key (members = PCs whose `party` === campaign.party),
 * mirroring the existing roster grouping. Phase 2 introduces a persisted
 * `campaign_id` FK on the PC; this model stays the source of truth for the
 * DM-facing fields.
 */
export interface Campaign {
  id: string;
  party: string;        // links to PC.party — members are PCs whose party === this
  name: string;
  setting: string;
  session: number;
  next: string;         // e.g. "Thu · Jun 12"
  arc: string;
  tint: CampaignTint;
  chronicle: string;    // prose recap (DM-facing)
  secrets: string;      // DM-only, never shown to players
  threads: string[];    // open plot threads
}

export type CampaignTint = 'celestial' | 'violet' | 'gold' | 'crimson' | 'emerald';

/** A new campaign as drafted in the create-campaign modal (pre-id, pre-seed). */
export interface CampaignDraft {
  name: string;
  setting: string;
  next: string;
  tint: CampaignTint;
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
