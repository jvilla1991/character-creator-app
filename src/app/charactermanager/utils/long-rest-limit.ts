import { TimeOfDay } from '../models/campaign';
import { LongRestWaitView } from '../models/session';

/**
 * "One long rest every 24 hours", counted on the campaign clock — the client
 * mirror of the server's `LongRestClock`. In a live session the server works
 * this out and sends it on the snapshot (`longRestWait`); these functions feed
 * demo mode and give the DM's hint its extra sentence.
 *
 * The clock has three segments a day and free-text dates, so the campaign
 * keeps a small record of its last FINISHED long rest: the segment it finished
 * in and how many segments the clock has moved since. A long rest takes eight
 * hours, so the next one may start once two segments have passed.
 */
export interface LastLongRest {
  timeOfDay: TimeOfDay;
  segmentsSince: number;
}

const SEGMENTS: TimeOfDay[] = ['morning', 'noon', 'night'];

/** Segments that must pass after a long rest finishes before the next may start. */
export const LONG_REST_SEGMENTS_BETWEEN = 2;

export function longRestFinishedAt(timeOfDay: TimeOfDay): LastLongRest {
  return { timeOfDay, segmentsSince: 0 };
}

/** The record after the clock moved `segments` forward (it stops counting once the wait is over). */
export function tickLongRest(record: LastLongRest | null, segments = 1): LastLongRest | null {
  if (!record) return null;
  return {
    ...record,
    segmentsSince: Math.min(LONG_REST_SEGMENTS_BETWEEN, record.segmentsSince + Math.max(0, segments)),
  };
}

/** How many segments forward one time of day is from another (morning → night is two; same is none). */
export function segmentsForward(from: TimeOfDay, to: TimeOfDay): number {
  const a = SEGMENTS.indexOf(from);
  const b = SEGMENTS.indexOf(to);
  return a < 0 || b < 0 ? 0 : (b - a + SEGMENTS.length) % SEGMENTS.length;
}

/** What the party is still waiting for, or null when a long rest may start. */
export function longRestWaitFor(record: LastLongRest | null, now: TimeOfDay | null | undefined): LongRestWaitView | null {
  if (!record || !now || !SEGMENTS.includes(now)) return null;
  const left = LONG_REST_SEGMENTS_BETWEEN - record.segmentsSince;
  if (left <= 0) return null;
  const finishedAt = SEGMENTS.includes(record.timeOfDay) ? record.timeOfDay : now;
  const target = SEGMENTS.indexOf(now) + left;
  const tomorrow = target >= SEGMENTS.length;
  const availableAt = SEGMENTS[target % SEGMENTS.length];
  // The clock rolled into a new day since the rest finished.
  const yesterday = record.segmentsSince > 0 && SEGMENTS.indexOf(now) < SEGMENTS.indexOf(finishedAt);
  return {
    finishedTimeOfDay: finishedAt,
    segmentsSince: record.segmentsSince,
    segmentsLeft: left,
    availableTimeOfDay: availableAt,
    availableTomorrow: tomorrow,
    reason: `The party finished a long rest ${finishedPhrase(finishedAt, yesterday)}. `
      + `The next one can start ${availablePhrase(availableAt, tomorrow)}.`,
  };
}

function finishedPhrase(at: TimeOfDay, yesterday: boolean): string {
  if (at === 'morning') return yesterday ? 'yesterday morning' : 'this morning';
  if (at === 'noon') return yesterday ? 'yesterday at noon' : 'at noon';
  return yesterday ? 'last night' : 'tonight';
}

function availablePhrase(at: TimeOfDay, tomorrow: boolean): string {
  if (at === 'morning') return tomorrow ? 'tomorrow morning' : 'this morning';
  if (at === 'noon') return tomorrow ? 'tomorrow at noon' : 'at noon';
  return tomorrow ? 'tomorrow night' : 'tonight';
}

/** The DM's version of the reason: the same sentence, plus how to move on. */
export function dmLongRestWaitHint(wait: LongRestWaitView): string {
  return `${wait.reason} Advance the clock, or set a later time of day, to move on.`;
}
