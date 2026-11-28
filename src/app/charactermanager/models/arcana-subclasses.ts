import { ContentSource } from './content-source';
import type { SubclassSpellRow } from './hero-class';
import type { PC, PcSpell } from './pc';

/**
 * The eight subclasses of the Arcana Unleashed book: one Cleric domain, one
 * Fighter, one Monk and one Warlock subclass, and four Wizard schools.
 *
 * They are ordinary catalog subclasses: the server offers them to every member
 * of the base class, base-game characters and World of Warcraft variants alike,
 * and owns their features, counters and always-prepared spells. This table lets
 * the SPA tag them with their book, hide them with the content-source filter,
 * and mirror the server's rules for the choices some of them come with
 * (`pc.subclassChoices` and the spells picked for a subclass feature) in the
 * level-up dialog and in demo mode. Text is paraphrased.
 */

export const ARCANA_DOMAIN = 'Arcana Domain';
export const ARCANE_ARCHER = 'Arcane Archer';
export const WARRIOR_OF_THE_MYSTIC_ARTS = 'Warrior of the Mystic Arts';
export const VESTIGE_PATRON = 'Vestige Patron';
export const CONJURER = 'Conjurer';
export const ENCHANTER = 'Enchanter';
export const NECROMANCER = 'Necromancer';
export const TRANSMUTER = 'Transmuter';

export interface ArcanaSubclass {
  /** The name stored on the character (`pc.subclass`). */
  name: string;
  /** The base class it belongs to ('Cleric'). */
  baseClass: string;
  /** The class level the subclass is chosen at: 1 for a Warlock (create wizard), else 3 (level-up). */
  subclassLevel: number;
  /** One line shown on a picker card. */
  desc: string;
  source: ContentSource;
}

const subclass = (name: string, baseClass: string, desc: string, subclassLevel = 3): ArcanaSubclass =>
  ({ name, baseClass, subclassLevel, desc, source: 'Arcana Unleashed' });

/** Every Arcana Unleashed subclass, in the book's order. */
export const ARCANA_SUBCLASSES: readonly ArcanaSubclass[] = [
  subclass(ARCANA_DOMAIN, 'Cleric',
    'You serve a god of magic. You reshape your spells with Channel Divinity and learn Wizard cantrips and spells.'),
  subclass(ARCANE_ARCHER, 'Fighter',
    'You lay magic on your ammunition. Your Arcane Shots banish, blind, snare or seek out their target.'),
  subclass(WARRIOR_OF_THE_MYSTIC_ARTS, 'Monk',
    'You cast Sorcerer spells beside your martial arts, and trade spell slots and Focus Points for each other.'),
  subclass(VESTIGE_PATRON, 'Warlock',
    'A dying god shares what power it has left. From Warlock level 3 its vestige fights beside you as a companion, '
    + 'and you gain the spells of one Cleric domain: Life, Light, Trickery or War.', 1),
  subclass(CONJURER, 'Wizard',
    'You bend distance and call creatures. You teleport as a Bonus Action and your summons arrive tougher.'),
  subclass(ENCHANTER, 'Wizard',
    'You cloud and captivate minds. You hold a creature spellbound and can turn an attack onto someone else.'),
  subclass(NECROMANCER, 'Wizard',
    'You work with life, death and undeath. You keep an undead familiar and strengthen the undead you raise.'),
  subclass(TRANSMUTER, 'Wizard',
    'You reshape matter and energy. You carry a Transmuter\'s Stone and alter your own form.'),
];

const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** The table entry behind a subclass name (case-insensitive); undefined for any other subclass. */
export function arcanaSubclass(name: string | null | undefined): ArcanaSubclass | undefined {
  const key = lower(name);
  return key ? ARCANA_SUBCLASSES.find(s => lower(s.name) === key) : undefined;
}

/** True when a subclass name is one of the eight Arcana Unleashed subclasses. */
export function isArcanaSubclass(name: string | null | undefined): boolean {
  return !!arcanaSubclass(name);
}

