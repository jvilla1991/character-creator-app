import { ClassFeatureProgressionEntry } from './class-feature';
import { SubclassSpellRow, heroClassFor, subclassSpellsFor } from './hero-class';

/**
 * Recommended spells for every spellcaster, from official text only:
 *
 * - **Starting spells** — the cantrips and level-1 spells the 2024 Player's
 *   Handbook names as "recommended" in each class's Spellcasting feature (and in
 *   the Eldritch Knight's and Arcane Trickster's, who learn spells at level 3).
 *   A World of Warcraft specialization that has its own starting picks in the
 *   World of Warcraft book shows those instead.
 * - **Subclass spells** — the always-prepared list of a base-game subclass
 *   (Oath of Devotion Spells, Fiend Spells, ...). The server's class-feature
 *   catalog carries that list in the feature's own text, so it is read from
 *   there rather than copied here.
 *
 * Nothing here is a pick of this app's own, and nothing is granted or selected:
 * the create wizard badges the starting spells and the sheet lists them.
 */

/** One set of recommended starting spells. */
export interface StartingSpellPicks {
  /** Who the picks are for: the class ('Bard'), the subclass ('Eldritch Knight') or the specialization ('Holy Paladin'). */
  for: string;
  /** The class the spells are learned with ('Bard'; 'Fighter' for an Eldritch Knight). */
  baseClass: string;
  /** The class level the spells are picked at (1; 3 for the two level-3 casters). */
  classLevel: number;
  /** Where the recommendation is written. */
  source: 'Player\'s Handbook' | 'World of Warcraft';
  cantrips: readonly string[];
  level1Spells: readonly string[];
  /** What the level-1 row is called; absent reads 'Level 1'. A wizard keeps them in a 'Spellbook'. */
  level1Label?: string;
}

const HANDBOOK = 'Player\'s Handbook';

function classPicks(
  baseClass: string, cantrips: readonly string[], level1Spells: readonly string[], level1Label?: string,
): StartingSpellPicks {
  return { for: baseClass, baseClass, classLevel: 1, source: HANDBOOK, cantrips, level1Spells, level1Label };
}

/**
 * The Player's Handbook's recommended starting spells, by class (lower-case).
 * Paladins and Rangers learn no cantrips at level 1.
 */
export const HANDBOOK_CLASS_PICKS: Readonly<Record<string, StartingSpellPicks>> = {
  bard: classPicks('Bard',
    ['Dancing Lights', 'Vicious Mockery'],
    ['Charm Person', 'Color Spray', 'Dissonant Whispers', 'Healing Word']),
  cleric: classPicks('Cleric',
    ['Guidance', 'Sacred Flame', 'Thaumaturgy'],
    ['Bless', 'Cure Wounds', 'Guiding Bolt', 'Shield of Faith']),
  druid: classPicks('Druid',
    ['Druidcraft', 'Produce Flame'],
    ['Animal Friendship', 'Cure Wounds', 'Faerie Fire', 'Thunderwave']),
  paladin: classPicks('Paladin', [], ['Heroism', 'Searing Smite']),
  ranger: classPicks('Ranger', [], ['Cure Wounds', 'Ensnaring Strike']),
  sorcerer: classPicks('Sorcerer',
    ['Light', 'Prestidigitation', 'Shocking Grasp', 'Sorcerous Burst'],
    ['Burning Hands', 'Detect Magic']),
  warlock: classPicks('Warlock',
    ['Eldritch Blast', 'Prestidigitation'],
    ['Charm Person', 'Hex']),
  wizard: classPicks('Wizard',
    ['Light', 'Mage Hand', 'Ray of Frost'],
    ['Detect Magic', 'Feather Fall', 'Mage Armor', 'Magic Missile', 'Sleep', 'Thunderwave'],
    'Spellbook'),
};

/**
 * The Player's Handbook's recommended starting spells for the two subclasses
 * that learn spells at level 3, from the Wizard list. An Arcane Trickster also
 * knows Mage Hand, which is given rather than recommended.
 */
export const HANDBOOK_SUBCLASS_PICKS: readonly StartingSpellPicks[] = [
  {
    for: 'Eldritch Knight', baseClass: 'Fighter', classLevel: 3, source: HANDBOOK,
    cantrips: ['Ray of Frost', 'Shocking Grasp'],
    level1Spells: ['Burning Hands', 'Jump', 'Shield'],
  },
  {
    for: 'Arcane Trickster', baseClass: 'Rogue', classLevel: 3, source: HANDBOOK,
    cantrips: ['Mind Sliver', 'Minor Illusion'],
    level1Spells: ['Charm Person', 'Disguise Self', 'Fog Cloud'],
  },
];

/** The Player's Handbook's starting spells for a class; undefined for a class that casts no spells. */
export function handbookClassPicks(clazz: string | null | undefined): StartingSpellPicks | undefined {
  return HANDBOOK_CLASS_PICKS[(clazz ?? '').trim().toLowerCase()];
}

const NO_SPELLS: readonly string[] = [];
const HANDBOOK_STARTING_SPELLS = new Map<string, readonly string[]>();

