export interface RenownFaction {
  id: number;
  parentId: number | null;
  name: string;
  score: number;
}

export const RENOWN_MILESTONES = [
  { name: 'Hated', min: -100, label: '−25 or lower', color: '#b94747' },
  { name: 'Hostile', min: -24, label: '−24 to −10', color: '#bd623d' },
  { name: 'Unfriendly', min: -9, label: '−9 to −3', color: '#a98232' },
  { name: 'Neutral', min: -2, label: '−2 to +2', color: '#9b905b' },
  { name: 'Friendly', min: 3, label: '+3 to +9', color: '#498650' },
  { name: 'Honored', min: 10, label: '+10 to +24', color: '#31897c' },
  { name: 'Revered', min: 25, label: '+25 to +49', color: '#3c7cab' },
  { name: 'Exalted', min: 50, label: '+50 to +100', color: '#8664b3' },
] as const;

export function renownStanding(score: number) {
  return [...RENOWN_MILESTONES].reverse().find(tier => score >= tier.min) ?? RENOWN_MILESTONES[0];
}

export function renownProgress(score: number): number {
  const tier = renownStanding(score);
  const next = RENOWN_MILESTONES[RENOWN_MILESTONES.indexOf(tier) + 1];
  return Math.max(0, Math.min(100, (score - tier.min) / ((next?.min ?? 100) - tier.min) * 100));
}
