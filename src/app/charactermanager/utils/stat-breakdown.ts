import { PC } from '../models/pc';
import {
  ADJUSTMENT_LABEL_MAX, ADJUSTMENT_LINES_MAX, ADJUSTMENT_VALUE_MAX,
  AdjustableStat, BreakdownLine, SLOT_STATS, SlotStat, StatAdjustment, StatAdjustments, adjustmentSum,
  adjustmentsFor, countedSum, markRemoved, removalLabel, removedEntries, removedKey, removedLabelsFor,
  signed, slotStat,
} from '../models/stat-adjustment';
import { acAutoLines } from './armor-math';
import { ordinal, slotMaxOf, withSlotMax } from './spell-slots';

// ── How a calculated number is put together ─────────────────────────────────
// A number on the sheet = the lines the app works out by itself + the labelled
// lines a DM added. Anything in the saved total that neither explains (an older
// hand-typed value) is kept and shown as one "unlabelled" amount, so opening
// the breakdown never changes a number behind anyone's back. A DM may also take
// one of the app's own lines out of a number; it stays listed, marked as not
// counted, and can be put back.

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
  /** Whoever may adjust the number may also take its calculated lines out of the total. */
  removable?: boolean;
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
    removable: true,
    read: pc => pc.ac,
    write: (pc, total) => ({ ...pc, ac: total }),
  },
  ...(Object.fromEntries(SLOT_STATS.map((stat, i) => [stat, slotDefinition(i + 1)])) as Record<SlotStat, StatDefinition>),
};

export interface StatBreakdown {
  stat: AdjustableStat;
  /** Lines the app worked out, in the order they apply; a removed one is marked. */
  auto: BreakdownLine[];
  /** Lines the DM added. */
  adjustments: StatAdjustment[];
  /**
   * Labels of the calculated lines the DM removed, as stored. May name a line
   * that is not in `auto` right now (the armor came off); it is kept for when
   * the line comes back.
   */
  removed: string[];
  /** Part of the saved total no line explains; 0 when everything adds up. */
  unlabelled: number;
  /** The saved total: what the sheet, party board and tracker all show. */
  total: number;
}

/** Take a number apart into its automatic lines, DM lines and any unlabelled rest. */
export function breakdownOf(pc: PC, stat: AdjustableStat): StatBreakdown {
  const def = STAT_DEFINITIONS[stat];
  const removed = def.removable ? removedLabelsFor(pc, stat) : [];
  const auto = markRemoved(def.autoLines(pc), removed);
  const adjustments = adjustmentsFor(pc, stat);
  const explained = countedSum(auto) + adjustmentSum(adjustments);
  const total = def.read(pc) ?? explained;
  return { stat, auto, adjustments, removed, unlabelled: total - explained, total };
}

/** What else a save from the breakdown dialog can change besides the lines. */
export interface AdjustmentOptions {
  /**
   * The labels of the calculated lines that are out of the total from now on.
   * Leave it out to keep what is stored. Ignored for a number whose
   * definition does not allow removing lines.
   */
  removed?: string[];
}

/**
 * Replace a number's adjustment lines (and, when given, the set of removed
 * calculated lines) and bring its saved total along: a line taken out lowers
 * the total by exactly its amount, a line put back raises it again.
 * `keepUnlabelled` carries the unlabelled rest over unchanged; pass false once
 * the DM has dealt with it (removed it, or turned it into one of `lines`).
 * Pure: returns a new character, never mutates the one passed in.
 */
export function applyAdjustments(
  pc: PC, stat: AdjustableStat, lines: StatAdjustment[], keepUnlabelled: boolean,
  options: AdjustmentOptions = {},
): PC {
  const def = STAT_DEFINITIONS[stat];
  const before = breakdownOf(pc, stat);
  const cleaned = cleanAdjustments(lines);
  const stored: StatAdjustments = { ...(pc.statAdjustments ?? {}), [stat]: cleaned };
  if (def.removable && options.removed) {
    const removed = cleanRemoved(options.removed, def.autoLines(pc));
    if (removed.length) stored[removedKey(stat)] = removedEntries(removed);
    else delete stored[removedKey(stat)];
  }
  const next: PC = { ...pc, statAdjustments: stored };
  // The calculated lines are the ones the character had coming in: only which
  // of them count can change here. (A spell level's "Class table" line is read
  // off the saved maximum less the lines, so it must not see the new lines.)
  const removedNow = def.removable ? removedLabelsFor(next, stat) : [];
  const calculated = countedSum(markRemoved(def.autoLines(pc), removedNow));
  const total = calculated + adjustmentSum(cleaned) + (keepUnlabelled ? before.unlabelled : 0);
  return def.write(next, total);
}

/**
 * Removed labels as they are stored: trimmed, no blanks, and within the limit
 * one key may hold. Past the limit the oldest entries that match no line of
 * `current` go first, since those are the ones doing nothing.
 */
export function cleanRemoved(labels: string[], current: BreakdownLine[]): string[] {
  let cleaned = labels.map(removalLabel).filter(label => label.length > 0);
  const present = new Set(current.map(line => removalLabel(line.label)));
  while (cleaned.length > ADJUSTMENT_LINES_MAX) {
    const stale = cleaned.findIndex(label => !present.has(label));
    if (stale < 0) break;
    cleaned = cleaned.filter((_, i) => i !== stale);
  }
  return cleaned.slice(0, ADJUSTMENT_LINES_MAX);
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

/** "Dexterity", "Dexterity and Shield", "Plate, Dexterity and Shield". */
function listOf(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** What is in `a` and not in `b`, counting repeats. */
function without(a: string[], b: string[]): string[] {
  const rest = [...b];
  return a.filter(item => {
    const at = rest.indexOf(item);
    if (at < 0) return true;
    rest.splice(at, 1);
    return false;
  });
}

/**
 * The activity-log line for a DM changing a number's adjustment lines, e.g.
 * "DM added +1 Taunka to AC (AC 15 → 16)". Lines are matched by amount and
 * label together, so a relabel reads as one removed and one added. Taking a
 * calculated line out, or putting one back, is named as that:
 * "DM removed the calculated Dexterity line from AC (AC 17 → 15)".
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
  const takenOut = without(after.removed, before.removed);
  // An entry dropped because nothing matched it any more is not a line put back.
  const present = after.auto.map(line => removalLabel(line.label));
  const putBack = without(before.removed, after.removed).filter(name => present.includes(name));
  const lineWord = (names: string[]) => `the calculated ${listOf(names)} ${names.length > 1 ? 'lines' : 'line'}`;
  if (takenOut.length) parts.push(`removed ${lineWord(takenOut)} from ${label}`);
  if (putBack.length) parts.push(`restored ${lineWord(putBack)} on ${label}`);
  if (cleared) {
    parts.push(`cleared an unlabelled ${signed(before.unlabelled)} on ${label}`);
  }
  const what = parts.length ? parts.join('; ') : `updated the ${label} adjustments`;
  const totals = before.total !== after.total ? ` (${label} ${before.total} → ${after.total})` : '';
  return `DM ${what}${totals}`;
}