/** The Arcana Unleashed subclasses of a base class, in the book's order (case-insensitive). */
export function arcanaSubclassesFor(clazz: string | null | undefined): ArcanaSubclass[] {
  const key = lower(clazz);
  return ARCANA_SUBCLASSES.filter(s => lower(s.baseClass) === key);
}

/** The names a member of this class is offered at its level-up subclass choice (none for a Warlock). */
export function arcanaLevelUpSubclasses(clazz: string | null | undefined): string[] {
  return arcanaSubclassesFor(clazz).filter(s => s.subclassLevel > 1).map(s => s.name);
}

/** The Arcana Unleashed subclasses a class picks at level 1, in the create wizard (a Warlock's Vestige Patron). */
export function arcanaLevel1Subclasses(clazz: string | null | undefined): ArcanaSubclass[] {
  return arcanaSubclassesFor(clazz).filter(s => s.subclassLevel === 1);
}

// ── Always-prepared spells (the server grants them; names as the book writes them) ─────────

/** Arcana Domain Spells by Cleric level. Three names differ from the spell data: see SPELL_NAME_ALIASES. */
export const ARCANA_DOMAIN_SPELLS: readonly SubclassSpellRow[] = [
  { classLevel: 3, spells: ['Detect Magic', 'Magic Missile', 'Magic Weapon', "Nystul's Magic Aura"] },
  { classLevel: 5, spells: ['Counterspell', 'Dispel Magic'] },
  { classLevel: 7, spells: ['Arcane Eye', "Leomund's Secret Chest"] },
  { classLevel: 9, spells: ["Bigby's Hand", 'Teleportation Circle'] },
];

/** A spell one subclass feature always keeps prepared. */
export interface SubclassFeatureSpell {
  subclass: string;
  /** The feature that grants it, shown beside the spell ('Undead Thralls'). */
  feature: string;
  spell: string;
  /** The class level the feature arrives at. */
  classLevel: number;
}

/** The single spells the Wizard subclasses' features always keep prepared. */
export const ARCANA_FEATURE_SPELLS: readonly SubclassFeatureSpell[] = [
  { subclass: NECROMANCER, feature: 'Necromancy Spellbook', spell: 'Find Familiar', classLevel: 3 },
  { subclass: NECROMANCER, feature: 'Undead Thralls', spell: 'Animate Dead', classLevel: 6 },
  { subclass: TRANSMUTER, feature: 'Wondrous Alteration', spell: 'Alter Self', classLevel: 3 },
  { subclass: TRANSMUTER, feature: 'Shape-Shifter', spell: 'Polymorph', classLevel: 10 },
];

// ── Choices stored on the character (pc.subclassChoices) ────────────────────────────────

export type VestigeType = 'Celestial' | 'Fiend' | 'Undead';
export type VestigeDomain = 'Life' | 'Light' | 'Trickery' | 'War';

export const VESTIGE_TYPES: readonly VestigeType[] = ['Celestial', 'Fiend', 'Undead'];
export const VESTIGE_DOMAINS: readonly VestigeDomain[] = ['Life', 'Light', 'Trickery', 'War'];

/**
 * What a character chose for its subclass. Server-owned: only a level-up and
 * `PUT /pc/{id}/subclass-choices` write it; a generic save never does. Every
 * key is optional, and a write replaces just the keys it carries.
 */
export interface SubclassChoices {
  /** Skill proficiencies the subclass let the player choose (an Arcane Archer's may be none: `[]`). */
  skills?: string[];
  /** An Arcane Archer's known Arcane Shot options, by full name. */
  arcaneShots?: string[];
  vestigeType?: VestigeType;
  vestigeDomain?: VestigeDomain;
}

/** The keys of {@link SubclassChoices}. */
export const SUBCLASS_CHOICE_KEYS: readonly (keyof SubclassChoices)[] = [
  'skills', 'arcaneShots', 'vestigeType', 'vestigeDomain',
];

