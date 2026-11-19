import { PC } from '../models/pc';

// ── Spell slots ──────────────────────────────────────────────────────────────
// How a character's slots are read for the sheet, and the app's one copy of the
// class slot tables. The server owns the real maximum (class table plus the
// DM's bonus lines, see SpellSlotState in the backend) and sends it back on
// every save; the tables here only fill the gaps where there is no server to
// ask: a brand-new character before its first save, and demo mode.

/** The stored shape: `{ 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 } }`, keyed by spell level. */
export type SpellSlots = NonNullable<PC['spellSlots']>;

/** Highest spell level there are slots for. */
export const MAX_SPELL_LEVEL = 9;

/** One spell level's slots as the sheet shows them. */
export interface SlotLevel {
  level: number;
  max: number;
  used: number;
  /** Slots still available: `max - used`. */
  left: number;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th" … */
export function ordinal(n: number): string {
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/**
 * The spell levels a character has slots for, lowest first. A level with no
 * maximum is left out (it is not a level the character has), and `used` is
 * kept within 0..max so a stale count can never read as "-1 left".
 */
export function slotLevels(slots: PC['spellSlots'] | null | undefined): SlotLevel[] {
  const levels: SlotLevel[] = [];
  for (let level = 1; level <= MAX_SPELL_LEVEL; level++) {
    const slot = slots?.[level];
    const max = Math.trunc(Number(slot?.max ?? 0));
    if (!slot || !(max > 0)) continue;
    const used = Math.max(0, Math.min(Math.trunc(Number(slot.used ?? 0)) || 0, max));
    levels.push({ level, max, used, left: max - used });
  }
  return levels;
}

/** "2 of 4 left", or "None left" once every slot of the level is spent. */
export function slotsLeftText(slot: { max: number; used: number }): string {
  const left = Math.max(0, slot.max - slot.used);
  return left === 0 ? 'None left' : `${left} of ${slot.max} left`;
}

// ── Spending and restoring by hand ───────────────────────────────────────────
// The same rules as the server's spend and restore endpoints (SpellSlotState).
// Used where there is no server to ask: demo mode, and a follower's stat block.
// Pure: each returns new slots, or null when the server would refuse (409).

/** The slots as the server stores them: only levels with a maximum, `used` within 0..max. */
function cleaned(slots: PC['spellSlots'] | null | undefined): SpellSlots {
  const out: SpellSlots = {};
  for (const level of slotLevels(slots)) out[level.level] = { max: level.max, used: level.used };
  return out;
}

/** One slot of this spell level spent; null when the character has no free slot there. */
export function spendSlot(slots: PC['spellSlots'] | null | undefined, spellLevel: number): SpellSlots | null {
  const out = cleaned(slots);
  const slot = out[spellLevel];
  if (!slot || slot.used >= slot.max) return null;
  out[spellLevel] = { max: slot.max, used: slot.used + 1 };
  return out;
}

/** One spent slot of this spell level given back; null when none is spent there. */
export function restoreSlot(slots: PC['spellSlots'] | null | undefined, spellLevel: number): SpellSlots | null {
  const out = cleaned(slots);
  const slot = out[spellLevel];
  if (!slot || slot.used <= 0) return null;
  out[spellLevel] = { max: slot.max, used: slot.used - 1 };
  return out;
}

/** Every spent slot given back. Never refused: a rested character comes back unchanged. */
export function restoreAllSlots(slots: PC['spellSlots'] | null | undefined): SpellSlots {
  const out = cleaned(slots);
  for (const level of Object.keys(out).map(Number)) out[level] = { max: out[level].max, used: 0 };
  return out;
}

// ── A level's maximum ────────────────────────────────────────────────────────

/** The saved maximum for a spell level; 0 when the character has no slots there. */
export function slotMaxOf(slots: PC['spellSlots'] | null | undefined, spellLevel: number): number {
  return Math.max(0, Math.trunc(Number(slots?.[spellLevel]?.max ?? 0)) || 0);
}

/**
 * The slots with one spell level's maximum set, the way the server stores a
 * maximum that moved: `used` comes down with a maximum that shrank, and a
 * level whose maximum is zero or less is dropped altogether.
 */
export function withSlotMax(
  slots: PC['spellSlots'] | null | undefined, spellLevel: number, max: number,
): SpellSlots {
  const out: SpellSlots = { ...(slots ?? {}) };
  if (max > 0) {
    const used = Math.max(0, Math.min(Math.trunc(Number(out[spellLevel]?.used ?? 0)) || 0, max));
    out[spellLevel] = { max, used };
  } else {
    delete out[spellLevel];
  }
  return out;
}

// ── What the strip says after a change ───────────────────────────────────────

/** A line for the strip's detail row, and the spell level it is about (null: all of them). */
export interface SlotNotice {
  level: number | null;
  text: string;
}

export function slotSpentNotice(spellLevel: number): SlotNotice {
  return { level: spellLevel, text: `One ${ordinal(spellLevel)}-level slot spent by hand.` };
}

export function slotRestoredNotice(spellLevel: number): SlotNotice {
  return { level: spellLevel, text: `One ${ordinal(spellLevel)}-level slot restored.` };
}

export function allSlotsRestoredNotice(): SlotNotice {
  return { level: null, text: 'All slots restored.' };
}

// ── Class slot tables ────────────────────────────────────────────────────────
// Mirror of the server's ClassProgression.spellSlotsFor. Rows are character
// levels 1-20, columns are spell levels from 1st up.

const FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
/** Paladin and Ranger, and with them every class stored under those names (Death Knight, Demon Hunter, WoW Paladin, WoW Hunter). */
const HALF_CASTERS = new Set(['paladin', 'ranger']);

const FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** 2024 PHB half-caster table: slots from level 1, up to 5th-level spells. */
const HALF_CASTER_SLOTS: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

/** Warlock pact magic: one slot level, `[slotLevel, count]` per character level. */
const PACT_SLOTS: [number, number][] = [
  [1, 1], [1, 2], [2, 2], [2, 2], [3, 2], [3, 2], [4, 2], [4, 2], [5, 2], [5, 2],
  [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 4],
];

/**
 * The class table's slot maximum per spell level at a character level (levels
 * clamp into 1-20): full casters, the half casters Paladin and Ranger, or the
 * Warlock's pact slots. Empty for a class with no slots. DM bonus lines are
 * not part of the table.
 */
export function classSlotTable(clazz: string | undefined, level: number): { [spellLevel: number]: number } {
  const key = (clazz ?? '').trim().toLowerCase();
  const idx = Math.min(Math.max(level, 1), 20) - 1;
  const out: { [spellLevel: number]: number } = {};
  if (FULL_CASTERS.has(key) || HALF_CASTERS.has(key)) {
    const row = (FULL_CASTERS.has(key) ? FULL_CASTER_SLOTS : HALF_CASTER_SLOTS)[idx];
    row.forEach((max, i) => { if (max > 0) out[i + 1] = max; });
  } else if (key === 'warlock') {
    const [slotLevel, count] = PACT_SLOTS[idx];
    out[slotLevel] = count;
  }
  return out;
}

/** A new character's slots: the class table at `level`, nothing spent. */
export function startingSlots(clazz: string | undefined, level = 1): SpellSlots {
  const slots: SpellSlots = {};
  for (const [spellLevel, max] of Object.entries(classSlotTable(clazz, level))) {
    slots[Number(spellLevel)] = { max, used: 0 };
  }
  return slots;
}
