import { PC } from '../models/pc';
import {
  ADJUSTMENT_LABEL_MAX, ADJUSTMENT_LINES_MAX, ADJUSTMENT_VALUE_MAX,
  AdjustableStat, SLOT_STATS, SlotStat, StatAdjustment, adjustmentSum, adjustmentsFor, signed, slotStat,
} from '../models/stat-adjustment';
import { BreakdownLine, acAutoLines } from './armor-math';
import { ordinal, slotMaxOf, withSlotMax } from './spell-slots';

// ── How a calculated number is put together ─────────────────────────────────
// A number on the sheet = the lines the app works out by itself + the labelled
// lines a DM added. Anything in the saved total that neither explains (an older
// hand-typed value) is kept and shown as one "unlabelled" amount, so opening
// the breakdown never changes a number behind anyone's back.

/**
 * What a number needs to take part: how to name it, the lines the app can work
 * out for it, and where its saved total lives on the character. Add an entry to
 * {@link STAT_DEFINITIONS} (and the name to `AdjustableStat`) to give another
 * number, such as an ability score or speed, the same breakdown and DM lines.
 */
export interface StatDefinition {
  /** Dialog title: "Armor Class". */
  title: string;
  /** Short name used in log lines: "AC", "3rd-level slots". */
  label: string;
  /** What the DM reads above the lines they can add: what belongs there, and what the lines survive. */
  adjustHint: string;
  autoLines: (pc: PC) => BreakdownLine[];
  read: (pc: PC) => number | undefined;
  write: (pc: PC, total: number) => PC;
}

/**
 * The slot maximum of one spell level. The server owns this number (class table
 * plus the DM's lines) and sends it back on every save, so the class-table line
 * is read off it: the saved maximum minus the lines. No rule table is consulted
 * here, and nothing is ever left over as "unlabelled".
 *
 * One blind spot follows from that: lines that take a level's maximum to zero
 * or below make the server drop the level, and from then on the class-table
 * line can only be read as "what the lines took away".
 */
function slotDefinition(spellLevel: number): StatDefinition {
  const stat = slotStat(spellLevel);
  return {
    title: `${ordinal(spellLevel)}-level spell slots`,
    label: `${ordinal(spellLevel)}-level slots`,
    adjustHint: 'Add slots the class table does not give, such as a magic item or a boon. '
      + 'These lines stay when the character levels up.',
    autoLines: pc => [{
      label: 'Class table',
      value: slotMaxOf(pc.spellSlots, spellLevel) - adjustmentSum(adjustmentsFor(pc, stat)),
    }],
    read: pc => slotMaxOf(pc.spellSlots, spellLevel),
    // What the server will answer with, so the sheet (and demo mode, which has
    // no server) shows the new maximum at once. The server ignores a sent max.
    write: (pc, total) => ({ ...pc, spellSlots: withSlotMax(pc.spellSlots, spellLevel, total) }),
  };
}

export const STAT_DEFINITIONS: Record<AdjustableStat, StatDefinition> = {
  ac: {
    title: 'Armor Class',
    label: 'AC',
    adjustHint: 'Add what the sheet does not work out, such as a species trait or a class feature. '
      + 'These lines stay when armor changes.',
    autoLines: acAutoLines,
    read: pc => pc.ac,
    write: (pc, total) => ({ ...pc, ac: total }),
  },
  ...(Object.fromEntries(SLOT_STATS.map((stat, i) => [stat, slotDefinition(i + 1)])) as Record<SlotStat, StatDefinition>),
};

export interface StatBreakdown {
  stat: AdjustableStat;
  /** Lines the app worked out, in the order they apply. */
  auto: BreakdownLine[];
  /** Lines the DM added. */
  adjustments: StatAdjustment[];
  /** Part of the saved total no line explains; 0 when everything adds up. */
  unlabelled: number;
  /** The saved total: what the sheet, party board and tracker all show. */
  total: number;
}

function sum(lines: BreakdownLine[]): number {
  return lines.reduce((total, line) => total + line.value, 0);
}