/** The eight Arcane Shot options, in alphabetical order. */
export const ARCANE_SHOT_OPTIONS: readonly string[] = [
  'Banishing Shot', 'Beguiling Shot', 'Bursting Shot', 'Enfeebling Shot', 'Grasping Shot', 'Piercing Shot',
  'Seeking Shot', 'Shadow Shot',
];

/** How many Arcane Shot options an Arcane Archer knows at a Fighter level; 0 before level 3. */
export function arcaneShotCount(fighterLevel: number | null | undefined): number {
  const level = fighterLevel ?? 0;
  if (level < 3) return 0;
  return level >= 18 ? 6 : level >= 15 ? 5 : level >= 10 ? 4 : level >= 7 ? 3 : 2;
}

/** The class level every subclass choice below arrives at. */
const CHOICE_LEVEL = 3;

/** True for an Arcane Archer (a Fighter) at or past the level its Arcane Shots arrive. */
export function hasArcaneShots(owner: Pick<PC, 'clazz'>, subclass: string | null | undefined, level: number): boolean {
  return has(owner, subclass, level, ARCANE_ARCHER);
}

/**
 * The Arcane Shot options stored on a character, as the server keeps them at
 * `level`: real options only, each once, in the table's spelling, and no more
 * than the level gives.
 */
export function knownArcaneShots(owner: Pick<ChoiceOwner, 'subclassChoices'>, level: number): string[] {
  const known: string[] = [];
  const most = arcaneShotCount(level);
  for (const name of owner.subclassChoices?.arcaneShots ?? []) {
    const option = ARCANE_SHOT_OPTIONS.find(o => lower(o) === lower(name));
    if (option && !known.includes(option) && known.length < most) known.push(option);
  }
  return known;
}

/** How many Arcane Shot options `subclass` still owes this character at `level`; 0 for anyone else. */
export function arcaneShotsOwed(owner: ChoiceOwner, subclass: string | null | undefined, level: number): number {
  if (!hasArcaneShots(owner, subclass, level)) return 0;
  return arcaneShotCount(level) - knownArcaneShots(owner, level).length;
}

/** The character a rule is read against: what it is and what it already has. */
export type ChoiceOwner = Pick<PC, 'clazz'> & Partial<Pick<PC, 'skills' | 'spells' | 'subclassChoices'>>;

/** True when `subclass` is `name`, on its own base class, at or past the level its choices arrive. */
function has(owner: Pick<PC, 'clazz'>, subclass: string | null | undefined, level: number, name: string): boolean {
  const entry = arcanaSubclass(subclass);
  return !!entry && entry.name === name && lower(owner.clazz) === lower(entry.baseClass) && level >= CHOICE_LEVEL;
}

const proficient = (owner: ChoiceOwner, skill: string): boolean => !!owner.skills?.[skill];

// ── Skill proficiencies ─────────────────────────────────────────────────────────────

/** Student of Arcana: Arcana, or one of the skills a Cleric chooses from at level 1. */
export const ARCANA_DOMAIN_SKILLS: readonly string[] = [
  'Arcana', 'History', 'Insight', 'Medicine', 'Persuasion', 'Religion',
];

/** Arcane Archer Lore gives both of these outright. */
export const ARCANE_ARCHER_GRANTED_SKILLS: readonly string[] = ['Arcana', 'Nature'];

/** What an Arcane Archer picks from in place of a skill it already had: the Fighter's level 1 list. */
export const ARCANE_ARCHER_REPLACEMENT_SKILLS: readonly string[] = [
  'Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Persuasion', 'Perception',
  'Survival',
];

/** The features that come with choices, as the server names them (a spell pick carries one as its `grantedBy`). */
export const STUDENT_OF_ARCANA = 'Student of Arcana';
export const MAGICAL_MASTERY = 'Magical Mastery';
export const ARCANE_ARCHER_LORE = 'Arcane Archer Lore';

