import { PC } from './pc';
import { classResourceStates, withResourceUsed } from '../utils/class-resources';
import {
  MYSTIC_FOCUS_LEVEL, MYSTIC_FOCUS_MAX_SLOT_LEVEL, isMysticArtsMonk, isMysticFocusSlotLevel, mysticFocusCost,
  mysticFocusMinLevel,
} from '../utils/mystic-arts';
import { SlotNotice, SpellSlots, ordinal, restoreSlot, slotLevels, spendSlot } from '../utils/spell-slots';

// ── Mystic Focus (Warrior of the Mystic Arts, Monk 6) ────────────────────────
// A spell slot becomes Focus Points, or Focus Points become a spell slot. The
// server owns it (POST /pc/{id}/mystic-focus, MysticFocusRules); this is the
// same rule for the sheet (which actions to offer, what the confirm says) and
// for demo mode, with the server's own refusals and log wording.

/** Which way a conversion goes; the JSON value the endpoint takes. */
export type MysticFocusAction = 'SLOT_TO_FOCUS' | 'FOCUS_TO_SLOT';

/** The class resource key of a Monk's Focus Points. */
export const FOCUS_POINTS_KEY = 'focusPoints';

/** One conversion asked for from the sheet. */
export interface MysticFocusRequest {
  action: MysticFocusAction;
  slotLevel: number;
}

/** A conversion the rule allows: what the character has afterwards. */
export interface MysticFocusChange {
  ok: true;
  spellSlots: SpellSlots;
  classResources: Record<string, number>;
  /** The activity-log wording: "turned a level 2 spell slot into 2 Focus Points (…)". */
  description: string;
}

/** A conversion the rule refuses, as the server would: 400 can never work, 409 cannot work now. */
export interface MysticFocusRefusal {
  ok: false;
  status: 400 | 409;
  message: string;
}

/** True for a character with the Mystic Focus feature: a Warrior of the Mystic Arts of Monk level 6+. */
export function hasMysticFocus(pc: Pick<PC, 'clazz' | 'subclass' | 'level'> | null | undefined): boolean {
  return !!pc && isMysticArtsMonk(pc) && (pc.level ?? 1) >= MYSTIC_FOCUS_LEVEL;
}

const points = (n: number): string => `${n} Focus Point${n === 1 ? '' : 's'}`;
const refuse = (status: 400 | 409, message: string): MysticFocusRefusal => ({ ok: false, status, message });

/**
 * One Mystic Focus conversion, by the server's rule (MysticFocusRules.apply):
 *
 * - `SLOT_TO_FOCUS` spends one unspent slot of the level and regains as many
 *   expended Focus Points as the slot's level, never more than are expended.
 * - `FOCUS_TO_SLOT` spends unexpended Focus Points to get one expended slot of
 *   the level back: 2 for a level 1 slot, 3 for level 2 (Monk 7+), 5 for level 3
 *   (Monk 13+), 6 for level 4 (Monk 19+).
 *
 * Pure: returns what the character would have, or the refusal.
 */
export function applyMysticFocus(
  pc: PC, action: string | null | undefined, slotLevel: number | null | undefined,
): MysticFocusChange | MysticFocusRefusal {
  if (!hasMysticFocus(pc)) {
    return refuse(400, `Mystic Focus needs a Warrior of the Mystic Arts of Monk level ${MYSTIC_FOCUS_LEVEL} or higher`);
  }
  if (action !== 'SLOT_TO_FOCUS' && action !== 'FOCUS_TO_SLOT') {
    return refuse(400, 'action must be SLOT_TO_FOCUS or FOCUS_TO_SLOT');
  }
  if (!isMysticFocusSlotLevel(slotLevel)) {
    return refuse(400, `slotLevel must be a spell level from 1 to ${MYSTIC_FOCUS_MAX_SLOT_LEVEL}`);
  }
  const focus = classResourceStates(pc).find(r => r.key === FOCUS_POINTS_KEY);
  if (!focus) return refuse(400, 'This character has no Focus Points');

  const standing = (slots: SpellSlots, used: number): string => {
    const slot = slots[slotLevel];
    return `${slot.max - slot.used} of ${slot.max} slots left, ${focus.max - used} of ${focus.max} Focus Points`;
  };

  if (action === 'SLOT_TO_FOCUS') {
    const spellSlots = spendSlot(pc.spellSlots, slotLevel);
    if (!spellSlots) return refuse(409, `No level ${slotLevel} slot available`);
    if (focus.used <= 0) return refuse(409, 'No expended Focus Points to regain');
    const regained = Math.min(slotLevel, focus.used);
    const used = focus.used - regained;
    return {
      ok: true, spellSlots, classResources: withResourceUsed(pc, FOCUS_POINTS_KEY, used),
      description: `turned a level ${slotLevel} spell slot into ${points(regained)} (${standing(spellSlots, used)})`,
    };
  }

  const minLevel = mysticFocusMinLevel(slotLevel);
  if ((pc.level ?? 1) < minLevel) {
    return refuse(400, `Recovering a level ${slotLevel} spell slot needs Monk level ${minLevel}`);
  }
  const spellSlots = restoreSlot(pc.spellSlots, slotLevel);
  if (!spellSlots) return refuse(409, `No spent level ${slotLevel} slot to restore`);
  const cost = mysticFocusCost(slotLevel);
  if (focus.remaining < cost) {
    return refuse(409, `Recovering a level ${slotLevel} spell slot costs ${points(cost)}`);
  }
  const used = focus.used + cost;
  return {
    ok: true, spellSlots, classResources: withResourceUsed(pc, FOCUS_POINTS_KEY, used),
    description: `turned ${points(cost)} into a level ${slotLevel} spell slot (${standing(spellSlots, used)})`,
  };
}

