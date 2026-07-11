/**
 * Live "Session Mode" types — the client mirror of the backend SessionStateView /
 * ParticipantView DTOs. State is server-authoritative: the client renders what
 * the snapshot says and never computes turn order itself. `conditions` is parsed
 * from the backend's JSON string into an array by the SessionService deserializer.
 */

import { CampaignGameTime, CampaignLocation } from './campaign';
import { PC, PcSurvival } from './pc';

export type SessionStatus = 'LOBBY' | 'ACTIVE' | 'ENDED';

export interface ParticipantView {
  participantId: number;
  pcId: number | null;
  npc: boolean;
  ownedByMe: boolean;
  currentTurn: boolean;
  name: string;
  clazz: string | null;
  level: number | null;
  portraitTint: string | null;
  portraitInitials: string | null;
  initiative: number | null;
  initRolled: boolean;
  // DM-entered DEX modifier for an enemy row (the initiative tie-breaker);
  // null for PCs, whose modifier lives on the canonical character.
  dexModifier: number | null;
  orderIndex: number;
  hpMax: number | null;
  hpCurrent: number | null;
  hpTemp: number | null;
  ac: number | null;
  conditions: string[];
  // Darker Dungeons survival stages from the canonical PC row (parsed from the
  // backend's JSON string like conditions); null for NPCs / never-tracked PCs.
  survival: PcSurvival | null;
  // Spell slots from the canonical PC row (parsed from the backend's JSON
  // string), so the DM sees a caster's slot spend live; null for NPCs / PCs
  // with no slots.
  spellSlots: PC['spellSlots'] | null;
  deathSaveSuccesses: number;
  deathSaveFailures: number;
}

/**
 * Result of a DM XP award (mirrors backend XpAwardResult) — one entry per
 * affected PC. XP is intentionally not on the session snapshot, so this carries
 * the new total(s) for the DM's confirmation toast.
 */
export interface XpAwardEntry {
  pcId: number;
  name: string;
  xp: number;    // new total after the award
  delta: number; // actual change applied (may differ from request when floored at 0)
}

export interface XpAwardResult {
  awarded: XpAwardEntry[];
}

/**
 * One die-type group within a logged roll (mirrors the dice modal's
 * `breakdown` getter). `sides` is kept as a plain number here to avoid a
 * cross-component import from dice-roller-modal into models/.
 */
export interface SessionRollGroup {
  sides: number;
  rolls: number[];
  subtotal: number;
}

/**
 * One row in the Roll Log panel. Arrives already newest-first and already
 * filtered server-side (DM sees every roll; a player sees only their own) —
 * `mine` lets the DM's all-rolls view style "your roll" differently.
 */
export interface SessionRollView {
  rollId: number;
  participantId: number;
  rollerName: string;
  mine: boolean;
  groups: SessionRollGroup[];
  grandTotal: number;
  createdAt: string; // ISO instant
}

export interface SessionState {
  // Numeric in real mode; a string sentinel in demo mode.
  sessionId: number | string;
  campaignId: number | string;
  status: SessionStatus;
  round: number;
  // Per-viewer glow targets, resolved server-side. activeParticipantId is the
  // stable turn pointer — null while the encounter isn't ACTIVE, and null for a
  // player while a hidden enemy acts (no green glow, no sound cue).
  // onDeckParticipantId is the next combatant in TRUE turn order this viewer is
  // allowed to see (yellow glow); never equal to activeParticipantId. The client
  // renders both verbatim and never re-derives visibility.
  activeParticipantId: number | null;
  onDeckParticipantId: number | null;
  version: number;
  dm: boolean;
  // DM checkbox: hidden enemies are omitted from player snapshots entirely.
  enemiesHidden: boolean;
  // Middle visibility state: enemies visible but their health withheld — a
  // player's enemy rows arrive with the HP fields nulled server-side. The DM
  // still receives full health. Ignored while enemiesHidden.
  enemyHpHidden: boolean;
  // Encounter-level turn-cue key set by the DM (null = silent); each device can
  // still mute locally.
  turnSound: string | null;
  // Targeted-shop signal (shopping feature): a shop is open, and it's visible to
  // this caller (DM or a targeted attendee). When shopForMe flips true, the
  // client fetches the catalog from the shop endpoint.
  shopOpen: boolean;
  shopForMe: boolean;
  shopCategory: string | null;
  // Loot signal (post-combat loot): null = no pool visible to this caller,
  // 'DRAFT' = the DM's unpublished pool (DM only), 'DROPPED' = claimable. The
  // pool itself is fetched from the loot endpoint, re-keyed on every version
  // change — claims mutate the pool under a stable status.
  lootStatus: 'DRAFT' | 'DROPPED' | null;
  lootName: string | null;
  // Caller-scoped: the requester's own seated PC's current XP total, or null if
  // they're the DM or have no PC seated. Not on ParticipantView — that's broadcast
  // to every participant, and XP shouldn't leak between players.
  myXp: number | null;
  // The campaign's in-world clock (null until the DM sets or advances it).
  // Broadcast to every viewer; only the DM can change it.
  gameTime: CampaignGameTime | null;
  // The party's current location (null until the DM sets it). Broadcast to
  // every viewer; only the DM can change it.
  location: CampaignLocation | null;
  // The campaign's defined week — the ordered weekday names the clock walks on
  // each night → morning rollover — or null when the DM never defined one
  // (free-text weekdays, repetition counts weeks).
  weekDays: string[] | null;
  participants: ParticipantView[];
  // Roll Log feed: newest-first, capped at 50, server-filtered per viewer (DM
  // sees every roll made this session; a player sees only their own).
  rolls: SessionRollView[];
}
