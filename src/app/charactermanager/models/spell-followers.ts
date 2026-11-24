import { PC } from './pc';
import { Follower, FollowerStatBlock } from './follower';
import { fmtMod, modFromScore, proficiencyBonus, spellAttackBonus, spellSaveDc } from '../utils/character-math';

/**
 * Spells whose creature the player may add to the sheet as a follower: Find
 * Familiar (a FAMILIAR, one per character) and three Arcana Unleashed spells
 * (a SUMMON each). This file knows which spells those are and builds the
 * follower's stat block in the shape the follower sheet renders.
 *
 * Every number is fixed when the follower is created: the slot level, the
 * caster's spell attack bonus, save DC, proficiency bonus and level are baked
 * into the stat block and its feature text. Nothing recalculates afterwards;
 * casting the spell again makes a new follower.
 *
 * Where things go on the sheet: an attack is a feature carrying its whole
 * attack line (a natural weapon is not an item, so the inventory stays
 * empty); traits, actions, bonus actions and reactions are features too,
 * named by their `source`; facts about the creature (size and type, extra
 * speeds, special senses, vulnerabilities) are "other" features; condition
 * immunities use the sheet's own immunity chips.
 */

type Stats = NonNullable<PC['stats']>;
type Ability = keyof Stats;
type Feature = NonNullable<PC['features']>[number];

/** The follower kinds a spell can create. */
export type SpellFollowerKind = 'SUMMON' | 'FAMILIAR';

/** A spell that offers "Add as follower". */
export interface FollowerSpell {
  /** The spell's name, exactly as it is stored on a character's spell entry. */
  name: string;
  kind: SpellFollowerKind;
  /** The spell's own level: the lowest slot it can be cast with. */
  level: number;
  /** Whether a higher slot changes the stat block (the player picks the slot level). */
  scales: boolean;
  /** The forms the caster picks from. */
  forms: readonly string[];
  /** The creature types the caster picks from; empty when the spell fixes the type. */
  creatureTypes: readonly string[];
}

export const FAMILIAR_CREATURE_TYPES = ['Celestial', 'Fey', 'Fiend'] as const;
/** Damage types the Elemental Familiar feat offers. */
export const ELEMENTAL_DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'] as const;
/** Damage types the Otherworldly Familiar feat offers. */
export const OTHERWORLDLY_DAMAGE_TYPES = ['Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'] as const;
/** The highest spell slot level there is. */
export const MAX_SLOT_LEVEL = 9;

// ── Familiar forms (Find Familiar) ───────────────────────────────────────────
// The forms the spell text lists, with the numbers of the matching SRD 5.2.1
// stat blocks (CC-BY-4.0). Trait text is a short summary in our own words.
// Every form is CR 0 with a +2 proficiency bonus; initiative is the Dexterity
// modifier and passive Perception follows from Wisdom and the skill below.

interface FamiliarForm {
  name: string;
  size: 'Tiny' | 'Small';
  ac: number;
  hp: number;
  /** Walking speed in feet. */
  speed: number;
  /** Other speeds, as the sheet should read them ("Fly 60 ft."). */
  speeds: string[];
  /** STR, DEX, CON, INT, WIS, CHA. */
  scores: [number, number, number, number, number, number];
  saves?: Ability[];
  skills?: { [skill: string]: 'prof' | 'expert' };
  /** Special senses only; passive Perception is worked out by the sheet. */
  senses?: string;
  traits?: Array<[name: string, desc: string]>;
  /** The form's attack: its name, bonus to hit and what a hit does. */
  attack: [name: string, toHit: number, hit: string];
  reactions?: Array<[name: string, desc: string]>;
}

const SPIDER_CLIMB = 'Climbs difficult surfaces, ceilings included, without an ability check.';
const FLYBY = 'Flying out of an enemy\'s reach provokes no Opportunity Attack.';