// ── What the sheet offers ────────────────────────────────────────────────────

/** One conversion as a button on the sheet. */
export interface MysticFocusOption extends MysticFocusRequest {
  /** "1st" */
  label: string;
  /** What the button says is gained or spent: "+2" for a slot's Focus Points, "2" for a slot's cost. */
  amount: number;
  /** False when the rule refuses it right now; the button stays, disabled. */
  possible: boolean;
  /** Why it is refused, for the disabled button's tooltip; '' when it is possible. */
  reason: string;
  /** The confirm line: when the rule allows it, and exactly what is spent and gained. */
  confirm: string;
}

/** Everything the Mystic Focus block shows for one character. */
export interface MysticFocusView {
  focusLeft: number;
  focusMax: number;
  slotToFocus: MysticFocusOption[];
  focusToSlot: MysticFocusOption[];
}

/**
 * The Mystic Focus block for a character: one option each way for every spell
 * level (1 to 4) it has slots for. Null for a character without the feature.
 */
export function mysticFocusView(pc: PC | null | undefined): MysticFocusView | null {
  if (!pc || !hasMysticFocus(pc)) return null;
  const focus = classResourceStates(pc).find(r => r.key === FOCUS_POINTS_KEY);
  if (!focus) return null;
  const levels = slotLevels(pc.spellSlots).filter(l => l.level <= MYSTIC_FOCUS_MAX_SLOT_LEVEL);

  const option = (action: MysticFocusAction, slotLevel: number, amount: number, confirm: string): MysticFocusOption => {
    const outcome = applyMysticFocus(pc, action, slotLevel);
    return {
      action, slotLevel, label: ordinal(slotLevel), amount, confirm,
      possible: outcome.ok, reason: outcome.ok ? '' : outcome.message,
    };
  };

  return {
    focusLeft: focus.remaining,
    focusMax: focus.max,
    slotToFocus: levels.map(l => {
      const regained = Math.min(l.level, focus.used);
      const capped = regained < l.level ? ` (only ${regained} ${regained === 1 ? 'is' : 'are'} expended)` : '';
      return option('SLOT_TO_FOCUS', l.level, l.level,
        `Spend one ${ordinal(l.level)}-level spell slot to regain ${points(Math.max(regained, 0))}${capped}. `
        + 'The rule allows this at any time, with no action.');
    }),
    focusToSlot: levels.map(l => option('FOCUS_TO_SLOT', l.level, mysticFocusCost(l.level),
      `Spend ${points(mysticFocusCost(l.level))} to recover one ${ordinal(l.level)}-level spell slot. `
      + 'The rule allows this when you finish a Short Rest or use Uncanny Metabolism.')),
  };
}

/** What the slot strip says after a conversion, and the spell level it selects. */
export function mysticFocusNotice(request: MysticFocusRequest): SlotNotice {
  const slot = `One ${ordinal(request.slotLevel)}-level slot`;
  return {
    level: request.slotLevel,
    text: request.action === 'SLOT_TO_FOCUS' ? `${slot} turned into Focus Points.` : `${slot} recovered with Focus Points.`,
  };
}
