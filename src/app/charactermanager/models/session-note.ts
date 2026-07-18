/**
 * A DM session note — a campaign-scoped log entry. Mirrors the backend
 * SessionNoteView DTO. `id` is numeric in real mode and a string sentinel in
 * demo mode (like SessionState.sessionId). `sessionId` is set when the note was
 * captured live during a session, null when added from the campaign menu.
 */
export interface SessionNote {
  id: number | string;
  body: string;
  createdAt: string;                       // ISO-8601 timestamp
  // Set once the note has been edited (null/absent = never edited) — lets the
  // list mark edited entries.
  updatedAt?: string | null;
  sessionId?: number | string | null;
}