const FAMILIAR_FORM_DATA: readonly FamiliarForm[] = [
  {
    name: 'Bat', size: 'Tiny', ac: 12, hp: 1, speed: 5, speeds: ['Fly 30 ft.'],
    scores: [2, 15, 8, 2, 12, 4], senses: 'Blindsight 60 ft.',
    attack: ['Bite', 4, '1 Piercing damage'],
  },
  {
    name: 'Cat', size: 'Tiny', ac: 12, hp: 2, speed: 40, speeds: ['Climb 40 ft.'],
    scores: [3, 15, 10, 3, 12, 7], saves: ['DEX'], skills: { Perception: 'prof', Stealth: 'prof' },
    senses: 'Darkvision 60 ft.',
    traits: [['Jumper', 'Uses Dexterity instead of Strength to work out how far it jumps.']],
    attack: ['Scratch', 4, '1 Slashing damage'],
  },
  {
    name: 'Frog', size: 'Tiny', ac: 11, hp: 1, speed: 20, speeds: ['Swim 20 ft.'],
    scores: [1, 13, 8, 1, 8, 3], skills: { Perception: 'prof', Stealth: 'prof' },
    senses: 'Darkvision 30 ft.',
    traits: [
      ['Amphibious', 'Breathes air and water.'],
      ['Standing Leap', 'Jumps up to 10 ft. long and 5 ft. high, running start or not.'],
    ],
    attack: ['Bite', 3, '1 Piercing damage'],
  },
  {
    name: 'Hawk', size: 'Tiny', ac: 13, hp: 1, speed: 10, speeds: ['Fly 60 ft.'],
    scores: [5, 16, 8, 2, 14, 6], skills: { Perception: 'expert' },
    attack: ['Talons', 5, '1 Slashing damage'],
  },
  {
    name: 'Lizard', size: 'Tiny', ac: 10, hp: 2, speed: 20, speeds: ['Climb 20 ft.'],
    scores: [2, 11, 10, 1, 8, 3], senses: 'Darkvision 30 ft.',
    traits: [['Spider Climb', SPIDER_CLIMB]],
    attack: ['Bite', 2, '1 Piercing damage'],
  },
  {
    name: 'Octopus', size: 'Small', ac: 12, hp: 3, speed: 5, speeds: ['Swim 30 ft.'],
    scores: [4, 15, 11, 3, 10, 4], skills: { Perception: 'prof', Stealth: 'expert' },
    senses: 'Darkvision 30 ft.',
    traits: [
      ['Compression', 'Moves through a gap as narrow as 1 inch at no extra movement cost.'],
      ['Water Breathing', 'Breathes only underwater.'],
    ],
    attack: ['Tentacles', 4, '1 Bludgeoning damage'],
    reactions: [['Ink Cloud (1/Day)',
      'When a creature ends its turn within 5 ft. of it underwater: ink fills a 5-ft. Cube centred on the '
      + 'octopus, which then moves up to its Swim Speed. The Cube is Heavily Obscured for 1 minute or until a '
      + 'strong current clears it.']],
  },
  {
    name: 'Owl', size: 'Tiny', ac: 11, hp: 1, speed: 5, speeds: ['Fly 60 ft.'],
    scores: [3, 13, 8, 2, 12, 7], skills: { Perception: 'expert', Stealth: 'expert' },
    senses: 'Darkvision 120 ft.',
    traits: [['Flyby', FLYBY]],
    attack: ['Talons', 3, '1 Slashing damage'],
  },
  {
    name: 'Rat', size: 'Tiny', ac: 10, hp: 1, speed: 20, speeds: ['Climb 20 ft.'],
    scores: [2, 11, 9, 2, 10, 4], skills: { Perception: 'prof' }, senses: 'Darkvision 30 ft.',
    traits: [['Agile', 'Moving out of an enemy\'s reach provokes no Opportunity Attack.']],
    attack: ['Bite', 2, '1 Piercing damage'],
  },
  {
    name: 'Raven', size: 'Tiny', ac: 12, hp: 2, speed: 10, speeds: ['Fly 50 ft.'],
    scores: [2, 14, 10, 5, 13, 6], skills: { Perception: 'prof' },
    traits: [['Mimicry',
      'Copies simple sounds it has heard (a whisper, a chitter). A DC 10 Wisdom (Insight) check tells the '
      + 'copy from the real thing.']],
    attack: ['Beak', 4, '1 Piercing damage'],
  },
  {
    name: 'Spider', size: 'Tiny', ac: 12, hp: 1, speed: 20, speeds: ['Climb 20 ft.'],
    scores: [2, 14, 8, 1, 10, 2], skills: { Stealth: 'prof' }, senses: 'Darkvision 30 ft.',
    traits: [
      ['Spider Climb', SPIDER_CLIMB],
      ['Web Walker', 'Ignores movement limits caused by webs, and knows where any creature touching the same web is.'],
    ],
    attack: ['Bite', 4, '1 Piercing damage plus 2 (1d4) Poison damage'],
  },
  {
    name: 'Weasel', size: 'Tiny', ac: 13, hp: 1, speed: 30, speeds: ['Climb 30 ft.'],
    scores: [3, 16, 8, 2, 12, 3], skills: { Acrobatics: 'prof', Perception: 'prof', Stealth: 'prof' },
    senses: 'Darkvision 60 ft.',
    attack: ['Bite', 5, '1 Piercing damage'],
  },
];

