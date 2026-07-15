import { PC, PcItem, PcSurvival } from '../models/pc';
import { CampaignGameTime, TimeOfDay } from '../models/campaign';

// ── Darker Dungeons "Survival Conditions" (ch. 31) ──────────────────────────
// Pure stage math for campaigns with the survivalConditions variant rule.
// Stages run 0 (best) to 6 (worst); the passage of time worsens them and
// eating/drinking/sleeping improves them. Mirrors the server-side
// SurvivalRules/GameClock so demo mode behaves identically.

export type SurvivalKey = 'hunger' | 'thirst' | 'fatigue';

export const SURVIVAL_KEYS: SurvivalKey[] = ['hunger', 'thirst', 'fatigue'];

/** Stage labels, verbatim from the book's Survival Conditions table. */
export const SURVIVAL_LABELS: Record<SurvivalKey, string[]> = {
  hunger: ['Stuffed', 'Well-fed', 'Ok', 'Peckish', 'Hungry', 'Ravenous', 'Starving'],
  thirst: ['Quenched', 'Refreshed', 'Ok', 'Parched', 'Thirsty', 'Dry', 'Dehydrated'],
  fatigue: ['Energized', 'Well-rested', 'Ok', 'Tired', 'Sleepy', 'Very sleepy', 'Barely awake'],
};

export function clampStage(stage: number): number {
  return Math.max(0, Math.min(6, Math.round(stage)));
}

/**
 * A PC's stages; a never-tracked condition defaults to "Ok" (stage 2), the
 * table's neutral row — not "Stuffed" (0), which grants −1 exhaustion.
 * Mirrors the server's DEFAULT_STAGE.
 */
export const DEFAULT_STAGE = 2;

export function survivalOf(pc: PC): PcSurvival {
  return {
    hunger: clampStage(pc.survival?.hunger ?? DEFAULT_STAGE),
    thirst: clampStage(pc.survival?.thirst ?? DEFAULT_STAGE),
    fatigue: clampStage(pc.survival?.fatigue ?? DEFAULT_STAGE),
  };
}

export const SURVIVAL_STARTING_CHARGES = 5;

// ── Travel supplies: the container model ────────────────────────────────────
// Ration boxes and waterskins are CONTAINERS (1 bulk each, never auto-
// consumed); each holds 5 servings. The servings are separate charge lines —
// 'rations' (purchasable, 1 sp each) and 'water' (never sold; refilled free) —
// whose qty the survival clock decrements. Charges are weightless inside their
// containers and capped at containers × 5 everywhere. Mirrors the server's
// SurvivalSupplies so demo mode behaves identically.

/** One container (ration box / waterskin) holds this many servings. */
export const SERVINGS_PER_CONTAINER = 5;

/** The charge lines shown as tracks in the Supplies pane. */
export const SUPPLY_KEYS = ['rations', 'water'] as const;
export type SupplyKey = typeof SUPPLY_KEYS[number];

/** The container lines that set each charge track's capacity. */
export const SUPPLY_CONTAINER_KEYS = ['ration-box', 'waterskin'] as const;

/** Display labels for the two consumable charge tracks. */
export const SUPPLY_LABELS: Record<SupplyKey, string> = {
  rations: 'Rations',
  water: 'Water',
};

/** Which container holds each charge line. */
export const CONTAINER_FOR: Record<SupplyKey, string> = {
  rations: 'ration-box',
  water: 'waterskin',
};

/**
 * True for any supply line — charges (rations/water) or containers (ration
 * box/waterskin). These never render as ordinary inventory rows: the Supplies
 * pane shows charges as pips and containers as capacity.
 */
export function isSupplyItem(item: Pick<PcItem, 'catalogKey'>): boolean {
  return item.catalogKey === 'rations' || item.catalogKey === 'water'
      || item.catalogKey === 'ration-box' || item.catalogKey === 'waterskin';
}

/** Summed qty of every live line with this catalog key. */
function liveCount(inventory: PcItem[], catalogKey: string): number {
  return inventory
    .filter(i => i.catalogKey === catalogKey && i.status !== 'dropped')
    .reduce((sum, i) => sum + Math.max(0, i.qty ?? 0), 0);
}

/** Total servings a charge track can hold: its containers × 5. */
export function supplyCapacity(inventory: PcItem[], key: SupplyKey): number {
  return liveCount(inventory, CONTAINER_FOR[key]) * SERVINGS_PER_CONTAINER;
}

/** Servings currently in hand for a charge track. */
export function supplyCharges(inventory: PcItem[], key: SupplyKey): number {
  return liveCount(inventory, key);
}

/**
 * A supply line's bulk: each CONTAINER (ration box / waterskin) is 1 bulk;
 * the charges inside are weightless. A non-supply item contributes nothing
 * here (the caller bulks it normally).
 */