/** The skill proficiencies a subclass feature still owes a character. */
export interface SubclassSkillChoice {
  /** The feature that gives them ('Student of Arcana'). */
  feature: string;
  /** Skills the feature gives outright, and whether the character had each already. */
  granted: readonly { name: string; alreadyProficient: boolean }[];
  /** How many skills the player picks from `options`. */
  count: number;
  /** The skills on offer: the feature's list, less what the character is proficient in. */
  options: readonly string[];
}

/**
 * The skill choice `subclass` owes this character at `level`; null when the
 * subclass has none, the level is too low, or the choice is already stored
 * (once made it is not asked again).
 *
 * - Arcana Domain: one skill from {@link ARCANA_DOMAIN_SKILLS}.
 * - Arcane Archer: Arcana and Nature, and one skill from the Fighter list for
 *   each of those two the character already had.
 */
export function subclassSkillChoice(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number,
): SubclassSkillChoice | null {
  if (Array.isArray(owner.subclassChoices?.skills)) return null;
  return skillRule(owner, subclass, level);
}

/** The rule itself, whether or not a choice is stored. */
function skillRule(owner: ChoiceOwner, subclass: string | null | undefined, level: number): SubclassSkillChoice | null {
  if (has(owner, subclass, level, ARCANA_DOMAIN)) {
    const options = ARCANA_DOMAIN_SKILLS.filter(skill => !proficient(owner, skill));
    return { feature: STUDENT_OF_ARCANA, granted: [], count: Math.min(1, options.length), options };
  }
  if (has(owner, subclass, level, ARCANE_ARCHER)) {
    const granted = ARCANE_ARCHER_GRANTED_SKILLS.map(name => ({ name, alreadyProficient: proficient(owner, name) }));
    const options = ARCANE_ARCHER_REPLACEMENT_SKILLS.filter(skill => !proficient(owner, skill));
    const owed = granted.filter(g => g.alreadyProficient).length;
    return { feature: ARCANE_ARCHER_LORE, granted, count: Math.min(owed, options.length), options };
  }
  return null;
}

/**
 * `pc.skills` after a subclass's skill choice is applied: the skills the
 * feature gives outright and the ones picked are marked proficient. Expertise
 * is never lowered. Returns the same object when nothing changes.
 */
export function withSubclassSkills(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number, picked: readonly string[],
): NonNullable<PC['skills']> {
  const current = owner.skills ?? {};
  const outright = has(owner, subclass, level, ARCANE_ARCHER) ? ARCANE_ARCHER_GRANTED_SKILLS : [];
  const gained = [...outright, ...picked].filter(skill => !current[skill]);
  if (!gained.length) return current;
  const next = { ...current };
  for (const skill of gained) next[skill] = 'prof';
  return next;
}

// ── Spells picked for a subclass feature ───────────────────────────────────────────────

/**
 * Spells a subclass feature lets the player pick. They are saved in
 * `pc.spells` with the feature as `grantedBy` (a leveled one always prepared),
 * outside the class's cantrip and prepared counts.
 */
export interface SubclassSpellPickRule {
  /** The feature, and the `grantedBy` its picks carry ('Student of Arcana'). */
  feature: string;
  subclass: string;
  /** The class level the feature arrives at. */
  fromLevel: number;
  /** The spell level of each pick (0 is a cantrip): [0, 0], or [6, 7, 8, 9]. */
  levels: readonly number[];
  /** The class spell list the picks come from, lower-case ('wizard'); absent when `names` lists them. */
  spellList?: string;
  /** The only spells allowed, by name. */
  names?: readonly string[];
  /** True when one pick may be swapped for another of the same level at each later level-up. */
  replaceable: boolean;
  /**
   * True when the server refuses a level-up that leaves the picks short. A
   * rule that is not required yet is accepted when absent, and the level-up
   * dialog does not ask for it.
   */
  required: boolean;
}

