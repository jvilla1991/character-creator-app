import { PC } from '../models/pc';
import {
  ABILITY_STATS, ADJUSTMENT_LABEL_MAX, ADJUSTMENT_LINES_MAX, ADJUSTMENT_VALUE_MAX,
  AbilityStat, AdjustableStat, BreakdownLine, SLOT_STATS, SkillStat, SlotStat, StatAdjustment, StatAdjustments,
  adjustmentSum, adjustmentsFor, countedSum, markRemoved, removalLabel, removedEntries, removedKey,
  removedLabelsFor, signed, skillStat, slotStat,
} from '../models/stat-adjustment';
import { acAutoLines, withAcFollowingDex } from './armor-math';
import { SKILL_DEFS, modFromScore, proficiencyForLevel, skillAutoLines, skillFullName } from './character-math';
import { capacityLines } from './slot-inventory';
import { ordinal, slotMaxOf, withSlotMax } from './spell-slots';

// ── How a calculated number is put together ─────────────────────────────────
// A number on the sheet = the lines the app works out by itself + the labelled
// lines a DM added. Anything in the saved total that neither explains (an older
// hand-typed value) is kept and shown as one "unlabelled" amount, so opening
// the breakdown never changes a number behind anyone's back. A DM may also take
// one of the app's own lines out of a number; it stays listed, marked as not
// counted, and can be put back.
//
// A number with no formula (an ability score) has one calculated line instead,
// its base: whatever the DM lines do not explain. So it always adds up, and
// never shows an unlabelled rest.

/**
 * What a number needs to take part: how to name it, the lines the app can work
 * out for it, and where its saved total lives on the character. Add an entry to
 * {@link STAT_DEFINITIONS} (and the name to `AdjustableStat`) to give another
 * number, such as speed, the same breakdown and DM lines.
 */