export function supplyBulk(item: PcItem): number {
  if (item.catalogKey === 'ration-box' || item.catalogKey === 'waterskin') {
    return Math.max(0, item.qty ?? 0);
  }
  return 0;
}

/** A fresh charge line for the pane/seed — mirrors the server's line shapes. */
export function supplyChargeLine(key: SupplyKey, qty: number): PcItem {
  return key === 'rations'
    ? { catalogKey: 'rations', name: 'Rations (1 day)', category: 'gear',
        qty, weight: 0.2, bulk: 0.2, unitCostCp: 10 }
    : { catalogKey: 'water', name: 'Water', category: 'gear', qty, weight: 0, bulk: 0 };
}

/** A fresh container line — 1 bulk each, never auto-consumed. */
function containerLine(catalogKey: string, name: string, costCp: number, qty: number): PcItem {
  return { catalogKey, name, category: 'gear', qty, weight: 1, bulk: 1, unitCostCp: costCp };
}

/**
 * Lazily migrate legacy (pre-container) supply data — mirror of the server's
 * SurvivalSupplies.normalize:
 * - no live ration-box line → add one (qty 1), the old model's implied free box;
 * - no live water line but a live waterskin line → the skin's qty WAS the
 *   water charges: move it to a new water line and turn the skin into
 *   max(1, ceil(oldQty / 5)) containers.
 * Returns a new array; the input is untouched.
 */
export function normalizeSupplies(inventory: PcItem[]): PcItem[] {
  const items = inventory.map(i => ({ ...i }));
  const live = (key: string) => items.find(i => i.catalogKey === key && i.status !== 'dropped');
  if (!live('ration-box')) {
    items.push(containerLine('ration-box', 'Ration box', 50, 1));
  }
  const skin = live('waterskin');
  if (skin && !live('water')) {
    const oldQty = Math.max(0, skin.qty ?? 0);
    items.push(supplyChargeLine('water', oldQty));
    skin.qty = Math.max(1, Math.ceil(oldQty / SERVINGS_PER_CONTAINER));
    skin.weight = 1;
    skin.bulk = 1;
  }
  return items;
}

/** Seed the starting kit: 1 ration box, 1 waterskin, 5 rations, 5 water. */
function seedSupplies(inventory: PcItem[]): PcItem[] {
  const items = inventory.map(i => ({ ...i }));
  const has = (key: string) => items.some(i => i.catalogKey === key && i.status !== 'dropped');
  if (!has('ration-box')) items.push(containerLine('ration-box', 'Ration box', 50, 1));
  if (!has('waterskin')) items.push(containerLine('waterskin', 'Waterskin', 20, 1));
  if (!has('rations')) items.push(supplyChargeLine('rations', SURVIVAL_STARTING_CHARGES));
  if (!has('water')) items.push(supplyChargeLine('water', SURVIVAL_STARTING_CHARGES));
  return items;
}

/**
 * Decrement one unit of the first live line with this key; returns
 * [items, consumed]. The line is KEPT at qty 0 — an empty box/skin persists
 * for refilling (no more line removal). Mirrors the server's tryConsume.
 */
function tryConsume(inventory: PcItem[], key: string): [PcItem[], boolean] {
  const items = inventory.map(i => ({ ...i }));
  const line = items.find(i => i.catalogKey === key && i.status !== 'dropped' && (i.qty ?? 0) > 0);
  if (!line) return [items, false];
  line.qty -= 1;
  return [items, true];
}

/**
 * Advance one PC by a day-segment — the demo/local mirror of the server. The
 * passage of time ALWAYS worsens the party (morning +1 hunger +1 thirst, noon
 * +1 fatigue, night +1 all three — two hunger/thirst bumps per day, at dawn
 * and at night); relief is the explicit Eat/Drink action
 * ({@link applyConsumeToPc}) and the DM long rest, never automatic. Legacy
 * supply lines are container-normalized first; starting supplies are seeded
 * once (seeded flag). Returns a new PC; the input is untouched.
 */
export function applySegmentToPc(pc: PC, segment: TimeOfDay): PC {
  let inventory: PcItem[] = normalizeSupplies(pc.inventory ?? []);
  if (pc.survival?.seeded !== true) inventory = seedSupplies(inventory);

  const s = survivalOf(pc);
  const htStep = segment === 'morning' || segment === 'night';
  const survival: PcSurvival = {
    hunger: htStep ? clampStage(s.hunger + 1) : s.hunger,
    thirst: htStep ? clampStage(s.thirst + 1) : s.thirst,
    fatigue: segment === 'noon' || segment === 'night' ? clampStage(s.fatigue + 1) : s.fatigue,
    seeded: true,
  };
  return { ...pc, inventory, survival };
}

// ── Player relief actions (Eat / Drink / Sleep) ─────────────────────────────

