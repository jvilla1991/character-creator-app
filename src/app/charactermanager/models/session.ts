/**
 * Live "Session Mode" types — the client mirror of the backend SessionStateView /
 * ParticipantView DTOs. State is server-authoritative: the client renders what
 * the snapshot says and never computes turn order itself. `conditions` is parsed
 * from the backend's JSON string into an array by the SessionService deserializer.
 */

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
  ac: number | null;
  conditions: string[];
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

export interface SessionState {
  // Numeric in real mode; a string sentinel in demo mode.
  sessionId: number | string;
  campaignId: number | string;
  status: SessionStatus;
  round: number;
  currentTurnIndex: number;
  version: number;
  dm: boolean;
  // Targeted-shop signal (shopping feature): a shop is open, and it's visible to
  // this caller (DM or a targeted attendee). When shopForMe flips true, the
  // client fetches the catalog from the shop endpoint.
  shopOpen: boolean;
  shopForMe: boolean;
  shopCategory: string | null;
  // Caller-scoped: the requester's own seated PC's current XP total, or null if
  // they're the DM or have no PC seated. Not on ParticipantView — that's broadcast
  // to every participant, and XP shouldn't leak between players.
  myXp: number | null;
  participants: ParticipantView[];
}
