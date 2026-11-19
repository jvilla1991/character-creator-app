import { LootResultView } from './loot';
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
  orderIndex: number;
  hpMax: number | null;
  hpCurrent: number | null;
  hpTemp: number | null;
  // Armor class: the canonical PC's AC, or the DM-entered AC for an enemy row
  // (reference info only — initiative ties resolve by insertion order).
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
  // Spent hit dice from the canonical PC row (max = level); null for NPCs.
  hitDiceUsed: number | null;
  // Heroic Inspiration meter from the canonical PC row; null for NPCs.
  inspirationPips: number | null;
  heroicInspiration: boolean | null;
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

/**
 * Lifecycle of a player-initiated short-rest vote. ACTIVE is the only live
 * state. FAILED covers every "no rest" outcome (a no ballot, the 60s window
 * expiring with unanswered ballots, or the DM's deny override); CANCELLED is
 * system interruption (an encounter started mid-vote).
 */
export type RestVoteStatus = 'ACTIVE' | 'PASSED' | 'FAILED' | 'CANCELLED';

/** One seated PC's ballot. `vote` null = not yet voted (the yellow "?"). */
export interface RestVoteBallot {
  participantId: number;
  displayName: string;
  vote: boolean | null;
}

/** Which rest a vote is about: a passed SHORT vote opens the hit-dice window,
 *  a passed LONG vote opens the long rest phase. */
export type RestType = 'SHORT' | 'LONG';

/**
 * The rest vote riding the snapshot — broadcast to every viewer; a
 * client finds its own ballot by participant id. `expiresAt` is the
 * server-authoritative deadline (ISO instant): render a countdown from it,
 * never tick 60 locally — a backgrounded tab must snap correct on return.
 * The latest vote stays on the snapshot after it resolves (so clients can
 * announce the outcome) until the next vote replaces it.
 */
export interface RestVoteView {
  voteId: number;
  status: RestVoteStatus;
  // SHORT when the backend predates the long rest.
  restType: RestType;
  initiatorParticipantId: number | null;
  initiatorName: string;
  expiresAt: string;
  votes: RestVoteBallot[];
}

/** One seated hero's place in the open long rest. `cannotRest`: at 0 Hit
 *  Points, so the rest gives them nothing and nobody waits on them. */
export interface LongRestReadiness {
  participantId: number;
  pcId: number | null;
  displayName: string;
  ready: boolean;
  cannotRest: boolean;
}

/**
 * What a hero chooses as a long rest ends. They travel with the player's
 * Ready and are applied with recovery when the rest finishes; an absent part
 * means "leave it as it is". `preparedSpells` is the complete list of leveled
 * spells to have prepared; `runeWeapon` the melee weapon a Death Knight's rune
 * goes on.
 */
export interface LongRestChoices {
  preparedSpells?: string[];
  runeWeapon?: string;
}

/**
 * The open long rest phase (null on the snapshot when none is open). Nothing
 * has been recovered while it is present: recovery lands for the whole party
 * when the DM finishes the rest or the last able hero marks Ready.
 * `readyCount` / `ableCount` are the "x of y ready" numbers.
 */
export interface LongRestView {
  advanceClock: boolean;
  undisturbed: boolean;
  readyCount: number;
  ableCount: number;
  readiness: LongRestReadiness[];
  // Caller-scoped: the choices this viewer's own READY hero is waiting to have
  // applied, so the screen can show them again after a reload. Null otherwise.
  myChoices: LongRestChoices | null;
}

/**
 * The latest long rest outcome, kept on the snapshot so every client can
 * announce it once (keyed on `id`). FINISHED = recovery was applied;
 * INTERRUPTED = the phase closed and nobody recovered. `skipped` names the
 * heroes at 0 Hit Points who gained nothing from a finished rest.
 */
export interface LongRestResultView {
  id: number;
  outcome: 'FINISHED' | 'INTERRUPTED';
  skipped: string[];
  clockAdvanced: boolean;
  createdAt: string | null;
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
  // DM-announced short-rest window: while true, a seated player may spend hit
  // dice (POST /session/{id}/hit-dice/spend). Cleared server-side on encounter
  // start and session end.
  shortRestOpen: boolean;
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
  // 'DRAFT' = the DM's unpublished pool (DM only), 'DROPPED' = the party is
  // splitting it. The pool itself is fetched from the loot endpoint, re-keyed
  // on every version change — split edits and votes mutate it under a stable
  // status.
  lootStatus: 'DRAFT' | 'DROPPED' | null;
  lootName: string | null;
  // Caller-scoped: the requester's own seated PC's current XP total, or null if
  // they're the DM or have no PC seated. Not on ParticipantView — that's broadcast
  // to every participant, and XP shouldn't leak between players.
  myXp: number | null;
  // Caller-scoped, like myXp: whether the requester's own seated PC holds an
  // unspent DM level grant (pendingLevelGrant). null for the DM / no seated PC,
  // and while the backend predates the field — callers then fall back to the
  // local PC store.
  myLevelGrant: boolean | null;
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
  // The latest player-initiated rest vote (terminal included), or null
  // when this session has never held one.
  restVote: RestVoteView | null;
  // The latest party loot-split outcome (broadcast), or null. It outlives the
  // pool it describes, so every client can announce it once (keyed on id).
  lootResult: LootResultView | null;
  // The open long rest phase, or null.
  longRest: LongRestView | null;
  // The latest long rest outcome (broadcast), or null.
  longRestResult: LongRestResultView | null;
}