/** The forms Find Familiar offers, in the order the spell text lists them. */
export const FAMILIAR_FORMS: readonly string[] = FAMILIAR_FORM_DATA.map(f => f.name);

export const FOLLOWER_SPELLS: readonly FollowerSpell[] = [
  { name: 'Find Familiar', kind: 'FAMILIAR', level: 1, scales: false,
    forms: FAMILIAR_FORMS, creatureTypes: FAMILIAR_CREATURE_TYPES },
  { name: 'Battle Familiar', kind: 'SUMMON', level: 2, scales: true,
    forms: ['Brute', 'Flyer', 'Stalker'], creatureTypes: FAMILIAR_CREATURE_TYPES },
  { name: 'Summon Plant', kind: 'SUMMON', level: 5, scales: true,
    forms: ['Fungus', 'Tree', 'Vine'], creatureTypes: [] },
  { name: 'Summon Dinosaur', kind: 'SUMMON', level: 6, scales: true,
    forms: ['Ankylosaur', 'Triceratops', 'Tyrannosaur'], creatureTypes: [] },
];

/** The follower spell behind a spell name (case and outer spaces ignored); undefined for every other spell. */
export function followerSpellFor(spellName: string | null | undefined): FollowerSpell | undefined {
  const wanted = (spellName ?? '').trim().toLowerCase();
  return wanted ? FOLLOWER_SPELLS.find(s => s.name.toLowerCase() === wanted) : undefined;
}

/** The slot levels a follower spell can be cast with: its own level up to 9, or just its own. */
export function slotLevelsFor(spell: FollowerSpell): number[] {
  if (!spell.scales) return [spell.level];
  return Array.from({ length: MAX_SLOT_LEVEL - spell.level + 1 }, (_, i) => spell.level + i);
}

// ── The caster's numbers ─────────────────────────────────────────────────────

/** What a stat block borrows from its caster. */
export interface CasterNumbers {
  level: number;
  prof: number;
  /** Spell attack modifier. */
  spellAttack: number;
  /** Spell save DC. */
  saveDc: number;
}

/**
 * The caster's level, proficiency bonus, spell attack modifier and spell save
 * DC: the same numbers the Spells tab shows. A class with no spellcasting
 * ability (a Fighter who took Familiar Friend) uses the highest of
 * Intelligence, Wisdom and Charisma, the three abilities that feat lets the
 * player pick from.
 */
export function casterNumbers(pc: PC): CasterNumbers {
  const prof = proficiencyBonus(pc);
  const mental = Math.max(...(['INT', 'WIS', 'CHA'] as const).map(a => modFromScore(pc.stats?.[a] ?? 10)));
  return {
    level: pc.level ?? 1,
    prof,
    spellAttack: spellAttackBonus(pc) ?? prof + mental,
    saveDc: spellSaveDc(pc) ?? 8 + prof + mental,
  };
}

