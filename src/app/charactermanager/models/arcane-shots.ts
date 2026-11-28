import {
  ARCANE_SHOT_OPTIONS, ChoiceOwner, arcaneShotCount, arcaneShotsOwed, hasArcaneShots, knownArcaneShots,
} from './arcana-subclasses';
import type { PC } from './pc';

/**
 * An Arcane Archer's Arcane Shot options (Arcana Unleashed): what each one
 * does, the Arcane Shot Die and the saving throw DC, and the rules for
 * choosing them at a level-up and from the character sheet.
 *
 * The names, how many a Fighter level gives and the stored list
 * (`pc.subclassChoices.arcaneShots`) live in models/arcana-subclasses; the
 * server owns the list and checks every write. Text is paraphrased.
 */

/** The ability a saving throw is made with. */
export type ArcaneShotSave = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface ArcaneShotOption {
  /** The option's full name, as it is stored ('Banishing Shot'). */
  name: string;
  /** What it does, in one or two sentences. */
  summary: string;
  /** The ability the target saves with; null for an option that allows no save. */
  save: ArcaneShotSave | null;
  /** How many Arcane Shot Dice of damage it deals. */
  dice: number;
  damageType: string;
}

const option = (
  name: string, dice: number, damageType: string, save: ArcaneShotSave | null, summary: string,
): ArcaneShotOption => ({ name, summary, save, dice, damageType });

/** The eight options, in alphabetical order (the order of ARCANE_SHOT_OPTIONS). */
export const ARCANE_SHOTS: readonly ArcaneShotOption[] = [
  option('Banishing Shot', 1, 'Psychic', 'CHA',
    'Extra damage on a hit. On a failed save the target is banished to a harmless demiplane, Incapacitated with a '
    + 'Speed of 0, and returns to the space it left at the end of its next turn.'),
  option('Beguiling Shot', 2, 'Psychic', 'WIS',
    'Extra damage on a hit. On a failed save the target is Charmed until the start of your next turn by you or by '
    + 'an ally within 30 feet of it. It ends early if the charmer attacks the target, damages it or forces it to '
    + 'make a save.'),
  option('Bursting Shot', 2, 'Force', null,
    'Right after the shot deals its damage, the target and every creature within 10 feet of it take this damage.'),
  option('Enfeebling Shot', 2, 'Necrotic', 'CON',
    'Extra damage on a hit. On a failed save the target is Poisoned until the end of its next turn, and each '
    + 'attack it hits with deals one roll of your Arcane Shot Die less damage.'),
  option('Grasping Shot', 1, 'Slashing', 'STR',
    'Extra damage on a hit. On a failed save brambles hold the target Restrained for 1 minute, or until you use '
    + 'this option again. The target or a creature within its reach can take an action to tear them off with a '
    + 'Strength (Athletics) check against the same DC.'),
  option('Piercing Shot', 2, 'Piercing', 'DEX',
    'No attack roll. The shot flies in a Line 30 feet long and 1 foot wide that ignores cover. Each creature in it '
    + 'takes the weapon\'s damage plus this damage on a failed save, or half as much on a success.'),
  option('Seeking Shot', 2, 'Force', 'DEX',
    'No attack roll. Choose a creature you have seen in the last minute: the shot bends around corners and ignores '
    + 'Half and Three-Quarters Cover. If it is within the weapon\'s long range it takes the weapon\'s damage plus '
    + 'this damage on a failed save, and you learn where it is; half as much on a success.'),
  option('Shadow Shot', 1, 'Psychic', 'WIS',
    'Extra damage on a hit. On a failed save the target is Blinded until the end of its next turn.'),
];

const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** The option behind a name (case-insensitive); undefined for anything else. */
export function arcaneShotOption(name: string | null | undefined): ArcaneShotOption | undefined {
  const key = lower(name);
  return key ? ARCANE_SHOTS.find(shot => lower(shot.name) === key) : undefined;
}

// ── The Arcane Shot Die and the saving throw DC ───────────────────────────────────────

/** The sides of the Arcane Shot Die at a Fighter level: d6, d8 from 10, d10 from 15, d12 from 18. */
export function arcaneShotDie(fighterLevel: number | null | undefined): number {
  const level = fighterLevel ?? 0;
  return level >= 18 ? 12 : level >= 15 ? 10 : level >= 10 ? 8 : 6;
}

/** Arcane Shot save DC: 8 plus the Intelligence modifier plus the Proficiency Bonus. */
export function arcaneShotSaveDc(intelligenceModifier: number, proficiencyBonus: number): number {
  return 8 + intelligenceModifier + proficiencyBonus;
}

/** The damage an option deals at a Fighter level, as dice and type: '2d8 Force'. */
export function arcaneShotDamage(shot: ArcaneShotOption, fighterLevel: number | null | undefined): string {
  return `${shot.dice}d${arcaneShotDie(fighterLevel)} ${shot.damageType}`;
}

const SAVE_NAMES: Readonly<Record<ArcaneShotSave, string>> = {
  STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma',
};

/** The save an option calls for, in words ('Wisdom save'); null when it calls for none. */
export function arcaneShotSaveName(shot: ArcaneShotOption): string | null {
  return shot.save ? `${SAVE_NAMES[shot.save]} save` : null;
}

/** An option's save with its DC ('Wisdom save, DC 15'); null when it calls for none. */
export function arcaneShotSaveLine(shot: ArcaneShotOption, dc: number): string | null {
  const save = arcaneShotSaveName(shot);
  return save ? `${save}, DC ${dc}` : null;
}

// ── Choosing options ────────────────────────────────────────────────────────────────

/** What a player may tick in one sitting. */
export interface ArcaneShotRule {
  /** The options the character knows already, in the order stored. */
  known: readonly string[];
  /** How many options the character knows once the choice is made. */
  count: number;
  /** How many of the known options may be left out for another. */
  swaps: number;
}

