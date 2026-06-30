/**
 * 2024 PHB cumulative XP thresholds, indexed by character level (1–20). A
 * character at level L becomes "ready to level up" once their total XP reaches
 * the threshold for L+1. Used only for the display-only badge on the character
 * sheet — leveling itself stays the explicit, server-authoritative flow, so this
 * never advances a level on its own. (The 2024 table matches the 2014 PHB.)
 */
export const XP_THRESHOLDS: readonly number[] = [
  0,       // L1
  300,     // L2
  900,     // L3
  2_700,   // L4
  6_500,   // L5
  14_000,  // L6
  23_000,  // L7
  34_000,  // L8
  48_000,  // L9
  64_000,  // L10
  85_000,  // L11
  100_000, // L12
  120_000, // L13
  140_000, // L14
  165_000, // L15
  195_000, // L16
  225_000, // L17
  265_000, // L18
  305_000, // L19
  355_000, // L20
];

export const MAX_LEVEL = 20;

/**
 * Total XP required to reach the next level, or null at max level. The threshold
 * for level L+1 lives at index L (the array is 0-based, levels are 1-based).
 */
export function xpForNextLevel(level: number): number | null {
  if (level >= MAX_LEVEL) return null;
  return XP_THRESHOLDS[level] ?? null;
}

/** Whether a character's total XP has reached the next level's threshold. */
export function isReadyToLevel(level: number, xp: number): boolean {
  const next = xpForNextLevel(level);
  return next != null && xp >= next;
}

/**
 * Progress (0–100) through the current level toward the next — the share of the
 * current level's XP span already earned. Returns 100 at max level (or for any
 * degenerate span). Used to fill the sheet's XP bar.
 */
export function xpProgressPct(level: number, xp: number): number {
  if (level >= MAX_LEVEL) return 100;
  const floor = XP_THRESHOLDS[level - 1] ?? 0; // current level's threshold
  const ceil = XP_THRESHOLDS[level] ?? floor;  // next level's threshold
  const span = ceil - floor;
  if (span <= 0) return 100;
  return Math.max(0, Math.min(100, ((xp - floor) / span) * 100));
}