export type SurvivalAction = 'EAT' | 'DRINK' | 'SLEEP_GOOD' | 'SLEEP_DISTURBED';

/** Eat −1 hunger · drink −1 thirst · good sleep −3 fatigue · disturbed −1. */
export function applyAction(s: PcSurvival, action: SurvivalAction): PcSurvival {
  const out = { ...s };
  switch (action) {
    case 'EAT': out.hunger = clampStage(out.hunger - 1); break;
    case 'DRINK': out.thirst = clampStage(out.thirst - 1); break;
    case 'SLEEP_GOOD': out.fatigue = clampStage(out.fatigue - 3); break;
    case 'SLEEP_DISTURBED': out.fatigue = clampStage(out.fatigue - 1); break;
  }
  return out;
}

/**
 * Apply a consume action to a whole PC — the out-of-session (and demo) mirror
 * of the server's consume endpoint: EAT decrements a live 'rations' charge and
 * DRINK a live 'water' charge (lines kept at qty 0 for refilling; no charge
 * left still relieves the stage — the party can forage, the DM arbitrates).
 * The seeded flag is preserved. Returns a new PC; the input is untouched.
 */
export function applyConsumeToPc(pc: PC, action: SurvivalAction): PC {
  let inventory = pc.inventory ?? [];
  if (action === 'EAT') [inventory] = tryConsume(inventory, 'rations');
  if (action === 'DRINK') [inventory] = tryConsume(inventory, 'water');
  return {
    ...pc,
    inventory,
    survival: { ...applyAction(survivalOf(pc), action), seeded: pc.survival?.seeded },
  };
}

/**
 * DM long rest (demo/local mirror): restore every spell slot and, in a survival
 * campaign, shed fatigue — 3 for an undisturbed rest, 1 for a disturbed one.
 */
export function applyLongRestToPc(pc: PC, undisturbed: boolean, survivalOn: boolean): PC {
  const spellSlots = pc.spellSlots
    ? Object.fromEntries(Object.entries(pc.spellSlots).map(([lvl, slot]) => [lvl, { ...slot, used: 0 }]))
    : pc.spellSlots;
  if (!survivalOn) return { ...pc, spellSlots };
  const s = survivalOf(pc);
  return {
    ...pc,
    spellSlots,
    survival: { ...s, fatigue: clampStage(s.fatigue - (undisturbed ? 3 : 1)), seeded: pc.survival?.seeded },
  };
}

/**
 * Net exhaustion from survival conditions: +1 per condition at stage 5–6
 * (book max +3), −1 per condition at stage 0. Computed live for the badge —
 * never persisted, never written to pc.conditions.
 */
export function survivalExhaustion(s: PcSurvival): number {
  let net = 0;
  for (const key of SURVIVAL_KEYS) {
    if (s[key] >= 5) net += 1;
    else if (s[key] === 0) net -= 1;
  }
  return Math.max(-3, Math.min(3, net));
}

// ── The campaign game clock (mirror of the server's GameClock v2) ───────────
// Date parts are FREE TEXT the DM curates; advancing time only cycles the day
// segments. Weekday repetition drives the week counter.

export const TIME_SEGMENTS: TimeOfDay[] = ['morning', 'noon', 'night'];
export const MAX_TIME_LABEL = 40;

export function initialGameTime(): CampaignGameTime {
  return { year: '1', month: '1', day: '1', timeOfDay: 'morning',
           weekday: null, weekdaysSeen: [], week: 1 };
}

/**
 * Tolerant read of any stored clock, including the pre-v2 numeric shape
 * (numbers → strings, dawn → morning, dusk/night → night, week fields filled).
 */
export function normalizeGameTime(raw: unknown): CampaignGameTime | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const label = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : fallback;
  const segment: TimeOfDay =
    obj['timeOfDay'] === 'morning' || obj['timeOfDay'] === 'dawn' ? 'morning'
      : obj['timeOfDay'] === 'noon' ? 'noon'
      : 'night'; // night, dusk, or anything malformed
  const weekday = obj['weekday'];
  return {
    year: label(obj['year'], '1'),
    month: label(obj['month'], '1'),
    day: label(obj['day'], '1'),
    timeOfDay: segment,
    weekday: typeof weekday === 'string' && weekday.trim() ? weekday : null,
    weekdaysSeen: Array.isArray(obj['weekdaysSeen']) ? obj['weekdaysSeen'] : [],
    week: typeof obj['week'] === 'number' ? Math.max(1, Math.round(obj['week'])) : 1,
  };
}

/**
 * The next day's label, when the current one is numeric: "3" → "4" and "3rd" →
 * "4th" — ordinal in, correct ordinal out (11th/12th/13th included); bare
 * number in, bare number out. Labels the clock can't count ("Midwinter"), and
 * blanks, return unchanged: months are free text with unknown lengths, so the
 * DM stays in charge of those (and there is deliberately no month/year
 * rollover). Mirrors the server's GameClock.incrementDayLabel.
 */