export const SUBCLASS_SPELL_PICKS: readonly SubclassSpellPickRule[] = [
  {
    feature: STUDENT_OF_ARCANA, subclass: ARCANA_DOMAIN, fromLevel: 3, levels: [0, 0], spellList: 'wizard',
    replaceable: true, required: true,
  },
  {
    feature: MAGICAL_MASTERY, subclass: ARCANA_DOMAIN, fromLevel: 17, levels: [6, 7, 8, 9], spellList: 'wizard',
    replaceable: true, required: true,
  },
  {
    feature: ARCANE_ARCHER_LORE, subclass: ARCANE_ARCHER, fromLevel: 3, levels: [0],
    names: ['Druidcraft', 'Prestidigitation'], replaceable: false, required: true,
  },
];

/** The `grantedBy` names that mark a spell as a subclass pick. */
export const SUBCLASS_PICK_FEATURES: readonly string[] = SUBCLASS_SPELL_PICKS.map(rule => rule.feature);

/** The pick rule behind a `grantedBy` name (case-insensitive); undefined for anything else. */
export function subclassSpellPickRule(feature: string | null | undefined): SubclassSpellPickRule | undefined {
  const key = lower(feature);
  return key ? SUBCLASS_SPELL_PICKS.find(rule => lower(rule.feature) === key) : undefined;
}

/** The pick rules of `subclass` that apply at `level`, in table order; empty for most subclasses. */
export function subclassSpellPickRules(
  owner: Pick<PC, 'clazz'>, subclass: string | null | undefined, level: number,
): SubclassSpellPickRule[] {
  return SUBCLASS_SPELL_PICKS.filter(rule => has(owner, subclass, level, rule.subclass) && level >= rule.fromLevel);
}

/** True when a spell may be picked for one of a rule's picks of `spellLevel`. */
export function subclassPickAllows(
  rule: SubclassSpellPickRule, spell: { name: string; level: number; classes?: readonly string[] }, spellLevel: number,
): boolean {
  if (spell.level !== spellLevel || !rule.levels.includes(spellLevel)) return false;
  if (rule.names && !rule.names.some(name => lower(name) === lower(spell.name))) return false;
  return !rule.spellList || (spell.classes ?? []).includes(rule.spellList);
}

/** The picks a character already holds for a feature: its spells whose `grantedBy` is that feature. */
export function heldSubclassPicks(owner: ChoiceOwner, feature: string): PcSpell[] {
  const key = lower(feature);
  return (owner.spells ?? []).filter(spell => lower(spell.grantedBy) === key);
}

/**
 * True while a rule still has a spell this character could pick. A rule that
 * names its spells (Arcane Archer Lore) has none left once the character knows
 * them all from elsewhere; the server then asks for nothing.
 */
function hasPickLeft(owner: ChoiceOwner, rule: SubclassSpellPickRule): boolean {
  if (!rule.names) return true;
  const known = new Set((owner.spells ?? []).map(spell => lower(spell.name)));
  return rule.names.some(name => !known.has(lower(name)));
}

/** One rule read against a character: what it holds and what it is still owed. */
export interface SubclassSpellPickNeed {
  rule: SubclassSpellPickRule;
  /** The picks already on the character. */
  held: readonly PcSpell[];
  /** The spell level of each pick still owed ([0, 0] at Cleric 3; [] once complete). */
  owed: readonly number[];
  /** The held picks, when one of them may be swapped at this level-up; empty otherwise. */
  replaceable: readonly PcSpell[];
}

/**
 * What each pick rule of `subclass` asks of this character at `level`. Rules
 * that are not required yet are left out unless `includeOptional` is set.
 */
export function subclassSpellPickNeeds(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number, includeOptional = false,
): SubclassSpellPickNeed[] {
  return subclassSpellPickRules(owner, subclass, level)
    .filter(rule => rule.required || includeOptional)
    .map(rule => {
      const held = heldSubclassPicks(owner, rule.feature);
      const owed = hasPickLeft(owner, rule) ? [...rule.levels] : [];
      for (const spell of held) {
        const at = owed.indexOf(spell.lvl);
        if (at >= 0) owed.splice(at, 1);
      }
      return { rule, held, owed, replaceable: rule.replaceable ? held : [] };
    });
}