/** Take a number apart into its automatic lines, DM lines and any unlabelled rest. */
export function breakdownOf(pc: PC, stat: AdjustableStat): StatBreakdown {
  const def = STAT_DEFINITIONS[stat];
  const auto = def.autoLines(pc);
  const adjustments = adjustmentsFor(pc, stat);
  const explained = sum(auto) + adjustmentSum(adjustments);
  const total = def.read(pc) ?? explained;
  return { stat, auto, adjustments, unlabelled: total - explained, total };
}

/**
 * Replace a number's adjustment lines and bring its saved total along.
 * `keepUnlabelled` carries the unlabelled rest over unchanged; pass false once
 * the DM has dealt with it (removed it, or turned it into one of `lines`).
 * Pure: returns a new character, never mutates the one passed in.
 */
export function applyAdjustments(
  pc: PC, stat: AdjustableStat, lines: StatAdjustment[], keepUnlabelled: boolean,
): PC {
  const def = STAT_DEFINITIONS[stat];
  const before = breakdownOf(pc, stat);
  const cleaned = cleanAdjustments(lines);
  const total = sum(before.auto) + adjustmentSum(cleaned) + (keepUnlabelled ? before.unlabelled : 0);
  return def.write(
    { ...pc, statAdjustments: { ...(pc.statAdjustments ?? {}), [stat]: cleaned } },
    total,
  );
}

/** Whether a line is complete enough to save: a whole non-zero amount and a label. */
export function isValidAdjustment(line: StatAdjustment): boolean {
  return Number.isInteger(line.value)
    && line.value !== 0
    && Math.abs(line.value) <= ADJUSTMENT_VALUE_MAX
    && line.label.trim().length > 0
    && line.label.trim().length <= ADJUSTMENT_LABEL_MAX;
}

/** Trim labels and drop anything the server would refuse, so what is saved is what is shown. */
export function cleanAdjustments(lines: StatAdjustment[]): StatAdjustment[] {
  return lines
    .map(line => ({ value: line.value, label: (line.label ?? '').trim() }))
    .filter(isValidAdjustment)
    .slice(0, ADJUSTMENT_LINES_MAX);
}

/** "+1 Taunka" — one adjustment line as a log line and the read-only view word it. */
export function describeAdjustment(line: StatAdjustment): string {
  return `${signed(line.value)} ${line.label}`;
}

/**
 * The activity-log line for a DM changing a number's adjustment lines, e.g.
 * "DM added +1 Taunka to AC (AC 15 → 16)". Lines are matched by amount and
 * label together, so a relabel reads as one removed and one added.
 */
export function describeAdjustmentChange(
  stat: AdjustableStat, before: StatBreakdown, after: StatBreakdown,
): string {
  const { label } = STAT_DEFINITIONS[stat];
  const key = (line: StatAdjustment) => `${line.value}|${line.label}`;
  const remaining = before.adjustments.map(key);
  const added: StatAdjustment[] = [];
  for (const line of after.adjustments) {
    const at = remaining.indexOf(key(line));
    if (at >= 0) remaining.splice(at, 1); else added.push(line);
  }
  const removedKeys = [...remaining];
  const removed = before.adjustments.filter(line => {
    const at = removedKeys.indexOf(key(line));
    if (at < 0) return false;
    removedKeys.splice(at, 1);
    return true;
  });

  // "Label it": the unlabelled amount came back as exactly one new line.
  const cleared = before.unlabelled !== 0 && after.unlabelled === 0;
  if (cleared && !removed.length && added.length === 1 && added[0].value === before.unlabelled
      && before.total === after.total) {
    return `DM labelled ${signed(before.unlabelled)} on ${label} as ${added[0].label}`;
  }

  const parts: string[] = [];
  if (added.length) parts.push(`added ${added.map(describeAdjustment).join(', ')} to ${label}`);
  if (removed.length) parts.push(`removed ${removed.map(describeAdjustment).join(', ')} from ${label}`);
  if (cleared) {
    parts.push(`cleared an unlabelled ${signed(before.unlabelled)} on ${label}`);
  }
  const what = parts.length ? parts.join('; ') : `updated the ${label} adjustments`;
  const totals = before.total !== after.total ? ` (${label} ${before.total} → ${after.total})` : '';
  return `DM ${what}${totals}`;
}
