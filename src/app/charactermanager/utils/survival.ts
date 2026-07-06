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

// ── Travel supplies (rations / water) ───────────────────────────────────────
// These two lines live in pc.inventory (so the survival clock can auto-consume
// them by decrementing qty), but the sheet treats them specially: they show as
// charges in the Supplies pane — like spell slots — and never count toward the
// slot-inventory bulk. The qty IS the number of servings left.

export const SUPPLY_KEYS = ['rations', 'waterskin'] as const;
export type SupplyKey = typeof SUPPLY_KEYS[number];

/** Display labels for the two auto-consumed travel supplies. */
export const SUPPLY_LABELS: Record<SupplyKey, string> = {
  rations: 'Ration box',
  waterskin: 'Water skin',
};

/** True for a rations/waterskin line — tracked as charges, excluded from bulk. */
export function isSupplyItem(item: Pick<PcItem, 'catalogKey'>): boolean {
  return item.catalogKey === 'rations' || item.catalogKey === 'waterskin';
}

/** Add a full Ration box and Water skin if a live line for each isn't present. */
function seedSupplies(inventory: PcItem[]): PcItem[] {
  const items = inventory.map(i => ({ ...i }));
  const has = (key: string) => items.some(i => i.catalogKey === key && i.status !== 'dropped');
  if (!has('rations')) {
    items.push({ catalogKey: 'rations', name: SUPPLY_LABELS.rations, category: 'gear',
      qty: SURVIVAL_STARTING_CHARGES, weight: 2, unitCostCp: 50 });
  }
  if (!has('waterskin')) {
    items.push({ catalogKey: 'waterskin', name: SUPPLY_LABELS.waterskin, category: 'gear',
      qty: SURVIVAL_STARTING_CHARGES, weight: 5, unitCostCp: 20 });
  }
  return items;
}

/** Decrement one unit of the first live line with this key; returns [items, consumed]. */
function tryConsume(inventory: PcItem[], key: string): [PcItem[], boolean] {
  const items = inventory.map(i => ({ ...i }));
  const line = items.find(i => i.catalogKey === key && i.status !== 'dropped' && (i.qty ?? 0) > 0);
  if (!line) return [items, false];
  if (line.qty === 1) return [items.filter(i => i !== line), true];
  line.qty -= 1;
  return [items, true];
}

/**
 * Advance one PC by a day-segment — the demo/local mirror of the server. The
 * party auto-eats/drinks their supplies: hunger and thirst hold while a
 * ration/water serving lasts and rise only when the box runs out; fatigue
 * always climbs on its steps. Starting supplies are seeded once (seeded flag).
 * Returns a new PC; the input is untouched.
 */
export function applySegmentToPc(pc: PC, segment: TimeOfDay): PC {
  let inventory: PcItem[] = pc.inventory ?? [];
  if (pc.survival?.seeded !== true) inventory = seedSupplies(inventory);

  const s = survivalOf(pc);
  const supplyStep = segment === 'morning' || segment === 'night';
  let ate = false;
  let drank = false;
  if (supplyStep) {
    [inventory, ate] = tryConsume(inventory, 'rations');
    [inventory, drank] = tryConsume(inventory, 'waterskin');
  }
  const survival: PcSurvival = {
    hunger: supplyStep && !ate ? clampStage(s.hunger + 1) : s.hunger,
    thirst: supplyStep && !drank ? clampStage(s.thirst + 1) : s.thirst,
    fatigue: segment === 'noon' || segment === 'night' ? clampStage(s.fatigue + 1) : s.fatigue,
    seeded: true,
  };
  return { ...pc, inventory, survival };
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeGameTime(raw: any): CampaignGameTime | null {
  if (!raw || typeof raw !== 'object') return null;
  const label = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : fallback;
  const segment: TimeOfDay =
    raw.timeOfDay === 'morning' || raw.timeOfDay === 'dawn' ? 'morning'
      : raw.timeOfDay === 'noon' ? 'noon'
      : 'night'; // night, dusk, or anything malformed
  return {
    year: label(raw.year, '1'),
    month: label(raw.month, '1'),
    day: label(raw.day, '1'),
    timeOfDay: segment,
    weekday: typeof raw.weekday === 'string' && raw.weekday.trim() ? raw.weekday : null,
    weekdaysSeen: Array.isArray(raw.weekdaysSeen) ? raw.weekdaysSeen : [],
    week: typeof raw.week === 'number' ? Math.max(1, Math.round(raw.week)) : 1,
  };
}

/** morning → noon → night → next day's MORNING; the date never changes here. */
export function advanceGameTime(t: CampaignGameTime): CampaignGameTime {
  const idx = TIME_SEGMENTS.indexOf(t.timeOfDay);
  const next = TIME_SEGMENTS[(idx + 1) % TIME_SEGMENTS.length];
  return { ...t, timeOfDay: idx < 0 ? 'morning' : next };
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