/** One picker of a need: how many spells of one level to pick. */
export interface SubclassSpellPickGroup {
  level: number;
  count: number;
}

/**
 * The pickers a need comes to, by spell level: what is owed, plus one pick of
 * the level of the held spell being swapped out (`forget`, by name), if any.
 */
export function subclassSpellPickGroups(need: SubclassSpellPickNeed, forget?: string | null): SubclassSpellPickGroup[] {
  const levels = [...need.owed];
  const swapped = forget ? need.replaceable.find(spell => lower(spell.name) === lower(forget)) : undefined;
  if (swapped) levels.push(swapped.lvl);
  const counts = new Map<number, number>();
  for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a - b).map(([level, count]) => ({ level, count }));
}

/**
 * True when a level-up to `level` with `subclass` cannot be confirmed before
 * the player chooses something: a skill is owed, a required feature is short
 * of its picks, or an Arcane Archer is short of its Arcane Shot options.
 */
export function subclassChoicesDue(owner: ChoiceOwner, subclass: string | null | undefined, level: number): boolean {
  return (subclassSkillChoice(owner, subclass, level)?.count ?? 0) > 0
    || subclassSpellPickNeeds(owner, subclass, level).some(need => need.owed.length > 0)
    || arcaneShotsOwed(owner, subclass, level) > 0
    || !!vestigeChoicesOwed(owner, subclass, level);
}

// ── A Vestige Patron's type and domain ──────────────────────────────────────────────

/** Which of a Vestige Patron's two choices are still to be made. */
export interface VestigeChoicesOwed {
  /** The companion's type is not chosen yet. */
  type: boolean;
  /** The Cleric domain behind Vestige Spells is not chosen yet. */
  domain: boolean;
}

/**
 * What a Vestige Patron still has to choose at `level`: its companion's type
 * and the domain of its Vestige Spells, each until it is stored. Null when
 * both are stored, below Warlock 3, and for every other subclass. The server
 * refuses a level-up that leaves either one unset.
 */
export function vestigeChoicesOwed(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number,
): VestigeChoicesOwed | null {
  if (!has(owner, subclass, level, VESTIGE_PATRON)) return null;
  const type = !owner.subclassChoices?.vestigeType;
  const domain = !owner.subclassChoices?.vestigeDomain;
  return type || domain ? { type, domain } : null;
}

// ── Writing the stored choices (the server's rules, for demo mode) ────────────────────────

/** True when a stored key means something for this class, subclass and level. */
function keyApplies(
  key: keyof SubclassChoices, owner: Pick<PC, 'clazz'>, subclass: string | null | undefined, level: number,
): boolean {
  switch (key) {
    case 'skills': return has(owner, subclass, level, ARCANA_DOMAIN) || has(owner, subclass, level, ARCANE_ARCHER);
    case 'arcaneShots': return has(owner, subclass, level, ARCANE_ARCHER);
    default: return has(owner, subclass, level, VESTIGE_PATRON);
  }
}

/**
 * Stored choices checked against what the character now is: a key that no
 * longer applies is dropped, and nothing left is null.
 */
export function cleanSubclassChoices(
  stored: SubclassChoices | null | undefined, owner: Pick<PC, 'clazz'>, subclass: string | null | undefined,
  level: number,
): SubclassChoices | null {
  const kept: SubclassChoices = {};
  for (const key of SUBCLASS_CHOICE_KEYS) {
    const value = stored?.[key];
    if (value != null && keyApplies(key, owner, subclass, level)) Object.assign(kept, { [key]: value });
  }
  return Object.keys(kept).length ? kept : null;
}

/** How a write is checked. */
export interface SubclassChoiceWrite {
  /**
   * True for a level-up: a stored `skills` is then left as it is, and Arcane
   * Shot options may only be swapped as the level-up rules allow.
   */
  levelUp?: boolean;
}

const duplicated = (names: readonly string[]): boolean => new Set(names.map(lower)).size !== names.length;

