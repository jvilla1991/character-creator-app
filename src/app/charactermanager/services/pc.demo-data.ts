// ---------------------------------------------------------------------------
// Demo-mode fixtures and shims for PCService.
//
// Everything here is DEMO-ONLY — it exists so the UI can be exercised without a
// backend. None of it is the rules authority: the real D&D engine lives in the
// manager-service (LevelUpService / ClassProgression / catalogs). These pure
// functions and tables mirror just enough to render a believable demo. Keep them
// in sync with the server tables if you rely on the demo for slot/feat checks.
//
// Relocated out of pc.service.ts so the service reads as CRUD/HTTP logic only;
// the seed data and demo math are never co-edited with the service methods.
// ---------------------------------------------------------------------------

import { PC } from '../models/pc';
import { hitDieFor, modFromScore } from '../utils/character-math';

// ---------------------------------------------------------------------------
// Demo seed data — 3 fully-detailed PCs bound across both demo campaigns.
// Source: design_handoff_arcane_redesign/prototype/data.js
// ---------------------------------------------------------------------------
export const DEMO_PCS: PC[] = [
  {
    id: 1,
    name: 'Lyra Moonwhisper',
    playerName: 'Alice',
    player: 'Alice',
    campaignId: 'veiled',
    race: 'Half-Elf',
    clazz: 'Bard',
    subclass: 'College of Whispers',
    level: 7,
    background: 'Spy',
    alignment: 'Chaotic Good',
    portraitInitials: 'LM',
    portraitTint: 'celestial',
    hp: { cur: 42, max: 52, temp: 4 },
    ac: 15, init: 4, speed: 30, prof: 3,
    stats: { STR: 8, DEX: 18, CON: 14, INT: 13, WIS: 12, CHA: 18 },
    saves: ['DEX', 'CHA'],
    skills: { Deception: 'expert', Persuasion: 'expert', Insight: 'prof', Stealth: 'prof', Investigation: 'prof', Performance: 'prof' },
    conditions: [],
    coins: { cp: 12, sp: 48, ep: 0, gp: 234, pp: 3 },
    spellSlots: { 1: { max: 4, used: 2 }, 2: { max: 3, used: 1 }, 3: { max: 3, used: 0 }, 4: { max: 1, used: 0 } },
    spells: [
      { lvl: 0, name: 'Vicious Mockery', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Healing Word', school: 'Evocation', time: '1 bonus action', prepared: true },
      { lvl: 2, name: 'Suggestion', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 2, name: 'Detect Thoughts', school: 'Divination', time: '1 action', prepared: true },
      { lvl: 3, name: 'Hypnotic Pattern', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 3, name: 'Counterspell', school: 'Abjuration', time: '1 reaction', prepared: true },
      { lvl: 4, name: 'Greater Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: "Rapier of the Last Lullaby", magic: true, dmg: '1d8+4 piercing', notes: '+1, sleep on crit' },
      { name: 'Hand Crossbow', dmg: '1d6+4 piercing', notes: '80/320 ft' },
      { name: 'Dagger', dmg: '1d4+4 piercing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Studded Leather Armor', equipped: true },
      { name: 'Cloak of Many Faces', magic: true, equipped: true, notes: 'attunement' },
      { name: 'Lute (silvered)', equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Disguise Kit' },
      { name: 'Forgery Kit' },
      { name: 'Potion of Healing ×3' },
    ],
    features: [
      { name: 'Bardic Inspiration (d8)', source: 'Bard 5', desc: 'Bonus action; 4 uses per long rest.' },
      { name: 'Psychic Blades', source: 'Whispers 3', desc: 'Once per turn, +3d6 psychic damage when you hit with a weapon.' },
      { name: 'Words of Terror', source: 'Whispers 3', desc: 'After 1 minute of conversation, target Wis save or be frightened for 1 hour.' },
      { name: 'Jack of All Trades', source: 'Bard 2', desc: '+1 to ability checks not already proficient.' },
    ],
    traits: {
      Personality: 'Speaks in riddles when nervous; collects buttons from every city she visits.',
      Ideals: 'Truth is the rarest poison.',
      Bonds: 'Owes the Veiled Compass a debt sealed in blood ink.',
      Flaws: 'Cannot resist eavesdropping, even when it endangers the mission.',
    },
    bio: 'Born in the river-port of Vellow, Lyra learned cipher-songs from her grandmother before she could read. She joined the Compass at sixteen — first as a courier, now as something colder. The party knows her as a bard. Three of them suspect more.',
    notes: 'Owes the Crimson Lantern 60gp. Has a contact in Neverwinter named Olivar.',
  },
  {
    id: 2,
    name: 'Throk Ironjaw',
    playerName: 'Ben',
    player: 'Ben',
    campaignId: 'veiled',
    race: 'Half-Orc',
    clazz: 'Barbarian',
    subclass: 'Path of the Totem (Bear)',
    level: 7,
    background: 'Outlander',
    alignment: 'Neutral Good',
    portraitInitials: 'TI',
    portraitTint: 'crimson',
    hp: { cur: 78, max: 84, temp: 0 },
    ac: 16, init: 2, speed: 40, prof: 3,
    stats: { STR: 18, DEX: 14, CON: 17, INT: 8, WIS: 12, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Athletics: 'expert', Survival: 'prof', Perception: 'prof', Intimidation: 'prof', Nature: 'prof' },
    conditions: ['raging'],
    coins: { cp: 4, sp: 12, ep: 0, gp: 89, pp: 0 },
    spellSlots: {},
    spells: [],
    weapons: [
      { name: "Greataxe 'Splitter'", magic: true, dmg: '1d12+5 slashing', notes: '+1, brutal critical' },
      { name: 'Handaxes (4)', dmg: '1d6+4 slashing', notes: '20/60 ft (thrown)' },
    ],
    gear: [
      { name: 'Hide Armor', equipped: true },
      { name: 'Bear Totem Cloak', magic: true, equipped: true, notes: 'resistance to all damage during rage' },
      { name: "Hunter's Trap (3)" },
      { name: 'Bedroll' },
      { name: 'Trophy Necklace', notes: 'tooth of the Shadow-Bear' },
    ],
    features: [
      { name: 'Rage', source: 'Barbarian 1', desc: 'Bonus action; 4 uses per long rest. +3 dmg, advantage on STR.' },
      { name: 'Bear Aspect', source: 'Totem 3', desc: 'Resistance to all damage except psychic while raging.' },
      { name: 'Reckless Attack', source: 'Barbarian 2', desc: 'Trade defense for advantage on STR attacks.' },
      { name: 'Feral Instinct', source: 'Barbarian 7', desc: "Advantage on initiative. Surprise doesn't stop you from raging." },
    ],
    traits: {
      Personality: 'Speaks rarely. When he does, listen.',
      Ideals: 'The pack survives, or no one does.',
      Bonds: 'Sworn to avenge his clan, slain by the Shadow-Bear cult.',
      Flaws: 'Cannot abide cages of any kind — including cities, contracts, or kindness.',
    },
    bio: 'The last of the Ironjaw clan. Walks south because that is where the cult fled. Travels with the Compass because Lyra found him bleeding outside Phandalin and didn\'t ask questions.',
    notes: '',
  },
  {
    id: 5,
    name: 'Pip Underfoot',
    playerName: 'Eve',
    player: 'Eve',
    campaignId: 'tomb',
    race: 'Halfling (Lightfoot)',
    clazz: 'Rogue',
    subclass: 'Arcane Trickster',
    level: 5,
    background: 'Criminal',
    alignment: 'Chaotic Good',
    portraitInitials: 'PU',
    portraitTint: 'emerald',
    hp: { cur: 34, max: 38, temp: 0 },
    ac: 16, init: 5, speed: 25, prof: 3,
    stats: { STR: 8, DEX: 20, CON: 14, INT: 14, WIS: 12, CHA: 13 },
    saves: ['DEX', 'INT'],
    skills: { Stealth: 'expert', Sleight: 'expert', Acrobatics: 'prof', Perception: 'prof', Investigation: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 412, pp: 6 },
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 0 } },
    spells: [
      { lvl: 0, name: 'Mage Hand', school: 'Conjuration', time: '1 action', prepared: true },
      { lvl: 0, name: 'Minor Illusion', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 0, name: 'Prestidigitation', school: 'Transmutation', time: '1 action', prepared: true },
      { lvl: 1, name: 'Charm Person', school: 'Enchantment', time: '1 action', prepared: true },
      { lvl: 1, name: 'Disguise Self', school: 'Illusion', time: '1 action', prepared: true },
      { lvl: 1, name: 'Find Familiar', school: 'Conjuration', time: '1 hour', prepared: true },
      { lvl: 2, name: 'Invisibility', school: 'Illusion', time: '1 action', prepared: true },
    ],
    weapons: [
      { name: "Shortsword 'Whisper'", magic: true, dmg: '1d6+5 piercing', notes: '+1, silent' },
      { name: 'Shortbow', dmg: '1d6+5 piercing', notes: '80/320 ft' },
    ],
    gear: [
      { name: 'Studded Leather', equipped: true },
      { name: 'Cloak of Elvenkind', magic: true, equipped: true },
      { name: "Thieves' Tools" },
      { name: 'Caltrops (10)' },
      { name: 'Lockpicks (silvered)' },
    ],
    features: [
      { name: 'Sneak Attack', source: 'Rogue 1', desc: '+3d6 once per turn with advantage or ally adjacent.' },
      { name: 'Cunning Action', source: 'Rogue 2', desc: 'Bonus action: Dash, Disengage, or Hide.' },
      { name: 'Mage Hand Legerdemain', source: 'Trickster 3', desc: 'Invisible hand can pick pockets and locks.' },
      { name: 'Uncanny Dodge', source: 'Rogue 5', desc: 'Halve damage from an attack you can see.' },
    ],
    traits: {
      Personality: 'Always smiling. Especially when lying.',
      Ideals: 'Property is theft. So I\'m just balancing the books.',
      Bonds: 'The orphans on Brick Lane. They eat first.',
      Flaws: 'Cannot leave a locked door alone.',
    },
    bio: 'Lifted his first purse at six. Lifted his first relic at sixteen. The Sleeping Crown wants its third lifting, and Pip is the only halfling small enough to fit the keyhole.',
    notes: 'Familiar: Ash (raven). Bounty in three cities.',
  },
];

// ---------------------------------------------------------------------------
// Demo-mode level-up shim — pure helpers.
//
// UI-only mock so the modal can be exercised without a backend. This is NOT the
// rules engine — the authoritative D&D math lives server-side. It mirrors just
// enough (fixed-average HP, proficiency bonus, slot/feat/spell tables) to render
// a believable demo, and reuses the existing display-math helpers rather than
// holding its own. The stateful orchestration (computeDemoPreview / applyDemoLevelUp)
// stays in PCService — only the pure functions live here.
// ---------------------------------------------------------------------------

export function demoProfBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

export function demoLevelUpFields(pc: PC) {
  const current = pc.level ?? 1;
  const hitDie = hitDieFor(pc.clazz);
  const conMod = modFromScore(pc.stats?.CON ?? 10);
  const hpGained = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  return { current, newLevel: current + 1, hitDie, conMod, hpGained };
}

// DEMO-ONLY mirror of the server's ClassProgression spell-slot tables. Lives here purely so
// the modal can show slot growth without a backend; production never reads it (the real tables
// are server-side). Keep in sync with ClassProgression if you rely on the demo for slot checks.
const DEMO_FULL_CASTERS = new Set(['bard', 'cleric', 'druid', 'sorcerer', 'wizard']);
const DEMO_FULL_CASTER_SLOTS: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const DEMO_PACT_SLOTS: [number, number][] = [
  [1, 1], [1, 2], [2, 2], [2, 2], [3, 2], [3, 2], [4, 2], [4, 2], [5, 2], [5, 2],
  [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 3], [5, 4], [5, 4], [5, 4], [5, 4],
];

export function demoSlotsFor(clazz: string, level: number): { [lvl: number]: number } {
  const key = (clazz ?? '').trim().toLowerCase();
  const idx = Math.min(Math.max(level, 1), 20) - 1;
  const out: { [lvl: number]: number } = {};
  if (DEMO_FULL_CASTERS.has(key)) {
    DEMO_FULL_CASTER_SLOTS[idx].forEach((max, i) => { if (max > 0) out[i + 1] = max; });
  } else if (key === 'warlock') {
    const [slotLevel, count] = DEMO_PACT_SLOTS[idx];
    out[slotLevel] = count;
  }
  return out;
}

export function demoCurrentMaxSlots(pc: PC): { [lvl: number]: number } {
  const out: { [lvl: number]: number } = {};
  Object.entries(pc.spellSlots ?? {}).forEach(([lvl, slot]) => { out[Number(lvl)] = slot.max; });
  return out;
}

// DEMO-ONLY mirror of the server subclass grant levels (sorcerer/warlock = 1, else = 3).
// The subclass catalog is empty server-side (mechanism only), so the demo offers no options
// either — the picker never shows. Kept for parity if catalog content is added later.
export function demoSubclassLevel(clazz: string): number {
  return ['sorcerer', 'warlock'].includes((clazz ?? '').trim().toLowerCase()) ? 1 : 3;
}

// DEMO-ONLY mirror of the server SUBCLASS_CATALOG (2024 PHB subclass names).
const DEMO_SUBCLASSES: { [clazz: string]: string[] } = {
  barbarian: ['Path of the Berserker', 'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot'],
  bard: ['College of Dance', 'College of Glamour', 'College of Lore', 'College of Valor'],
  cleric: ['Life Domain', 'Light Domain', 'Trickery Domain', 'War Domain'],
  druid: ['Circle of the Land', 'Circle of the Moon', 'Circle of the Sea', 'Circle of the Stars'],
  fighter: ['Battle Master', 'Champion', 'Eldritch Knight', 'Psi Warrior'],
  monk: ['Warrior of Mercy', 'Warrior of Shadow', 'Warrior of the Elements', 'Warrior of the Open Hand'],
  paladin: ['Oath of Devotion', 'Oath of Glory', 'Oath of the Ancients', 'Oath of Vengeance'],
  ranger: ['Beast Master', 'Fey Wanderer', 'Gloom Stalker', 'Hunter'],
  rogue: ['Arcane Trickster', 'Assassin', 'Soulknife', 'Thief'],
  wizard: ['Abjurer', 'Diviner', 'Evoker', 'Illusionist'],
};

export function demoSubclassOptions(clazz: string): string[] {
  return DEMO_SUBCLASSES[(clazz ?? '').trim().toLowerCase()] ?? [];
}

// DEMO-ONLY mirror of the server ASI levels (default 4/8/12/16/19; Fighter +6/14; Rogue +10).
export function demoIsAsiLevel(clazz: string, level: number): boolean {
  const key = (clazz ?? '').trim().toLowerCase();
  const levels = key === 'fighter' ? [4, 6, 8, 12, 14, 16, 19]
    : key === 'rogue' ? [4, 8, 10, 12, 16, 19]
      : [4, 8, 12, 16, 19];
  return levels.includes(level);
}

// DEMO-ONLY mirror of the server general-feat catalog (FeatCatalog), sorted.
export const DEMO_GENERAL_FEATS = [
  'Great Weapon Master', 'Inspiring Leader', 'Mage Slayer', 'Polearm Master', 'Resilient',
  'Sentinel', 'Sharpshooter', 'Skill Expert', 'Speedy', 'War Caster',
];

// DEMO-ONLY mirror of the server cantrips-known formula (base +1 at L4 +1 at L10).
export function demoCantripsKnown(clazz: string, level: number): number {
  const base: { [k: string]: number } = {
    bard: 2, cleric: 3, druid: 2, sorcerer: 4, warlock: 2, wizard: 3,
  };
  const b = base[(clazz ?? '').trim().toLowerCase()];
  if (b === undefined || level < 1) return 0;
  return b + (level >= 4 ? 1 : 0) + (level >= 10 ? 1 : 0);
}

// DEMO-ONLY mirror of the server prepared/known-spell tables (full-caster vs warlock pact).
const DEMO_FULL_PREPARED =
  [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const DEMO_PACT_PREPARED =
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];

export function demoPreparedSpells(clazz: string, level: number): number {
  const key = (clazz ?? '').trim().toLowerCase();
  if (level < 1) return 0;
  const idx = Math.min(level, 20) - 1;
  if (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(key)) return DEMO_FULL_PREPARED[idx];
  if (key === 'warlock') return DEMO_PACT_PREPARED[idx];
  return 0;
}
