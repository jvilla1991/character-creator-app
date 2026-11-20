/** One line of a DM's batched renown save: move a faction's score by `delta`. */
export interface RenownChange { factionId: number; delta: number; }

export interface RenownFaction {
  id: number;
  parentId: number | null;
  name: string;
  score: number;
}

/** A campaign faction with no character's score attached: what the DM's
 *  session reward bar lists in its faction picker. */
export interface CampaignFaction {
  id: number;
  parentId: number | null;
  name: string;
}

/** Result of the DM's session-wide renown reward (mirrors the backend's
 *  RenownAwardResult): one entry per rewarded character. */
export interface RenownAwardEntry {
  pcId: number;
  name: string;
  score: number; // the character's score with the faction after the reward
  delta: number; // actual change applied (smaller than asked when clamped at -100 / 100)
}

export interface RenownAwardResult {
  awarded: RenownAwardEntry[];
}

/** Factions in picker order: each top-level faction followed by its
 *  subfactions, both in the order the DM created them. `child` marks a
 *  subfaction so the picker can indent it. A subfaction whose parent is
 *  missing from the list is kept, as a top-level row, rather than dropped. */
export function factionPickerRows<T extends CampaignFaction>(factions: T[]): { faction: T; child: boolean }[] {
  const ids = new Set(factions.map(f => f.id));
  const roots = factions.filter(f => f.parentId == null || !ids.has(f.parentId));
  return roots.flatMap(root => [
    { faction: root, child: false },
    ...factions.filter(f => f.parentId === root.id && f !== root).map(faction => ({ faction, child: true })),
  ]);
}

/** Colours are CSS custom properties defined on the renown panel's :host,
 *  built from theme tokens so each theme recolours the standings.
 *  `label` is the exact range (shown under each faction's meter);
 *  `threshold` and `note` fill the milestones table. */
export const RENOWN_MILESTONES = [
  { name: 'Hated', min: -100, max: -25, label: '−25 or lower', threshold: '−25', color: 'var(--renown-hated)',
    note: 'Other members of the faction will attempt to kill you on sight, but may seek you out to get the job done.' },
  { name: 'Hostile', min: -24, max: -10, label: '−24 to −10', threshold: '−10', color: 'var(--renown-hostile)',
    note: 'Other members of the faction will attempt to kill you on sight.' },
  { name: 'Unfriendly', min: -9, max: -3, label: '−9 to −3', threshold: '−3', color: 'var(--renown-unfriendly)',
    note: 'Other members of the faction are Unfriendly to you by default.' },
  { name: 'Neutral', min: -2, max: 2, label: '−2 to +2', threshold: '0', color: 'var(--renown-neutral)',
    note: 'The faction does not regard you one way or another.' },
  { name: 'Friendly', min: 3, max: 9, label: '+3 to +9', threshold: '3+', color: 'var(--renown-friendly)',
    note: 'Other members of the faction are Friendly to you by default.' },
  { name: 'Honored', min: 10, max: 24, label: '+10 to +24', threshold: '10+', color: 'var(--renown-honored)',
    note: 'You can purchase equipment found in the Player’s Handbook, as well as Common or Uncommon magic items, from merchants of the faction at a 10% discount.' },
  { name: 'Revered', min: 25, max: 49, label: '+25 to +49', threshold: '25+', color: 'var(--renown-revered)',
    note: 'Your discount increases to 15% and extends to Rare magic items.' },
  { name: 'Exalted', min: 50, max: 100, label: '+50 to +100', threshold: '50+', color: 'var(--renown-exalted)',
    note: 'Your discount increases to 25% and extends to Very Rare magic items.' },
] as const;

export type RenownMilestone = typeof RENOWN_MILESTONES[number];

export function renownStanding(score: number): RenownMilestone {
  return [...RENOWN_MILESTONES].reverse().find(tier => score >= tier.min) ?? RENOWN_MILESTONES[0];
}

/** The milestones bar draws −60…+60, not the full −100…+100 score range:
 *  the far ends of Hated and Exalted add nothing to read, and trimming them
 *  gives the narrow middle standings more room. Scores are unchanged. */
export const RENOWN_SCALE = { min: -60, max: 60 } as const;

const SCALE_SCORES = RENOWN_SCALE.max - RENOWN_SCALE.min + 1;

/** How many whole scores of a standing fall on the drawn scale
 *  (Neutral, −2…+2, covers 5; Hated is cut to −60…−25, 36). */
export function renownSpan(tier: RenownMilestone): number {
  return Math.min(tier.max, RENOWN_SCALE.max) - Math.max(tier.min, RENOWN_SCALE.min) + 1;
}

/** Where a standing begins, read outward from Neutral: −3, −10, −25 below
 *  and +3, +10, +25, +50 above. `percent` is that boundary's position on the
 *  drawn −60…+60 scale, where every whole score is one equal slice. `minor` marks
 *  the ±10 labels, which are dropped when the scale is too narrow to fit
 *  them between their neighbours. */
export interface RenownThreshold { value: number; percent: number; minor: boolean; }

export const RENOWN_THRESHOLDS: RenownThreshold[] = RENOWN_MILESTONES
  .filter(tier => tier.max < 0 || tier.min > 0)
  .map(tier => {
    const value: number = tier.max < 0 ? tier.max : tier.min;
    // A negative standing ends on its right edge; a positive one starts on its left.
    const edge = tier.max < 0 ? tier.max + 1 : tier.min;
    return { value, percent: (edge - RENOWN_SCALE.min) / SCALE_SCORES * 100, minor: Math.abs(value) === 10 };
  });

/** True for the standings below Neutral (Unfriendly, Hostile, Hated), whose
 *  meters fill from the right: losing renown pushes the fill leftward. */
export function renownFillsFromRight(score: number): boolean {
  return renownStanding(score).max < 0;
}

/** Fill within the current standing, measured away from Neutral: 0% on the
 *  score where you enter the standing, 100% on its far end. Above Neutral
 *  that is lowest → highest; below Neutral it runs the other way (−3 is the
 *  start of Unfriendly, −9 its end), drawn from the right by the panel.
 *  Neutral itself runs −2 → +2, so 0 sits at exactly half. */
export function renownProgress(score: number): number {
  const tier = renownStanding(score);
  const span = tier.max - tier.min;
  const into = tier.max < 0 ? tier.max - score : score - tier.min;
  return Math.max(0, Math.min(100, into / span * 100));
}
