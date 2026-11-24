import { PC, PcItem, PcSpell } from './pc';
import { modFromScore } from '../utils/character-math';

/**
 * A follower's stat block: everything a character sheet shows, minus the
 * identity the follower row itself carries (`id`, `name`). Stored server-side
 * as opaque JSON in this exact shape, so the sheet renders it without a
 * mapping layer.
 */
export type FollowerStatBlock = Partial<Omit<PC, 'id' | 'name'>>;

/**
 * What a follower is, which decides who may create and dismiss it:
 * `DM_GRANT` a companion the campaign's DM grants (the DM alone);
 * `SUMMON` a creature the player's own spell conjures and `FAMILIAR` the
 * character's familiar, one per character (the owning player, or the DM);
 * `COMPANION` reserved for server-owned companions.
 */
export type FollowerKind = 'DM_GRANT' | 'SUMMON' | 'FAMILIAR' | 'COMPANION';

/** The most followers one character can have, of every kind together. */
export const MAX_FOLLOWERS = 20;

/** A character's companion: granted by the DM, or made by the player's own spell. */
export interface Follower {
  id: number;
  /** The character this follower belongs to. */
  pcId: number;
  name: string;
  statBlock: FollowerStatBlock;
  createdAt?: string;
  /** Absent on a follower from before kinds existed: read it through followerKind(). */
  kind?: FollowerKind;
}

/** A follower's kind; one that carries none is a DM grant. */
export function followerKind(follower: Pick<Follower, 'kind'>): FollowerKind {
  return follower.kind ?? 'DM_GRANT';
}

/** Whether the owning player may dismiss the follower themselves: their own summon or familiar. */
export function playerMayDismiss(follower: Pick<Follower, 'kind'>): boolean {
  const kind = followerKind(follower);
  return kind === 'SUMMON' || kind === 'FAMILIAR';
}

type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_ALIASES: Record<string, Ability> = {
  str: 'STR', strength: 'STR', dex: 'DEX', dexterity: 'DEX', con: 'CON', constitution: 'CON',
  int: 'INT', intelligence: 'INT', wis: 'WIS', wisdom: 'WIS', cha: 'CHA', charisma: 'CHA',
};
const ITEM_CATEGORIES: PcItem['category'][] =
  ['weapon', 'armor', 'material-component', 'gear', 'transport', 'treasure'];
const COIN_KEYS = ['cp', 'sp', 'gp'] as const;

/** Pre-filled into the grant form so a DM can author by example. */
export const STAT_BLOCK_EXAMPLE = JSON.stringify(
  {
    race: 'Human',
    clazz: 'Guard',
    level: 2,
    hp: 16,
    ac: 16,
    speed: 30,
    stats: { STR: 14, DEX: 12, CON: 13, INT: 10, WIS: 11, CHA: 10 },
    saves: ['STR', 'CON'],
    skills: { Perception: 'prof', Athletics: 'prof' },
    languages: ['Common'],
    features: [{ name: 'Sworn Shield', desc: 'Can take a hit meant for an adjacent ally once per round.' }],
    spellSlots: { 1: 2 },
    spells: [{ name: 'Cure Wounds', lvl: 1, school: 'Abjuration', time: '1 action' }],
    inventory: [
      { name: 'Spear', category: 'weapon', damage: '1d6 piercing' },
      { name: 'Chain Shirt', category: 'armor', armorClass: '13 + Dex (max 2)' },
      { name: 'Rations', qty: 5 },
    ],
    coins: { gp: 12, sp: 4 },
    bio: 'A caravan guard who swore service after the ambush at Hollow Ford.',
  },
  null,
  2,
);

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** First present key among aliases — lets a DM write `class` or `species`. */
function pick(raw: Raw, ...keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null) return raw[k];
  }
  return undefined;
}

/** Thrown by the field readers; surfaced to the DM as the form error. */
class StatBlockError extends Error {}

function num(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new StatBlockError(`"${label}" must be a number.`);
  }
  return Math.trunc(value);
}

function list(value: unknown, label: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new StatBlockError(`"${label}" must be a list, e.g. [ … ].`);
  return value;
}

function strings(value: unknown, label: string): string[] {
  return list(value, label).map(v => str(v)).filter((v): v is string => !!v);
}

function readStats(value: unknown): NonNullable<PC['stats']> {
  const stats = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  if (value === undefined) return stats;
  if (!isObject(value)) throw new StatBlockError('"stats" must be an object, e.g. { "STR": 14, "DEX": 12 }.');
  for (const [key, raw] of Object.entries(value)) {
    const ability = ABILITY_ALIASES[key.toLowerCase()];
    if (!ability) continue;
    const score = num(raw, `stats.${key}`);
    if (score !== undefined) stats[ability] = Math.max(1, Math.min(30, score));
  }
  return stats;
}