/**
 * Why a partial choices object cannot be written for this character at
 * `level`; null when it can. `skills` is strict: while it is unset, a write
 * must carry exactly the skills owed. So is `arcaneShots` at a level-up: one
 * that would leave an Arcane Archer short of its options must carry them. The
 * other keys are checked when present.
 */
export function subclassChoicesProblem(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number, partial: SubclassChoices | null | undefined,
  write: SubclassChoiceWrite = {},
): string | null {
  const stored = owner.subclassChoices ?? {};
  const skillsStored = Array.isArray(stored.skills);
  const rule = skillRule(owner, subclass, level);
  // A level-up must settle an unset choice; the endpoint checks the key only when it is sent.
  if (rule && (write.levelUp ? !skillsStored : partial?.skills != null)) {
    const picked = partial?.skills ?? [];
    // Replacing a stored choice asks for as many skills as were picked the first time.
    const count = skillsStored ? stored.skills!.length : rule.count;
    const offered = skillsStored ? [...rule.options, ...stored.skills!] : rule.options;
    if (picked.length !== count) {
      return count === 0
        ? `${rule.feature} has no skill to choose.`
        : `Choose ${count} ${count === 1 ? 'skill' : 'skills'} for ${rule.feature}.`;
    }
    if (duplicated(picked)) return `Choose different skills for ${rule.feature}.`;
    const wrong = picked.find(skill => !offered.includes(skill));
    if (wrong) return `${wrong} cannot be chosen for ${rule.feature}.`;
  }
  if (write.levelUp && partial?.arcaneShots == null && arcaneShotsOwed(owner, subclass, level) > 0) {
    return `Choose ${arcaneShotCount(level)} Arcane Shot options.`;
  }
  if (partial?.arcaneShots != null && has(owner, subclass, level, ARCANE_ARCHER)) {
    const shots = partial.arcaneShots;
    const unknown = shots.find(shot => !ARCANE_SHOT_OPTIONS.includes(shot));
    if (unknown) return `${unknown} is not an Arcane Shot option.`;
    if (duplicated(shots)) return 'Choose each Arcane Shot option once.';
    const count = arcaneShotCount(level);
    if (shots.length !== count) return `Choose ${count} Arcane Shot options.`;
    if (write.levelUp) {
      const dropped = (stored.arcaneShots ?? []).filter(shot => !shots.includes(shot)).length;
      const allowed = count > arcaneShotCount(level - 1) ? 1 : 0;
      if (dropped > allowed) {
        return allowed
          ? 'Only one known Arcane Shot option can be replaced.'
          : 'Known Arcane Shot options cannot be replaced at this level.';
      }
    }
  }
  if (partial?.vestigeType != null && !VESTIGE_TYPES.includes(partial.vestigeType)) {
    return `${partial.vestigeType} is not a vestige type.`;
  }
  // A level-up must leave a Vestige Patron with both of its choices made.
  if (write.levelUp && has(owner, subclass, level, VESTIGE_PATRON)) {
    if (!(partial?.vestigeType ?? stored.vestigeType)) return 'A Vestige Patron must choose a Vestige type';
    if (!(partial?.vestigeDomain ?? stored.vestigeDomain)) return 'A Vestige Patron must choose a Vestige domain';
  }
  if (partial?.vestigeDomain != null) {
    if (!VESTIGE_DOMAINS.includes(partial.vestigeDomain)) return `${partial.vestigeDomain} is not a vestige domain.`;
    if (write.levelUp && stored.vestigeDomain && stored.vestigeDomain !== partial.vestigeDomain) {
      return 'The vestige domain cannot be changed.';
    }
  }
  return null;
}

/**
 * Why the subclass picks of a level-up cannot be applied; null when they can.
 * `newSpells` is everything the level-up learns: only the entries whose
 * `grantedBy` is a pick feature are read. `forgetSpells` names held picks being
 * swapped out, at most one per feature. Afterwards a required feature must hold
 * exactly its picks, level for level; one that is not required yet may hold none.
 */
