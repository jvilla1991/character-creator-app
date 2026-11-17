import { PC } from './pc';

export type ProfessionKey = 'archaeology' | 'fishing' | 'herbalism' | 'mining' | 'skinning';
export interface ProfessionGrant { profession: ProfessionKey; }
export interface GatheringProfession {
  key: ProfessionKey;
  name: string;
  initials: string;
  requirement: string;
  tool?: string;
  check: string;
  summary: string;
  rules: string[];
}

export const GATHERING_PROFESSIONS: GatheringProfession[] = [
  {
    key: 'archaeology', name: 'Archaeology', initials: 'Ar', requirement: 'History proficiency',
    check: 'Intelligence (History)', summary: 'Uncover fragments and reconstruct relics of ancient Azeroth.',
    rules: [
      'Explore a DM-designated dig site for 1 hour, which can overlap a Short Rest. Make an Intelligence (History) check against the region DC. Success yields 1d6 fragments. Beating the DC by 5 yields a complete relic worth a rare regional resource instead. A natural 20 yields one magic fragment instead.',
      'Assemble six fragments of the same origin with a DC 15 Intelligence (History) check. The relic is worth a common resource for your character level, not the region level. After a failure, collect at least one more fragment of that origin before trying again.',
      'Six magic fragments of the same origin form a DM-chosen magic item, with rarity determined by your Proficiency Bonus. Archaeology fragments are not crafting resources.'
    ]
  },
  {
    key: 'fishing', name: 'Fishing', initials: 'Fi', requirement: 'No proficiency required',
    check: 'Wisdom (Survival)', summary: 'Forage for food, seek recipe fish, and discover unexpected treasure.',
    rules: [
      'Use the normal foraging rules to catch food. On a natural 20, the DM may award a chest, crate, or lockbox of other resources worth a rare resource for the region.',
      'To seek a particular recipe fish, make one Wisdom (Survival) check per journey stage against the region DC chosen by the DM.'
    ]
  },
  {
    key: 'herbalism', name: 'Herbalism', initials: 'He', requirement: 'Herbalism Kit proficiency', tool: 'Herbalism Kit',
    check: 'Wisdom (Survival)', summary: 'Gather herbs, flowers, and mushrooms for alchemy and inscription.',
    rules: ['Use the general journey gathering rules below. In unusual circumstances, the DM may allow rare resources to be harvested from Plant creatures using the skinning rules as a guideline.']
  },
  {
    key: 'mining', name: 'Mining', initials: 'Mi', requirement: "Mason’s Tools proficiency", tool: "Mason's Tools",
    check: 'Wisdom (Survival)', summary: 'Gather ores, stones, and gems for blacksmithing, engineering, and jewelcrafting.',
    rules: [
      'Use the general journey gathering rules below.',
      'For detailed recipes, smelt ore at a forge or refinery. Refining takes 1 hour per 10 GP of metal resource value: a 10 GP resource takes 1 hour; a 500 GP resource takes 50 hours. The same rules apply when combining metals into alloys.'
    ]
  },
  {
    key: 'skinning', name: 'Skinning', initials: 'Sk', requirement: 'Leatherworker’s Tools proficiency', tool: "Leatherworker's Tools",
    check: 'Wisdom (Survival)', summary: 'Harvest leather and hide from fallen creatures for leatherworking.',
    rules: [
      'Spend 10 minutes in the space of a dead Beast or animal-like Monstrosity, then make a Wisdom (Survival) check using Leatherworker’s Tools. Use the creature’s CR in place of region level; CR above 20 uses Endgame.',
      'Success yields one common-value leather resource. Beating the DC by 5 yields rare-value hide instead. Failure yields nothing.',
      'Animal-like Fiends require at least +3 Proficiency Bonus (journeyman); Dragons require at least +5 (artisan). Success with either yields rare-value hide.'
    ]
  }
];

export function meetsProfessionRequirement(pc: PC, profession: GatheringProfession): boolean {
  if (profession.key === 'archaeology') return ['prof', 'expert'].includes(pc.skills?.['History'] ?? '');
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[’‘]/g, "'");
  return !profession.tool || (pc.toolProfs ?? []).some(tool => normalize(tool) === normalize(profession.tool!));
}
