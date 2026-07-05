import { PC, PcSurvival } from '../models/pc';
import { CampaignGameTime, TimeOfDay } from '../models/campaign';

// ── Darker Dungeons "Survival Conditions" (ch. 31) ──────────────────────────
// Pure stage math for campaigns with the survivalConditions variant rule.
// Stages run 0 (best) to 6 (worst); the passage of time worsens them and
// eating/drinking/sleeping improves them. Mirrors the server-side
// SurvivalRules/GameClock so demo mode behaves identically.

export type SurvivalKey = 'hunger' | 'thirst' | 'fatigue';
export type SurvivalAction = 'EAT' | 'DRINK' | 'SLEEP_GOOD' | 'SLEEP_DISTURBED';

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

/**
 * The book's time-of-day table mapped onto the three-segment day: morning
 * takes dawn's +1 hunger +1 thirst, noon keeps +1 fatigue, night takes dusk's
 * +1 to all three (sleep happens during the night before the next morning).
 */
export function applyTimeBump(s: PcSurvival, timeOfDay: TimeOfDay): PcSurvival {
  const out = { ...s };
  if (timeOfDay === 'morning' || timeOfDay === 'night') {
    out.hunger = clampStage(out.hunger + 1);
    out.thirst = clampStage(out.thirst + 1);
  }
  if (timeOfDay === 'noon' || timeOfDay === 'night') {
    out.fatigue = clampStage(out.fatigue + 1);
  }
  return out;
}

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
 * of the server's consume endpoint: EAT decrements a live Rations inventory
 * line (line removed at zero; no line still relieves hunger), DRINK the same
 * with a Waterskin. Returns a new PC; the input is untouched.
 */
export function applyConsumeToPc(pc: PC, action: SurvivalAction): PC {
  let inventory = pc.inventory;
  if (action === 'EAT' || action === 'DRINK') {
    inventory = consumeLine(pc.inventory ?? [], action === 'EAT' ? 'rations' : 'waterskin');
  }
  return { ...pc, inventory, survival: applyAction(survivalOf(pc), action) };
}

function consumeLine(inventory: PC['inventory'], catalogKey: string): PC['inventory'] {
  const items = (inventory ?? []).map(i => ({ ...i }));
  const line = items.find(i =>
    i.catalogKey === catalogKey && i.status !== 'dropped' && (i.qty ?? 0) > 0);
  if (!line) return items;
  if (line.qty === 1) return items.filter(i => i !== line);
  line.qty -= 1;
  return items;
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