export function incrementDayLabel(day: string): string {
  const m = /^(\d{1,8})(st|nd|rd|th)?$/i.exec(day?.trim() ?? '');
  if (!m) return day;
  const next = parseInt(m[1], 10) + 1;
  return m[2] ? `${next}${ordinalSuffix(next)}` : String(next);
}

/** st/nd/rd/th for a day number, with the 11th–13th special cases. */
function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * morning → noon → night → next day's MORNING. The rollover steps a numeric
 * day label forward ({@link incrementDayLabel}); the rest of the date is free
 * text the DM curates. With a defined week (`weekDays`), the rollover also
 * walks the weekday to the next defined name — wrapping past the last day
 * increments the week counter. A null or unknown current weekday (definition
 * edited mid-campaign) leaves the weekday AND week untouched. Mirrors the
 * server's GameClock.advanceSegment.
 */
export function advanceGameTime(t: CampaignGameTime, weekDays?: string[] | null): CampaignGameTime {
  const idx = TIME_SEGMENTS.indexOf(t.timeOfDay);
  const next = TIME_SEGMENTS[(idx + 1) % TIME_SEGMENTS.length];
  const advanced: CampaignGameTime = { ...t, timeOfDay: idx < 0 ? 'morning' : next };
  const newDay = idx === TIME_SEGMENTS.length - 1; // night wraps to the next morning
  if (newDay) {
    advanced.day = incrementDayLabel(t.day);
    if (weekDays?.length && t.weekday) {
      const dayIdx = weekDays.findIndex(d => d.toLowerCase() === t.weekday!.toLowerCase());
      if (dayIdx >= 0) {
        const nextIdx = (dayIdx + 1) % weekDays.length;
        advanced.weekday = weekDays[nextIdx];
        if (nextIdx === 0) advanced.week = t.week + 1; // wrapped — a week completed
      }
    }
  }
  return advanced;
}

/**
 * Apply the DM's set-date form to the clock (mirror of the server's setTime).
 * With a defined week: the weekday is canonicalized to the defined casing (the
 * current one kept when the form leaves it blank; an out-of-list entry is
 * ignored the same way the server 400s it), the week moves only when the form
 * carries an explicit number, and weekdaysSeen is frozen. Without a definition
 * it delegates to {@link registerWeekday} — byte-identical to today.
 */
export function setGameTime(
  current: CampaignGameTime,
  form: { year: string; month: string; day: string; timeOfDay: TimeOfDay;
          weekday: string | null; week?: number | null },
  weekDays?: string[] | null,
): CampaignGameTime {
  const dated: CampaignGameTime = {
    ...current, year: form.year, month: form.month, day: form.day, timeOfDay: form.timeOfDay,
  };
  if (!weekDays?.length) return registerWeekday(dated, form.weekday);
  const entered = form.weekday?.trim() || null;
  const canonical = entered
    ? weekDays.find(d => d.toLowerCase() === entered.toLowerCase()) ?? null
    : null;
  return {
    ...dated,
    weekday: canonical ?? current.weekday,
    week: form.week != null ? Math.max(1, Math.round(form.week)) : current.week,
  };
}

/**
 * Record the DM's weekday entry (mirror of the server's set-time week logic):
 * only a CHANGED weekday moves the history — re-entering one seen since the
 * last completed week ticks the counter and resets the history; a new name is
 * appended; resubmitting the same weekday (a date correction) does nothing.
 */
export function registerWeekday(t: CampaignGameTime, weekdayRaw: string | null): CampaignGameTime {
  const weekday = weekdayRaw?.trim() || null;
  if (!weekday || (t.weekday && weekday.toLowerCase() === t.weekday.toLowerCase())) {
    return { ...t, weekday: weekday ?? t.weekday };
  }
  const seenBefore = t.weekdaysSeen.some(d => d.toLowerCase() === weekday.toLowerCase());
  return seenBefore
    ? { ...t, weekday, weekdaysSeen: [weekday], week: t.week + 1 }
    : { ...t, weekday, weekdaysSeen: [...t.weekdaysSeen, weekday] };
}

/** "3rd · Hammer · 1492 DR — Morning · Far · Week 2" (blank parts skipped). */
export function describeGameTime(t: CampaignGameTime | null | undefined): string {
  if (!t) return 'Clock not set';
  const segment = t.timeOfDay.charAt(0).toUpperCase() + t.timeOfDay.slice(1);
  const date = [t.day, t.month, t.year].filter(p => p && p.trim()).join(' · ');
  const parts = [`${date} — ${segment}`];
  if (t.weekday) parts.push(t.weekday);
  if (t.week > 1) parts.push(`Week ${t.week}`);
  return parts.join(' · ');
}