function readHp(raw: Raw): NonNullable<PC['hp']> {
  const hp = pick(raw, 'hp', 'hitPoints');
  if (isObject(hp)) {
    const max = num(pick(hp, 'max'), 'hp.max') ?? num(pick(hp, 'cur', 'current'), 'hp.cur') ?? 1;
    const cur = num(pick(hp, 'cur', 'current'), 'hp.cur') ?? max;
    return { max: Math.max(0, max), cur: Math.max(0, cur), temp: Math.max(0, num(pick(hp, 'temp'), 'hp.temp') ?? 0) };
  }
  if (hp !== undefined && typeof hp !== 'number') {
    throw new StatBlockError('"hp" must be a number or { "cur": 9, "max": 16 }.');
  }
  const max = Math.max(0, num(hp ?? pick(raw, 'hpMax'), 'hp') ?? 1);
  return { max, cur: Math.max(0, num(pick(raw, 'hpCurrent'), 'hpCurrent') ?? max), temp: 0 };
}

function readSkills(value: unknown): NonNullable<PC['skills']> {
  const skills: NonNullable<PC['skills']> = {};
  if (value === undefined) return skills;
  // A plain list of names means "proficient in each".
  if (Array.isArray(value)) {
    strings(value, 'skills').forEach(name => { skills[name] = 'prof'; });
    return skills;
  }
  if (!isObject(value)) {
    throw new StatBlockError('"skills" must be a list of names or { "Perception": "prof" }.');
  }
  for (const [name, level] of Object.entries(value)) {
    if (level === 'expert' || level === 'expertise') skills[name] = 'expert';
    else if (level) skills[name] = 'prof';
  }
  return skills;
}

function readFeatures(value: unknown): NonNullable<PC['features']> {
  return list(value, 'features').map(entry => {
    if (typeof entry === 'string') return { name: entry, source: 'Follower', desc: '' };
    if (!isObject(entry) || !str(entry['name'])) {
      throw new StatBlockError('Each feature needs a "name".');
    }
    return {
      name: str(entry['name'])!,
      source: str(entry['source']) ?? 'Follower',
      desc: str(pick(entry, 'desc', 'description')) ?? '',
    };
  });
}

function readSpells(value: unknown): PcSpell[] {
  return list(value, 'spells').map(entry => {
    if (typeof entry === 'string') {
      return { name: entry, lvl: 0, school: '', time: '', prepared: true };
    }
    if (!isObject(entry) || !str(entry['name'])) {
      throw new StatBlockError('Each spell needs a "name".');
    }
    const lvl = num(pick(entry, 'lvl', 'level'), 'spell level') ?? 0;
    return {
      // Enrichment fields (range, components, description, …) ride along untouched.
      ...(entry as Partial<PcSpell>),
      name: str(entry['name'])!,
      lvl: Math.max(0, Math.min(9, lvl)),
      school: str(entry['school']) ?? '',
      time: str(pick(entry, 'time', 'castingTime')) ?? '',
      // A follower's listed spells are ready to cast unless the block says otherwise.
      prepared: entry['prepared'] !== false,
    };
  });
}

function readSpellSlots(value: unknown): NonNullable<PC['spellSlots']> {
  const slots: NonNullable<PC['spellSlots']> = {};
  if (value === undefined) return slots;
  if (!isObject(value)) throw new StatBlockError('"spellSlots" must be an object, e.g. { "1": 3, "2": 1 }.');
  for (const [key, raw] of Object.entries(value)) {
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1 || level > 9) continue;
    // Shorthand `"1": 3` means three slots, none spent.
    const max = isObject(raw) ? num(raw['max'], `spellSlots.${key}.max`) ?? 0 : num(raw, `spellSlots.${key}`) ?? 0;
    const used = isObject(raw) ? num(raw['used'], `spellSlots.${key}.used`) ?? 0 : 0;
    if (max > 0) slots[level] = { max, used: Math.max(0, Math.min(max, used)) };
  }
  return slots;
}

function readInventory(value: unknown): PcItem[] {
  return list(value, 'inventory').map(entry => {
    if (typeof entry === 'string') return { name: entry, category: 'gear', qty: 1 };
    if (!isObject(entry) || !str(entry['name'])) {
      throw new StatBlockError('Each inventory item needs a "name".');
    }
    const category = str(entry['category'])?.toLowerCase() as PcItem['category'] | undefined;
    return {
      // Snapshot fields (damage, armorClass, weight, notes, …) ride along untouched.
      ...(entry as Partial<PcItem>),
      name: str(entry['name'])!,
      category: category && ITEM_CATEGORIES.includes(category) ? category : 'gear',
      qty: Math.max(1, num(pick(entry, 'qty', 'quantity'), 'item qty') ?? 1),
    };
  });
}