// ── Familiar feats ───────────────────────────────────────────────────────────

/** The feats that change a familiar, by the name they carry on a character. */
export const FAMILIAR_FEATS = {
  friend: 'Familiar Friend',
  elemental: 'Elemental Familiar',
  otherworldly: 'Otherworldly Familiar',
  soothing: 'Soothing Familiar',
  warlike: 'Warlike Familiar',
} as const;

export type FamiliarFeatKey = keyof typeof FAMILIAR_FEATS;

/**
 * Whether the character has a feat: its name is the origin feat (`pc.feat`) or
 * one of the character's features, which is where a level-up records a chosen
 * feat. Case and outer spaces are ignored.
 */
export function hasFeat(pc: Pick<PC, 'feat' | 'features'>, featName: string): boolean {
  const wanted = featName.trim().toLowerCase();
  const matches = (value: string | null | undefined) => (value ?? '').trim().toLowerCase() === wanted;
  return matches(pc.feat) || (pc.features ?? []).some(f => matches(f?.name));
}

/** Which of the familiar feats the character has. */
export function familiarFeatsOf(pc: Pick<PC, 'feat' | 'features'>): Record<FamiliarFeatKey, boolean> {
  return {
    friend: hasFeat(pc, FAMILIAR_FEATS.friend),
    elemental: hasFeat(pc, FAMILIAR_FEATS.elemental),
    otherworldly: hasFeat(pc, FAMILIAR_FEATS.otherworldly),
    soothing: hasFeat(pc, FAMILIAR_FEATS.soothing),
    warlike: hasFeat(pc, FAMILIAR_FEATS.warlike),
  };
}

// ── Building blocks ──────────────────────────────────────────────────────────

/** What the player chose in the dialog. Anything left out or not on offer falls back to the first option. */
export interface SpellFollowerChoices {
  form?: string;
  /** Summons: the slot the spell is cast with. Clamped to the spell's own level and 9. */
  slotLevel?: number;
  /** Familiars: Celestial, Fey or Fiend. */
  creatureType?: string;
  /** Elemental Familiar: the damage type its traits use. */
  elementalDamage?: string;
  /** Otherworldly Familiar: the damage type it resists. */
  otherworldlyDamage?: string;
  /** Battle Familiar only: the character's current familiar, when the spell empowers it. */
  empower?: Follower | null;
}

/** A follower ready to be created. */
export interface BuiltSpellFollower {
  kind: SpellFollowerKind;
  /** The name the dialog starts with. */
  name: string;
  statBlock: FollowerStatBlock;
}

/** `source` values for the features a familiar keeps while Battle Familiar empowers it. */
const FIND_FAMILIAR_SOURCE = 'Find Familiar';
const KEPT_SOURCES: readonly string[] = [FIND_FAMILIAR_SOURCE, ...Object.values(FAMILIAR_FEATS)];

const trait = (name: string, desc: string): Feature => ({ name, source: 'Trait', desc });
const action = (name: string, desc: string): Feature => ({ name, source: 'Action', desc });
const bonusAction = (name: string, desc: string): Feature => ({ name, source: 'Bonus Action', desc });
const reaction = (name: string, desc: string): Feature => ({ name, source: 'Reaction', desc });
/** A fact about the creature, shown under Other Features. */
const fact = (name: string, desc: string): Feature => ({ name, source: 'Stat block', desc, category: 'other' });

const pick = <T extends string>(wanted: string | undefined, options: readonly T[]): T =>
  options.find(o => o.toLowerCase() === (wanted ?? '').trim().toLowerCase()) ?? options[0];

const stats = (s: readonly number[]): Stats =>
  ({ STR: s[0], DEX: s[1], CON: s[2], INT: s[3], WIS: s[4], CHA: s[5] });

