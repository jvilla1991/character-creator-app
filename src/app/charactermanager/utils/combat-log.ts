import { CombatLogType } from '../models/session';

/**
 * Wording for the DM's Combat Log panel. The server writes the real rows; the
 * functions here are its mirror for demo mode, which has no server, so a demo
 * session reads the same as a real one. Keep the sentences identical to the
 * backend CombatLogService.
 */

/** Current and temporary hit points at one moment. */
export interface HpMoment {
  current: number;
  temp: number;
}

export interface CombatLogWording {
  type: CombatLogType;
  description: string;
}

/** Added to a hit that takes a hero or a follower from above 0 to 0 hit points. */
export const DOWN_NOTE = 'Down at 0 HP.';

/**
 * The DM damaged (positive `amount`) or healed (negative) a combatant. Null
 * when no number moved: a heal at full hit points, or a hit on a row already
 * at 0, is not worth a row.
 *
 * `atZero` is added when the hit took current hit points from above 0 to 0.
 */
export function describeHpDelta(
  amount: number, before: HpMoment, after: HpMoment, atZero: string | null = DOWN_NOTE,
): CombatLogWording | null {
  if (amount > 0) {
    const absorbed = before.temp - after.temp;
    const lost = before.current - after.current;
    if (absorbed <= 0 && lost <= 0) return null;
    let text = `Took ${amount} damage`;
    if (absorbed > 0 && lost > 0) {
      text += `, ${absorbed} absorbed by temporary HP`;
    } else if (absorbed > 0) {
      text += `, all absorbed by temporary HP (${before.temp} → ${after.temp} left)`;
    }
    text += '.';
    if (lost > 0) {
      text += ` HP ${before.current} → ${after.current}.`;
      if (after.current === 0 && atZero) text += ` ${atZero}`;
    }
    return { type: 'DAMAGE', description: text };
  }
  if (amount < 0) {
    const healed = after.current - before.current;
    if (healed <= 0) return null;
    return { type: 'HEALING', description: `Healed ${healed}. HP ${before.current} → ${after.current}.` };
  }
  return null;
}

/** A player spent a Hit Die during a short rest. Null when it healed nothing. */
export function describeHitDie(before: number, after: number): CombatLogWording | null {
  const healed = after - before;
  if (healed <= 0) return null;
  return { type: 'HEALING', description: `Spent a Hit Die and healed ${healed}. HP ${before} → ${after}.` };
}

/** How a follower is named in the log: "Wolf (Thorin's follower)". */
export function followerSubject(followerName: string, ownerName: string | null | undefined): string {
  const name = followerName?.trim() ? followerName : 'Follower';
  return ownerName?.trim() ? `${name} (${ownerName}'s follower)` : name;
}

/** How many pages `total` rows fill at `size` rows a page; never fewer than one. */
export function combatLogPageCount(total: number, size: number): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(total / size));
}