export function subclassSpellPicksProblem(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number,
  newSpells: readonly Pick<PcSpell, 'name' | 'lvl' | 'grantedBy'>[], forgetSpells: readonly string[],
): string | null {
  const rules = subclassSpellPickRules(owner, subclass, level);
  const forgotten = new Map<string, string>();
  for (const name of forgetSpells) {
    const held = (owner.spells ?? []).find(spell => lower(spell.name) === lower(name)
      && !!subclassSpellPickRule(spell.grantedBy)?.replaceable);
    const rule = subclassSpellPickRule(held?.grantedBy);
    if (!held || !rule || !rules.includes(rule)) return `${name} is not a spell a subclass feature lets you replace.`;
    if (forgotten.has(rule.feature)) return `Only one ${rule.feature} spell can be replaced at a level-up.`;
    forgotten.set(rule.feature, lower(held.name));
  }
  const picks = newSpells.filter(spell => !!subclassSpellPickRule(spell.grantedBy));
  const stray = picks.find(spell => !rules.includes(subclassSpellPickRule(spell.grantedBy)!));
  if (stray) return `${stray.grantedBy} is not a feature of this character.`;
  for (const rule of rules) {
    const added = picks.filter(spell => lower(spell.grantedBy) === lower(rule.feature));
    const unlisted = added.find(spell => rule.names && !rule.names.some(name => lower(name) === lower(spell.name)));
    if (unlisted) return `${unlisted.name} cannot be picked for ${rule.feature}.`;
    if (!added.length && (!rule.required || !hasPickLeft(owner, rule))) continue;
    const kept = heldSubclassPicks(owner, rule.feature).filter(spell => forgotten.get(rule.feature) !== lower(spell.name));
    const levels = [...kept, ...added].map(spell => spell.lvl).sort((a, b) => a - b);
    if (levels.join() !== [...rule.levels].sort((a, b) => a - b).join()) {
      return `${rule.feature} needs ${pickSummary(rule)}.`;
    }
  }
  return null;
}

/** 'two cantrips' / 'one spell each of level 6, 7, 8 and 9' — what a rule's picks come to. */
function pickSummary(rule: SubclassSpellPickRule): string {
  const leveled = rule.levels.filter(level => level > 0);
  if (!leveled.length) return rule.levels.length === 1 ? 'one cantrip' : `${COUNT_WORDS[rule.levels.length] ?? rule.levels.length} cantrips`;
  return leveled.length === 1
    ? `one level ${leveled[0]} spell`
    : `one spell each of level ${leveled.slice(0, -1).join(', ')} and ${leveled[leveled.length - 1]}`;
}

const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'two', 3: 'three', 4: 'four' };

/**
 * The stored choices after a write: the keys the write carries replace the
 * stored ones, then the result is cleaned. At a level-up a stored `skills`
 * stays, and an Arcane Archer who owes no skill gets `skills: []`.
 */
export function mergeSubclassChoices(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number, partial: SubclassChoices | null | undefined,
  write: SubclassChoiceWrite = {},
): SubclassChoices | null {
  const stored = owner.subclassChoices ?? {};
  const merged: SubclassChoices = { ...stored };
  for (const key of SUBCLASS_CHOICE_KEYS) {
    const value = partial?.[key];
    if (value == null) continue;
    if (key === 'skills' && write.levelUp && Array.isArray(stored.skills)) continue;
    Object.assign(merged, { [key]: value });
  }
  if (merged.skills == null && write.levelUp && skillRule(owner, subclass, level)?.count === 0) merged.skills = [];
  return cleanSubclassChoices(merged, owner, subclass, level);
}

/**
 * True when a stored key is missing or short of what the level asks for, so
 * the owner of a character in a campaign may still fill it in.
 */
export function subclassChoiceShort(
  owner: ChoiceOwner, level: number, key: keyof SubclassChoices,
): boolean {
  const stored = owner.subclassChoices ?? {};
  if (key === 'arcaneShots') return (stored.arcaneShots?.length ?? 0) < arcaneShotCount(level);
  return stored[key] == null;
}