/**
 * A class's handbook cantrips + level-1 spells as one stable (cached) array, so
 * a template binding doesn't see a new reference each pass; empty for a class
 * that casts no spells.
 */
export function handbookStartingSpells(clazz: string | null | undefined): readonly string[] {
  const picks = handbookClassPicks(clazz);
  if (!picks) return NO_SPELLS;
  let list = HANDBOOK_STARTING_SPELLS.get(picks.for);
  if (!list) {
    list = [...picks.cantrips, ...picks.level1Spells];
    HANDBOOK_STARTING_SPELLS.set(picks.for, list);
  }
  return list;
}

/** What {@link startingSpellPicksFor} reads off a character. */
export interface SpellcasterIdentity {
  clazz?: string | null;
  subclass?: string | null;
  specialization?: string | null;
}

/**
 * The recommended starting spells that apply to a character, in display order;
 * empty for a character that casts no spells.
 *
 * - A World of Warcraft specialization with its own cantrips or level-1 spells
 *   (a Holy paladin, a Balance druid) gets the World of Warcraft book's picks.
 * - Every other member of a spellcasting class gets the Player's Handbook's —
 *   a Death Knight is a Paladin and a Demon Hunter a Ranger, so they get those.
 * - An Eldritch Knight or Arcane Trickster gets its subclass's picks.
 */
export function startingSpellPicksFor(pc: SpellcasterIdentity | null | undefined): readonly StartingSpellPicks[] {
  if (!pc?.clazz) return [];
  const picks: StartingSpellPicks[] = [];
  const hero = heroClassFor(pc);
  const guidance = pc.specialization ? hero?.guidance?.[pc.specialization] : undefined;
  if (hero && guidance && (guidance.cantrips?.length || guidance.level1Spells?.length)) {
    picks.push({
      for: `${pc.specialization} ${hero.name}`,
      baseClass: hero.baseClass,
      classLevel: 1,
      source: 'World of Warcraft',
      cantrips: guidance.cantrips ?? [],
      level1Spells: guidance.level1Spells ?? [],
      level1Label: hero.level1SpellsLabel,
    });
  } else {
    const byClass = handbookClassPicks(pc.clazz);
    if (byClass) picks.push(byClass);
  }
  const clazz = pc.clazz.trim().toLowerCase();
  const subclass = (pc.subclass ?? '').trim().toLowerCase();
  const bySubclass = HANDBOOK_SUBCLASS_PICKS.find(
    p => p.baseClass.toLowerCase() === clazz && p.for.toLowerCase() === subclass);
  if (bySubclass) picks.push(bySubclass);
  return picks;
}

// ── Subclass spell lists ─────────────────────────────────────────────────────

/** A subclass's always-prepared spell list, as its feature names it. */
export interface SubclassSpellList {
  /** The feature that carries the list ('Oath of Devotion Spells'). */
  title: string;
  /** The spells by the class level they arrive at, earliest first. */
  rows: readonly SubclassSpellRow[];
}

/** One row of a list written in a feature's text: `5th — Aid, Zone of Truth;` (the server reads the same rows). */
const LIST_ROW = /(\d+)(?:st|nd|rd|th) — ([^;.]+)[;.]/g;

/**
 * The always-prepared spell list a subclass feature writes in its text
 * (`"3rd — Aid, Bless; 5th — Revivify."`), read from the class-feature roadmap;
 * null when the subclass has no such list (most non-casters, and Circle of the
 * Land, whose spells are chosen again after each Long Rest). A row never
 * arrives before the feature that carries it.
 */
export function subclassSpellList(entries: readonly ClassFeatureProgressionEntry[]): SubclassSpellList | null {
  for (const entry of entries) {
    if (!entry.subclass) continue;
    const byLevel = new Map<number, string[]>();
    for (const match of (entry.desc ?? '').matchAll(LIST_ROW)) {
      const level = Math.max(Number(match[1]), entry.level);
      const names = match[2].split(',').map(n => n.trim()).filter(n => n.length > 0);
      byLevel.set(level, [...(byLevel.get(level) ?? []), ...names]);
    }
    if (byLevel.size) {
      const rows = [...byLevel.entries()]
        .sort(([a], [b]) => a - b)
        .map(([classLevel, spells]): SubclassSpellRow => ({ classLevel, spells }));
      return { title: entry.name, rows };
    }
  }
  return null;
}

/**
 * True when the character's subclass spell list should be read from the
 * roadmap: it has a subclass, and that subclass's spells are not already shown
 * from the World of Warcraft tables (a hero class's own table — Death Knight,
 * Demon Hunter, Evoker — or a WoW-only subclass such as Oath of the Holy).
 */
export function readsSubclassSpellList(pc: SpellcasterIdentity | null | undefined): boolean {
  if (!pc?.clazz || !pc.subclass) return false;
  const hero = heroClassFor(pc);
  if (!hero) return true;
  // Level 20 = the whole table: any row at all means the WoW tables own this subclass.
  return !hero.subclass && subclassSpellsFor(hero, pc.subclass, 20).length === 0;
}
