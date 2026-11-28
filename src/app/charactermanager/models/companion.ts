import { Follower, FollowerStatBlock, followerKind } from './follower';

/**
 * Server-owned companions: followers of kind `COMPANION` (a Vestige Patron's
 * vestige). The server creates one, works its stat block out from the
 * character it belongs to and removes it, so:
 *
 * - nobody dismisses one, the DM included;
 * - the owning player and the DM change only its name, its current and
 *   temporary Hit Points and its conditions. Whatever else a save carries, the
 *   server leaves unread.
 *
 * The two functions below are the client's copy of the server's
 * CompanionVitals, used to show a save as the server will store it and to run
 * the same rules in demo mode.
 */

/** True for a follower the server owns. */
export function isCompanion(follower: Pick<Follower, 'kind'>): boolean {
  return followerKind(follower) === 'COMPANION';
}

/** The most conditions a companion carries, and the longest a condition's name may be. */
const MAX_CONDITIONS = 30;
const MAX_CONDITION_LENGTH = 40;

const whole = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;

/** Put the three values play changes on a block, cleaned against that block. */
function withVitals(
  block: FollowerStatBlock, current: number | null, temporary: number | null, conditions: unknown,
): FollowerStatBlock {
  const max = whole(block.hp?.max);
  const cur = Math.max(0, current ?? 0);
  const immune = (block.conditionImmunities ?? []).map(c => c.trim().toLowerCase());
  const kept: string[] = [];
  const seen: string[] = [];
  for (const item of Array.isArray(conditions) ? conditions : []) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const name = item.trim();
    const key = name.toLowerCase();
    if (name.length > MAX_CONDITION_LENGTH || immune.includes(key) || seen.includes(key)) continue;
    if (kept.length >= MAX_CONDITIONS) break;
    seen.push(key);
    kept.push(name);
  }
  return {
    ...block,
    hp: {
      ...(block.hp ?? { max: 0, cur: 0, temp: 0 }),
      cur: max === null ? cur : Math.min(cur, Math.max(0, max)),
      temp: Math.max(0, temporary ?? 0),
    },
    conditions: kept,
  };
}

/**
 * A companion's stored block after an update: the block as stored, with the
 * edited sheet's current Hit Points, temporary Hit Points and conditions. A
 * value the edit leaves out keeps the stored one; nothing else is read.
 */
export function companionEdit(stored: FollowerStatBlock, edited: FollowerStatBlock): FollowerStatBlock {
  return withVitals(
    stored,
    whole(edited.hp?.cur) ?? whole(stored.hp?.cur),
    whole(edited.hp?.temp) ?? whole(stored.hp?.temp),
    Array.isArray(edited.conditions) ? edited.conditions : stored.conditions,
  );
}

/**
 * A freshly built block taking over from the stored one: it keeps the stored
 * temporary Hit Points and conditions, and the stored current Hit Points raised
 * by however much the maximum grew. Without readable stored Hit Points the
 * fresh block stays full.
 */
export function companionCarriedOver(fresh: FollowerStatBlock, stored: FollowerStatBlock): FollowerStatBlock {
  const freshMax = whole(fresh.hp?.max);
  const storedMax = whole(stored.hp?.max);
  let current = whole(stored.hp?.cur);
  if (current !== null && freshMax !== null && storedMax !== null) current += Math.max(0, freshMax - storedMax);
  return withVitals(fresh, current ?? freshMax, whole(stored.hp?.temp), stored.conditions);
}