/** Half the spell's level, rounded down: the number of attacks, and the bonus two traits add. */
const halfLevel = (level: number): number => Math.floor(level / 2);
const multiattack = (level: number, what = 'attack'): string => {
  const count = halfLevel(level);
  return `Makes ${count} ${what}${count === 1 ? '' : 's'}.`;
};

/** The fields every built stat block shares; the caller fills in the creature. */
function statBlock(parts: {
  clazz: string; race: string; level: number; alignment: string; prof: number;
  hp: number; currentHp?: number; tempHp?: number; ac: number; speed: number; scores: Stats;
  saves?: Ability[]; skills?: { [skill: string]: 'prof' | 'expert' };
  conditionImmunities?: string[]; features: Feature[]; bio: string;
}): FollowerStatBlock {
  return {
    clazz: parts.clazz,
    race: parts.race,
    level: parts.level,
    alignment: parts.alignment,
    hp: { max: parts.hp, cur: parts.currentHp ?? parts.hp, temp: parts.tempHp ?? 0 },
    ac: parts.ac,
    init: modFromScore(parts.scores.DEX),
    speed: parts.speed,
    prof: parts.prof,
    stats: parts.scores,
    saves: parts.saves ?? [],
    skills: parts.skills ?? {},
    conditions: [],
    conditionImmunities: parts.conditionImmunities ?? [],
    coins: { cp: 0, sp: 0, gp: 0 },
    spellSlots: {},
    spells: [],
    inventory: [],
    features: parts.features,
    languages: [],
    toolProfs: [],
    bio: parts.bio,
  };
}

const UNDERSTANDS = fact('Languages', 'Understands every language you know.');

/** Traits a feat gives any familiar of the character, whichever spell made it. */
function generalFeatFeatures(pc: PC, caster: CasterNumbers): Feature[] {
  const feats = familiarFeatsOf(pc);
  const features: Feature[] = [];
  if (feats.soothing) {
    features.push({
      name: 'Healing Beacon', source: FAMILIAR_FEATS.soothing,
      desc: 'While it is within 120 ft. of you, an ally within 5 ft. of the familiar who rolls dice to restore '
        + 'Hit Points can treat each 1 or 2 rolled as a 3.',
    });
  }
  if (feats.warlike) {
    features.push({
      name: 'Intercept Attack', source: FAMILIAR_FEATS.warlike,
      desc: `Reaction, when a creature within 5 ft. of the familiar is hit by an attack roll: that creature gains `
        + `${fmtMod(caster.prof)} to its Armor Class against the attack, which can turn the hit into a miss.`,
    });
  }
  return features;
}

/** Traits a feat gives the familiar when Find Familiar is cast. */
function findFamiliarFeatFeatures(pc: PC, caster: CasterNumbers, choices: SpellFollowerChoices): Feature[] {
  const feats = familiarFeatsOf(pc);
  const features: Feature[] = [];
  if (feats.elemental) {
    const type = pick(choices.elementalDamage, ELEMENTAL_DAMAGE_TYPES);
    features.push(
      { name: 'Elemental Resistance', source: FAMILIAR_FEATS.elemental, desc: `Resistance to ${type} damage.` },
      {
        name: 'Energy Pulse', source: FAMILIAR_FEATS.elemental,
        desc: `You command it with a Bonus Action while it is within 120 ft. of you; it uses its Reaction. Each `
          + `creature within 5 ft. of the familiar makes a DC ${caster.saveDc} Dexterity saving throw. On a `
          + `failure it takes 2d4 ${type} damage, and a Medium or smaller creature is knocked Prone.`,
      },
    );
  }
  if (feats.otherworldly) {
    const type = pick(choices.otherworldlyDamage, OTHERWORLDLY_DAMAGE_TYPES);
    features.push(
      { name: 'Energy Resistance', source: FAMILIAR_FEATS.otherworldly, desc: `Resistance to ${type} damage.` },
      {
        name: 'Phase Walk', source: FAMILIAR_FEATS.otherworldly,
        desc: 'Creatures and objects count as Difficult Terrain for it instead of blocking it. Ending its turn '
          + 'inside an object returns it to the last free space it was in.',
      },
    );
  }
  return [...features, ...generalFeatFeatures(pc, caster)];
}

