export interface RenownFaction {
  id: number;
  parentId: number | null;
  name: string;
  score: number;
}

/** Colours are CSS custom properties defined on the renown panel's :host,
 *  built from theme tokens so each theme recolours the standings. */
export const RENOWN_MILESTONES = [
  { name: 'Hated', min: -100, max: -25, label: '−25 or lower', color: 'var(--renown-hated)' },
  { name: 'Hostile', min: -24, max: -10, label: '−24 to −10', color: 'var(--renown-hostile)' },
  { name: 'Unfriendly', min: -9, max: -3, label: '−9 to −3', color: 'var(--renown-unfriendly)' },
  { name: 'Neutral', min: -2, max: 2, label: '−2 to +2', color: 'var(--renown-neutral)' },
  { name: 'Friendly', min: 3, max: 9, label: '+3 to +9', color: 'var(--renown-friendly)' },
  { name: 'Honored', min: 10, max: 24, label: '+10 to +24', color: 'var(--renown-honored)' },
  { name: 'Revered', min: 25, max: 49, label: '+25 to +49', color: 'var(--renown-revered)' },
  { name: 'Exalted', min: 50, max: 100, label: '+50 to +100', color: 'var(--renown-exalted)' },
] as const;

export type RenownMilestone = typeof RENOWN_MILESTONES[number];

export function renownStanding(score: number): RenownMilestone {
  return [...RENOWN_MILESTONES].reverse().find(tier => score >= tier.min) ?? RENOWN_MILESTONES[0];
}

/** How many whole scores a standing covers (Neutral, −2…+2, covers 5). */
export function renownSpan(tier: RenownMilestone): number {
  return tier.max - tier.min + 1;
}

/** Fill within the current standing: 0% at its lowest score, 100% at its
 *  highest. Measuring to the highest score (not the next standing's floor)
 *  puts a standing's middle score at exactly half, e.g. Neutral 0 → 50%. */
export function renownProgress(score: number): number {
  const tier = renownStanding(score);
  return Math.max(0, Math.min(100, (score - tier.min) / (tier.max - tier.min) * 100));
}