/**
 * The choice a level-up to `level` asks of an Arcane Archer; null for anyone
 * else, and at a level that leaves the stored options complete.
 *
 * Two options at Fighter 3 and one more at 7, 10, 15 and 18; at those four
 * levels one known option may also be replaced. A character that is short at
 * any other level (its subclass was set by hand) picks what is missing and
 * keeps what it knows. This is the server's rule: at most one known option
 * missing when the count rises, none otherwise.
 */
export function arcaneShotLevelUpRule(
  owner: ChoiceOwner, subclass: string | null | undefined, level: number,
): ArcaneShotRule | null {
  if (arcaneShotsOwed(owner, subclass, level) <= 0) return null;
  const count = arcaneShotCount(level);
  const known = knownArcaneShots(owner, level);
  return { known, count, swaps: known.length && count > arcaneShotCount(level - 1) ? 1 : 0 };
}

/**
 * The choice the character sheet offers through the subclass-choices endpoint,
 * for the character at its own level; null for anyone but an Arcane Archer.
 * `free` is whoever the server lets rewrite the list (the campaign's DM, or the
 * owner of a character in no campaign): any known option may go. Otherwise the
 * known options stay and only the missing ones are picked.
 */
export function arcaneShotSheetRule(
  pc: Pick<PC, 'clazz' | 'subclass' | 'level' | 'subclassChoices'>, free: boolean,
): ArcaneShotRule | null {
  const level = pc.level ?? 1;
  if (!hasArcaneShots(pc, pc.subclass, level)) return null;
  const known = knownArcaneShots(pc, level);
  return { known, count: arcaneShotCount(level), swaps: free ? known.length : 0 };
}

/** The known options a selection leaves out. */
function dropped(rule: ArcaneShotRule, selected: readonly string[]): number {
  return rule.known.filter(name => !selected.includes(name)).length;
}

/** A selection in the order it is sent: the known options kept, then the new ones in the table's order. */
function ordered(rule: ArcaneShotRule, selected: readonly string[]): string[] {
  return [
    ...rule.known.filter(name => selected.includes(name)),
    ...ARCANE_SHOT_OPTIONS.filter(name => selected.includes(name) && !rule.known.includes(name)),
  ];
}

/** Where a choice starts: everything the character knows, ticked. */
export function arcaneShotStart(rule: ArcaneShotRule): string[] {
  return [...rule.known];
}

/**
 * A level-up's choice in progress: the options ticked, and the known option
 * being replaced, if any ('' for none). The dialog names the option to replace
 * in a select, the way it swaps a Student of Arcana cantrip, so the known
 * options in the list stay fixed.
 */
export interface ArcaneShotDraft {
  selected: readonly string[];
  swap: string;
}

export function arcaneShotDraftStart(rule: ArcaneShotRule): ArcaneShotDraft {
  return { selected: arcaneShotStart(rule), swap: '' };
}

/**
 * The rule the tick list follows while a level-up's choice is in progress:
 * the known options are fixed, and the one being replaced is an ordinary
 * option again (ticking it back undoes the swap).
 */
export function arcaneShotListRule(rule: ArcaneShotRule, draft: ArcaneShotDraft): ArcaneShotRule {
  return { known: rule.known.filter(name => name !== draft.swap), count: rule.count, swaps: 0 };
}

/** The draft after the tick list changed. Ticking the replaced option back cancels the swap. */
export function withArcaneShotPicks(
  rule: ArcaneShotRule, draft: ArcaneShotDraft, selected: readonly string[],
): ArcaneShotDraft {
  return { selected: ordered(rule, selected), swap: selected.includes(draft.swap) ? '' : draft.swap };
}

/**
 * The draft after choosing the known option to replace ('' for none): that
 * option is unticked, the one given up before is ticked again, and new picks
 * the list no longer has room for are dropped, last first. A name the rule
 * does not let go of is no swap.
 */
export function swapArcaneShot(rule: ArcaneShotRule, draft: ArcaneShotDraft, name: string): ArcaneShotDraft {
  const swap = rule.swaps > 0 && rule.known.includes(name) ? name : '';
  const kept = rule.known.filter(known => known !== swap);
  const fresh = ARCANE_SHOT_OPTIONS
    .filter(option => draft.selected.includes(option) && !rule.known.includes(option))
    .slice(0, rule.count - kept.length);
  return { selected: [...kept, ...fresh], swap };
}

/**
 * True when ticking or unticking an option would break the rule, so its box is
 * disabled: a new option once the list is full, a known option when no (more)
 * swap is allowed.
 */
export function arcaneShotBlocked(rule: ArcaneShotRule, selected: readonly string[], name: string): boolean {
  if (!ARCANE_SHOT_OPTIONS.includes(name)) return true;
  if (!selected.includes(name)) return selected.length >= rule.count;
  return rule.known.includes(name) && dropped(rule, selected) >= rule.swaps;
}

/** The selection after ticking or unticking an option; unchanged when the rule does not allow it. */
export function toggleArcaneShot(rule: ArcaneShotRule, selected: readonly string[], name: string): string[] {
  if (arcaneShotBlocked(rule, selected, name)) return [...selected];
  return ordered(rule, selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
}

/**
 * True when a selection can be sent: exactly the count, real options, none
 * twice, and no more known options left out than the rule allows.
 */
export function arcaneShotsComplete(rule: ArcaneShotRule, selected: readonly string[]): boolean {
  return selected.length === rule.count
    && new Set(selected).size === selected.length
    && selected.every(name => ARCANE_SHOT_OPTIONS.includes(name))
    && dropped(rule, selected) <= rule.swaps;
}