// ── Find Familiar ────────────────────────────────────────────────────────────

function familiar(pc: PC, choices: SpellFollowerChoices): BuiltSpellFollower {
  const form = FAMILIAR_FORM_DATA.find(f => f.name === pick(choices.form, FAMILIAR_FORMS))!;
  const type = pick(choices.creatureType, FAMILIAR_CREATURE_TYPES);
  const caster = casterNumbers(pc);
  // Familiar Friend: twice the character's level, on top of the form's own Hit Points.
  const hp = form.hp + (familiarFeatsOf(pc).friend ? 2 * caster.level : 0);
  const [attackName, toHit, hit] = form.attack;

  const features: Feature[] = [
    ...(form.traits ?? []).map(([name, desc]) => trait(name, desc)),
    action(attackName, `Melee attack: ${fmtMod(toHit)} to hit, reach 5 ft. Hit: ${hit}.`),
    ...(form.reactions ?? []).map(([name, desc]) => reaction(name, desc)),
    {
      name: 'Familiar', source: FIND_FAMILIAR_SOURCE,
      desc: 'Obeys your commands and acts on its own Initiative. It cannot attack. Within 100 ft. you speak '
        + 'with it by telepathy, and as a Bonus Action you see and hear through it until your next turn starts. '
        + 'It can use its Reaction to deliver a touch spell you cast.',
    },
    ...findFamiliarFeatFeatures(pc, caster, choices),
    fact('Creature', `${form.size} ${type}, Unaligned`),
    fact('Movement', form.speeds.join(', ')),
    ...(form.senses ? [fact('Senses', form.senses)] : []),
  ];

  return {
    kind: 'FAMILIAR',
    name: form.name,
    statBlock: statBlock({
      clazz: `${type} (${form.size})`, race: form.name, level: 1, alignment: 'Unaligned', prof: 2,
      hp, ac: form.ac, speed: form.speed, scores: stats(form.scores),
      saves: form.saves, skills: form.skills, features,
      bio: 'Summoned with Find Familiar. It disappears at 0 Hit Points and comes back when you cast the spell again.',
    }),
  };
}

// ── Battle Familiar ──────────────────────────────────────────────────────────

/** The creature type a familiar built here carries in its class line, e.g. "Fey (Tiny)". */
function creatureTypeOf(follower: Follower): string | undefined {
  const match = /\b(Celestial|Fey|Fiend)\b/i.exec(follower.statBlock.clazz ?? '');
  return match ? pick(match[1], FAMILIAR_CREATURE_TYPES) : undefined;
}

