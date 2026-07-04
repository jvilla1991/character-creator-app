/**
 * A per-character session note — written by the owning player on their
 * character sheet, readable also by the campaign's DM via the cross-link.
 * Client mirror of the backend PcNote entity.
 */
export interface PcNote {
  id: number | string;
  pcId: number;
  body: string;
  createdAt: string;                    // ISO-8601
  sessionId?: number | string | null;   // set when written during a live session
  campaignId?: number | string | null;
}