function readCoins(value: unknown): NonNullable<PC['coins']> {
  const coins = { cp: 0, sp: 0, gp: 0 };
  if (value === undefined) return coins;
  if (!isObject(value)) throw new StatBlockError('"coins" must be an object, e.g. { "gp": 12 }.');
  for (const key of COIN_KEYS) {
    coins[key] = Math.max(0, num(value[key], `coins.${key}`) ?? 0);
  }
  // Forgiving, like the rest of the parser: a block pasted from a source that
  // still lists electrum or platinum converts it at full value (1 ep = 5 sp,
  // 1 pp = 10 gp) rather than erroring — the game itself uses three coins.
  coins.sp += 5 * Math.max(0, num(value['ep'], 'coins.ep') ?? 0);
  coins.gp += 10 * Math.max(0, num(value['pp'], 'coins.pp') ?? 0);
  return coins;
}

/**
 * Turn the JSON a DM pasted into a complete stat block. Deliberately forgiving:
 * every field is optional, common aliases are accepted (`class`, `species`,
 * `hp: 16`), and anything left out gets the value the rules would derive
 * (10s for abilities, initiative from DEX, proficiency from level). Only a
 * value of the wrong *kind* is an error — reported in plain words, never thrown.
 */
export function parseStatBlock(json: string): { statBlock?: FollowerStatBlock; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'That is not valid JSON — check for a missing comma, quote or bracket.' };
  }
  if (!isObject(raw)) {
    return { error: 'The stat block must be a JSON object: { "ac": 14, "hp": 16, … }.' };
  }

  try {
    const stats = readStats(pick(raw, 'stats', 'abilities', 'abilityScores'));
    const level = Math.max(1, Math.min(20, num(pick(raw, 'level'), 'level') ?? 1));
    const dexMod = modFromScore(stats.DEX);
    const tint = str(raw['portraitTint']);

    const statBlock: FollowerStatBlock = {
      clazz: str(pick(raw, 'clazz', 'class', 'role', 'type')) ?? 'Follower',
      level,
      race: str(pick(raw, 'race', 'species')),
      subclass: str(raw['subclass']),
      background: str(raw['background']),
      alignment: str(raw['alignment']),
      portraitInitials: str(raw['portraitInitials']),
      portraitTint: ['celestial', 'gold', 'crimson', 'violet', 'emerald'].includes(tint ?? '')
        ? (tint as PC['portraitTint'])
        : undefined,
      hp: readHp(raw),
      ac: num(pick(raw, 'ac', 'armorClass'), 'ac') ?? 10 + dexMod,
      init: num(pick(raw, 'init', 'initiative'), 'init') ?? dexMod,
      speed: num(pick(raw, 'speed'), 'speed') ?? 30,
      prof: num(pick(raw, 'prof', 'profBonus', 'proficiency'), 'prof') ?? 2 + Math.floor((level - 1) / 4),
      stats,
      saves: strings(pick(raw, 'saves', 'savingThrows'), 'saves')
        .map(s => ABILITY_ALIASES[s.toLowerCase()])
        .filter((a): a is Ability => ABILITIES.includes(a)),
      skills: readSkills(raw['skills']),
      conditions: strings(raw['conditions'], 'conditions'),
      coins: readCoins(raw['coins']),
      spellSlots: readSpellSlots(pick(raw, 'spellSlots', 'slots')),
      spells: readSpells(raw['spells']),
      inventory: readInventory(pick(raw, 'inventory', 'items', 'equipment')),
      features: readFeatures(pick(raw, 'features', 'traits', 'actions')),
      languages: strings(raw['languages'], 'languages'),
      toolProfs: strings(pick(raw, 'toolProfs', 'tools'), 'toolProfs'),
      bio: str(pick(raw, 'bio', 'description')),
    };
    return { statBlock };
  } catch (e) {
    if (e instanceof StatBlockError) return { error: e.message };
    throw e;
  }
}

/**
 * The follower as a PC the character sheet can render. The id is negated so it
 * can never be mistaken for (or sent to an endpoint as) a real character's id.
 */
export function followerToPc(follower: Follower, owner: PC): PC {
  return {
    ...follower.statBlock,
    id: -follower.id,
    name: follower.name,
    clazz: follower.statBlock.clazz ?? 'Follower',
    level: follower.statBlock.level ?? 1,
    playerName: owner.player || owner.playerName,
  };
}

/** The inverse of {@link followerToPc}: strip the identity back off an edited sheet. */
export function pcToStatBlock(pc: PC): FollowerStatBlock {
  const statBlock: Partial<PC> = { ...pc };
  delete statBlock.id;
  delete statBlock.name;
  delete statBlock.playerName; // the owner's, stamped on by followerToPc
  return statBlock;
}