function battleFamiliar(pc: PC, spell: FollowerSpell, choices: SpellFollowerChoices): BuiltSpellFollower {
  const level = slotLevel(spell, choices);
  const form = pick(choices.form, ['Brute', 'Flyer', 'Stalker'] as const);
  const caster = casterNumbers(pc);
  const empowered = choices.empower ?? null;
  // An empowered familiar keeps its own creature type; a conjured one takes the player's choice.
  const type = (empowered && creatureTypeOf(empowered)) || pick(choices.creatureType, FAMILIAR_CREATURE_TYPES);
  const hp = (form === 'Brute' ? 30 : 20) + 5 * (level - spell.level);
  const speeds = [...(form === 'Flyer' ? ['Fly 30 ft. (hover)'] : []), 'Swim 30 ft.'];

  const features: Feature[] = [
    ...(form === 'Flyer'
      ? [trait('Flyby', FLYBY)]
      : []),
    trait('Talented', `${fmtMod(halfLevel(level))} to all of its ability checks and saving throws.`),
    action('Multiattack', multiattack(level, 'Rend attack') + (form === 'Stalker' ? ' It can swap one for Prowl.' : '')),
    action('Rend', `Melee attack: ${fmtMod(caster.spellAttack)} to hit, reach 5 ft. Hit: 1d8 + ${3 + level} Force damage.`),
    ...(form === 'Stalker'
      ? [action('Prowl', 'Moves up to half its Speed, provoking no Opportunity Attacks, and may then Hide.')]
      : []),
    // Empowered: what Find Familiar and the familiar feats gave it stays. Conjured: only
    // the feats that speak of any familiar apply (the others act when Find Familiar is cast).
    ...(empowered
      ? (empowered.statBlock.features ?? []).filter(f => KEPT_SOURCES.includes(f.source))
      : generalFeatFeatures(pc, caster)),
    fact('Creature', `Medium ${type}, ${empowered?.statBlock.alignment ?? 'Neutral'}`),
    fact('Movement', speeds.join(', ')),
    UNDERSTANDS,
  ];

  const slot = `a level ${level} slot`;
  return {
    kind: 'SUMMON',
    name: empowered ? `${empowered.name} (Battle Familiar)`.slice(0, 100) : 'Battle Familiar',
    statBlock: statBlock({
      clazz: `Battle Familiar (${type})`, race: form, level, prof: caster.prof,
      alignment: empowered?.statBlock.alignment ?? 'Neutral',
      // Empowered: its own Hit Points stay, and the battle familiar's arrive as temporary ones.
      hp: empowered ? empowered.statBlock.hp?.max ?? 1 : hp,
      currentHp: empowered ? empowered.statBlock.hp?.cur ?? empowered.statBlock.hp?.max ?? 1 : hp,
      tempHp: empowered ? hp : 0,
      ac: 11 + level + (form === 'Brute' ? 2 : 0), speed: 40,
      scores: stats([16, 16, 12, 8, 13, 10]),
      conditionImmunities: ['charmed', 'frightened'],
      features,
      bio: empowered
        ? `${empowered.name}, empowered by Battle Familiar with ${slot} for 1 hour. It keeps its own Hit Points `
          + 'and can attack. The spell ends when its temporary Hit Points run out; dismiss this follower then.'
        : `Conjured by Battle Familiar with ${slot}. It lasts 1 hour, rolls its own Initiative, and disappears `
          + 'at 0 Hit Points or if you die.',
    }),
  };
}

// ── Summon Dinosaur and Summon Plant ─────────────────────────────────────────

const spiritBio = (spell: FollowerSpell, level: number): string =>
  `Called by ${spell.name} with a level ${level} slot. It lasts up to 1 hour while you concentrate and `
  + 'disappears at 0 Hit Points. It acts right after your turn and obeys your spoken commands; given none, '
  + 'it Dodges and keeps out of danger.';

function dinosaur(pc: PC, spell: FollowerSpell, choices: SpellFollowerChoices): BuiltSpellFollower {
  const level = slotLevel(spell, choices);
  const form = pick(choices.form, ['Ankylosaur', 'Triceratops', 'Tyrannosaur'] as const);
  const caster = casterNumbers(pc);
  const toHit = `${fmtMod(caster.spellAttack)} to hit`;
  const bonus = 5 + level;

  const features: Feature[] = [
    ...(form === 'Ankylosaur' ? [trait('Siege Monster', 'Its damage is doubled against objects and structures.')] : []),
    trait('Tough', `${fmtMod(halfLevel(level))} to its Strength and Constitution saving throws.`),
    action('Multiattack', multiattack(level)),
    ...(form === 'Tyrannosaur'
      ? [action('Bite', `Melee attack: ${toHit}, reach 10 ft. Hit: 2d10 + ${bonus} Piercing damage. A Large or `
        + `smaller target is Grappled (escape DC ${caster.saveDc}) and Restrained until the grapple ends.`)]
      : []),
    ...(form === 'Triceratops'
      ? [action('Gore', `Melee attack: ${toHit}, reach 5 ft. Hit: 1d10 + ${bonus} Piercing damage. If the spirit `
        + 'moved 20 ft. or more straight at a Huge or smaller target just before the hit, the target takes 1d10 '
        + 'more Piercing damage and is knocked Prone.')]
      : []),
    action('Slam', `Melee attack: ${toHit}, reach 10 ft. Hit: 1d10 + ${bonus} Bludgeoning damage.`),
    fact('Creature', 'Huge Beast (Dinosaur), Neutral'),
    UNDERSTANDS,
  ];

  return {
    kind: 'SUMMON',
    name: `${form} Spirit`,
    statBlock: statBlock({
      clazz: 'Dinosaur Spirit', race: form, level, alignment: 'Neutral', prof: caster.prof,
      hp: 60 + 10 * (level - spell.level), ac: 11 + level + (form === 'Ankylosaur' ? 2 : 0), speed: 40,
      scores: stats([21, 11, 15, 4, 12, 9]), features, bio: spiritBio(spell, level),
    }),
  };
}