export interface StatDefinition {
  /** Dialog title: "Armor Class". */
  title: string;
  /** Short name used in log lines: "AC", "3rd-level slots". */
  label: string;
  /** The lines the app works out. Leave out for a number with no formula and give `baseLabel`. */
  autoLines?: (pc: PC) => BreakdownLine[];
  /**
   * For a number with no formula: the name of its single calculated line, which
   * holds whatever the DM lines do not explain ("Base score"). Part of that
   * base can be turned into a labelled line without moving the total.
   */
  baseLabel?: string;
  /** Whoever may adjust the number may also take its calculated lines out of the total. */
  removable?: boolean;
  /** The range the total has to stay in, when the rules set one. */
  min?: number;
  max?: number;
  /**
   * The number is a modifier (a skill's "+3"): its total and every line,
   * the first included, are shown with a sign.
   */
  modifier?: boolean;
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

const ABILITY_TITLES: Record<AbilityStat, string> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution',
  INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

/** A score the sheet shows when none was ever saved. */
const DEFAULT_ABILITY_SCORE = 10;

/**
 * An ability score: no formula, so a base plus the DM's lines. Modifiers,
 * saves, skills and spell numbers are worked out from the score when the sheet
 * is drawn, so they follow by themselves. Saved numbers do not, and two are
 * moved here: Armor Class and initiative follow a change to Dexterity. Hit
 * points are left alone when Constitution changes, as they are for every other
 * sheet edit.
 */
function abilityDefinition(ability: AbilityStat): StatDefinition {
  return {
    title: ABILITY_TITLES[ability],
    label: ability,
    baseLabel: 'Base score',
    min: 1,
    max: 30,
    read: pc => pc.stats?.[ability] ?? DEFAULT_ABILITY_SCORE,
    write: (pc, total) => {
      const scores = Object.fromEntries(ABILITY_STATS.map(key => [key, DEFAULT_ABILITY_SCORE])) as NonNullable<PC['stats']>;
      const next: PC = { ...pc, stats: { ...scores, ...(pc.stats ?? {}), [ability]: total } };
      return ability === 'DEX' ? withInitiativeFollowingDex(pc, withAcFollowingDex(pc, next)) : next;
    },
  };
}

/**
 * A skill's modifier. Nothing of it is saved but the DM's lines: the ability
 * modifier and the proficiency bonus are worked out from the sheet each time,
 * so the total is always exactly the lines and never shows an unlabelled rest.
 * Saving changes the lines and nothing else.
 */
function skillDefinition(name: string, ability: AbilityStat): StatDefinition {
  const title = skillFullName(name);
  const stat = skillStat(name);
  const autoLines = (pc: PC) => skillAutoLines(pc, name, ability);
  return {
    title,
    label: title,
    autoLines,
    modifier: true,
    read: pc => countedSum(autoLines(pc)) + adjustmentSum(adjustmentsFor(pc, stat)),
    write: pc => pc,
  };
}

/**
 * Move a saved initiative by however far the Dexterity modifier moved between
 * `before` and `after`, so the DM's lines and any unlabelled rest stay as they
 * were. Left alone when no initiative was ever saved.
 */
export function withInitiativeFollowingDex(before: PC, after: PC): PC {
  if (after.init == null) return after;
  const delta = modFromScore(after.stats?.DEX ?? 10) - modFromScore(before.stats?.DEX ?? 10);
  return delta === 0 ? after : { ...after, init: after.init + delta };
}

/** Initiative: the Dexterity modifier plus the DM's lines (an Alert feat, a magic item). */
const initiativeDefinition: StatDefinition = {
  title: 'Initiative',
  label: 'Initiative',
  autoLines: pc => [{ label: 'Dexterity', value: modFromScore(pc.stats?.DEX ?? 10) }],
  modifier: true,
  read: pc => pc.init,
  write: (pc, total) => ({ ...pc, init: total }),
};

/**
 * Speed, in feet. The sheet does not work it out (the wizard starts everyone
 * at 30), so it is a base plus the DM's lines, like an ability score: a Wood
 * Elf's extra 5 feet or a monk's Unarmored Movement is a line, or a labelled
 * part of the base.
 */
const speedDefinition: StatDefinition = {
  title: 'Speed',
  label: 'Speed',
  baseLabel: 'Base speed',
  min: 0,
  read: pc => pc.speed,
  write: (pc, total) => ({ ...pc, speed: total }),
};

/**
 * The proficiency bonus: the table for the character's level plus the DM's
 * lines. A level-up sets the saved bonus to the new table value plus the same
 * lines (the server and demo mode both do), so lines survive levelling.
 */
const proficiencyDefinition: StatDefinition = {
  title: 'Proficiency Bonus',
  label: 'Proficiency',
  autoLines: pc => [{ label: `Level ${pc.level ?? 1}`, value: proficiencyForLevel(pc.level ?? 1) }],
  modifier: true,
  min: 0,
  read: pc => pc.prof,
  write: (pc, total) => ({ ...pc, prof: total }),
};

/**
 * Inventory capacity under the Darker Dungeons slot rules. Worked out from
 * size and Strength whenever it is shown (see slotCapacity), so only the DM's
 * lines are saved and nothing is ever left unlabelled.
 */
const capacityDefinition: StatDefinition = {
  title: 'Slot Capacity',
  label: 'Slot capacity',
  autoLines: capacityLines,
  read: pc => countedSum(capacityLines(pc)) + adjustmentSum(adjustmentsFor(pc, 'capacity')),
  write: pc => pc,
};

export const STAT_DEFINITIONS: Record<AdjustableStat, StatDefinition> = {
  ac: {
    title: 'Armor Class',
    label: 'AC',
    autoLines: acAutoLines,
    removable: true,
    read: pc => pc.ac,
    write: (pc, total) => ({ ...pc, ac: total }),
  },
  init: initiativeDefinition,
  speed: speedDefinition,
  prof: proficiencyDefinition,
  capacity: capacityDefinition,
  STR: abilityDefinition('STR'),
  DEX: abilityDefinition('DEX'),
  CON: abilityDefinition('CON'),
  INT: abilityDefinition('INT'),
  WIS: abilityDefinition('WIS'),
  CHA: abilityDefinition('CHA'),
  ...(Object.fromEntries(SLOT_STATS.map((stat, i) => [stat, slotDefinition(i + 1)])) as Record<SlotStat, StatDefinition>),
  ...(Object.fromEntries(SKILL_DEFS.map(([name, ability]) =>
    [skillStat(name), skillDefinition(name, ability as AbilityStat)])) as Record<SkillStat, StatDefinition>),
};

/** How a number's total is written: "16" for Armor Class, "+3" for a skill. */
export function formatTotal(stat: AdjustableStat, total: number): string {
  return STAT_DEFINITIONS[stat].modifier ? signed(total) : String(total);
}

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

/**
 * The lines the app works out for a number, none marked as removed. A number
 * with no formula gets its one base line: the saved total less the DM lines.
 */
function calculatedLines(pc: PC, stat: AdjustableStat): BreakdownLine[] {
  const def = STAT_DEFINITIONS[stat];
  if (def.autoLines) return def.autoLines(pc);
  const base = (def.read(pc) ?? 0) - adjustmentSum(adjustmentsFor(pc, stat));
  return [{ label: def.baseLabel ?? 'Base', value: base }];
}

/** Take a number apart into its automatic lines, DM lines and any unlabelled rest. */
export function breakdownOf(pc: PC, stat: AdjustableStat): StatBreakdown {
  const def = STAT_DEFINITIONS[stat];
  const removed = def.removable ? removedLabelsFor(pc, stat) : [];
  const auto = markRemoved(calculatedLines(pc, stat), removed);
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
  /**
   * How much of the new lines came out of the base instead of adding to the
   * total ("label part of the base score"). Only means something for a number
   * with a base line; 0 when left out.
   */
  fromBase?: number;
}

/**
 * Replace a number's adjustment lines (and, when given, the set of removed
 * calculated lines) and bring its saved total along: a line taken out lowers
 * the total by exactly its amount, a line put back raises it again.
 * `keepUnlabelled` carries the unlabelled rest over unchanged; pass false once
 * the DM has dealt with it (removed it, or turned it into one of `lines`).
 * For a number with a base line the base stays what it was, less whatever
 * `fromBase` says was turned into lines, and the total is kept inside the
 * number's range. Pure: returns a new character, never mutates the one passed in.
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
    const removed = cleanRemoved(options.removed, calculatedLines(pc, stat));
    if (removed.length) stored[removedKey(stat)] = removedEntries(removed);
    else delete stored[removedKey(stat)];
  }
  const next: PC = { ...pc, statAdjustments: stored };
  // The calculated lines are the ones the character had coming in: only which
  // of them count can change here. (A spell level's "Class table" line and an
  // ability's base are both read off the saved total less the lines, so they
  // must not see the new lines.) A base also gives up whatever part of it was
  // turned into lines.
  const removedNow = def.removable ? removedLabelsFor(next, stat) : [];
  const calculated = countedSum(markRemoved(calculatedLines(pc, stat), removedNow))
    - (def.baseLabel ? options.fromBase ?? 0 : 0);
  const total = calculated + adjustmentSum(cleaned) + (keepUnlabelled ? before.unlabelled : 0);
  return def.write(next, withinRange(def, total));
}

function withinRange(def: StatDefinition, total: number): number {
  return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, total));
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

  // "Label part of the base score": lines came in and the base gave up exactly
  // what they are worth, so they name something the score already held.
  const baseGaveUp = countedSum(before.auto) - countedSum(after.auto);
  if (STAT_DEFINITIONS[stat].baseLabel && added.length && !removed.length
      && baseGaveUp !== 0 && baseGaveUp === adjustmentSum(added)) {
    const [first, ...rest] = added;
    const more = rest.map(line => `, ${signed(line.value)} as ${line.label}`).join('');
    return `DM labelled ${signed(first.value)} of the ${label} base score as ${first.label}${more}`;
  }

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
  const totals = before.total !== after.total
    ? ` (${label} ${formatTotal(stat, before.total)} → ${formatTotal(stat, after.total)})` : '';
  return `DM ${what}${totals}`;
}

/**
 * The activity-log line for a save from the breakdown dialog: what happened to
 * the number's lines, then any other saved number that moved with it (Armor
 * Class and initiative follow Dexterity), e.g.
 * "DM added +2 Belt of Dexterity to DEX (DEX 14 → 16); AC 15 → 16; Initiative +2 → +3".
 */
export function describeStatSave(stat: AdjustableStat, before: PC, after: PC): string {
  const line = describeAdjustmentChange(stat, breakdownOf(before, stat), breakdownOf(after, stat));
  const followed: string[] = [];
  if (stat !== 'ac' && before.ac != null && after.ac != null && before.ac !== after.ac) {
    followed.push(`AC ${before.ac} → ${after.ac}`);
  }
  if (stat !== 'init' && before.init != null && after.init != null && before.init !== after.init) {
    followed.push(`Initiative ${formatTotal('init', before.init)} → ${formatTotal('init', after.init)}`);
  }
  return [line, ...followed].join('; ');
}

/**
 * The lines a new character starts with: each increase the creation wizard put
 * on top of the rolled or assigned scores, labelled with where it came from
 * (the background's name). The scores themselves are not touched here; the
 * lines only say what part of each score is the increase, so a fresh character
 * opens as "Base score" plus these. Null when there is nothing to record.
 */
export function creationAbilityLines(
  increases: Array<[ability: string, amount: number]>, source: string,
): StatAdjustments | null {
  const label = removalLabel(source) || 'Background';
  const lines: StatAdjustments = {};
  for (const [ability, amount] of increases) {
    if (!ABILITY_STATS.includes(ability as AbilityStat)) continue;
    const key = ability as AbilityStat;
    const cleaned = cleanAdjustments([...(lines[key] ?? []), { value: amount, label }]);
    if (cleaned.length) lines[key] = cleaned;
  }
  return Object.keys(lines).length ? lines : null;
}