function plant(pc: PC, spell: FollowerSpell, choices: SpellFollowerChoices): BuiltSpellFollower {
  const level = slotLevel(spell, choices);
  const form = pick(choices.form, ['Fungus', 'Tree', 'Vine'] as const);
  const caster = casterNumbers(pc);
  const toHit = `${fmtMod(caster.spellAttack)} to hit`;

  const features: Feature[] = [
    ...(form === 'Tree' ? [trait('Siege Monster', 'Its damage is doubled against objects and structures.')] : []),
    action('Multiattack', multiattack(level)),
    ...(form === 'Fungus'
      ? [action('Spore Spray', `Melee or ranged attack: ${toHit}, reach 5 ft. or range 30 ft. Hit: 1d4 + ${level} `
        + 'Poison damage, and the target is Poisoned until the end of its next turn. A target that is already '
        + 'Poisoned takes 3d4 more Poison damage instead.')]
      : [action('Slam', `Melee attack: ${toHit}, reach 5 ft. Hit: 1d10 + ${3 + level} Bludgeoning damage.`)]),
    ...(form === 'Vine' ? [bonusAction('Twist Away', 'Dashes or Disengages.')] : []),
    fact('Creature', 'Large Plant, Neutral'),
    ...(form === 'Vine' ? [fact('Movement', 'Climb 40 ft.')] : []),
    fact('Vulnerability', form === 'Tree' ? 'Fire damage.' : 'Slashing damage.'),
    UNDERSTANDS,
  ];

  return {
    kind: 'SUMMON',
    name: `${form} Spirit`,
    statBlock: statBlock({
      clazz: 'Plant Spirit', race: form, level, alignment: 'Neutral', prof: caster.prof,
      hp: 50 + 10 * (level - spell.level), ac: 11 + level + (form === 'Tree' ? 2 : 0), speed: 40,
      scores: stats([17, 13, 14, 10, 13, 10]), features, bio: spiritBio(spell, level),
    }),
  };
}

/** The slot level to build with: the choice, kept between the spell's own level and 9. */
function slotLevel(spell: FollowerSpell, choices: SpellFollowerChoices): number {
  const wanted = Math.trunc(Number(choices.slotLevel));
  if (!Number.isFinite(wanted)) return spell.level;
  return Math.max(spell.level, Math.min(MAX_SLOT_LEVEL, wanted));
}

/**
 * Build the follower a spell creates for this caster, or null for a spell that
 * offers none. Pure: the same character and choices always give the same block.
 */
export function buildSpellFollower(
  spellName: string, pc: PC, choices: SpellFollowerChoices = {},
): BuiltSpellFollower | null {
  const spell = followerSpellFor(spellName);
  if (!spell) return null;
  switch (spell.name) {
    case 'Find Familiar': return familiar(pc, choices);
    case 'Battle Familiar': return battleFamiliar(pc, spell, choices);
    case 'Summon Dinosaur': return dinosaur(pc, spell, choices);
    case 'Summon Plant': return plant(pc, spell, choices);
    default: return null;
  }
}
