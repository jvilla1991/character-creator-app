/**
 * Level-2 Fighting Styles that teach cantrips from another class's spell list.
 * Picking one at level-up requires exactly {@link CantripFightingStyle.count}
 * cantrips from that list the character doesn't already know; they ride along
 * in `newSpells` with the commit. The server decides who is offered which style
 * (Blessed Warrior: every paladin; Druidic Warrior: every ranger; Void Warrior:
 * Demon Hunter rangers; Arcane Warrior, the Arcana Unleashed Fighting Style
 * feat: everyone with the choice) — this table only says what each one teaches.
 */
export interface CantripFightingStyle {
  /** The style name as offered by the server ('Blessed Warrior'). */
  style: string;
  /** The class whose cantrip list it draws from, lower-case ('cleric'). */
  spellList: string;
  /** The class name for display ('Cleric'). */
  className: string;
  /** How many cantrips the style teaches. */
  count: number;
  /** A pick suggestion shown above the picker, if any. */
  hint?: string;
}

export const BLESSED_WARRIOR = 'Blessed Warrior';
export const DRUIDIC_WARRIOR = 'Druidic Warrior';
export const VOID_WARRIOR = 'Void Warrior';
export const ARCANE_WARRIOR_STYLE = 'Arcane Warrior';

export const CANTRIP_FIGHTING_STYLES: readonly CantripFightingStyle[] = [
  {
    style: BLESSED_WARRIOR, spellList: 'cleric', className: 'Cleric', count: 2,
    hint: 'Pick two Cleric cantrips — Sacred Flame and Spare the Dying are a strong pair.',
  },
  { style: DRUIDIC_WARRIOR, spellList: 'druid', className: 'Druid', count: 2 },
  {
    style: VOID_WARRIOR, spellList: 'warlock', className: 'Warlock', count: 2,
    hint: 'Pick two Warlock cantrips — Chill Touch and Mind Sliver are a strong pair.',
  },
  {
    style: ARCANE_WARRIOR_STYLE, spellList: 'wizard', className: 'Wizard', count: 2,
    hint: 'Pick two Wizard cantrips — Mage Hand and Ray of Frost are a good pair.',
  },
];

/** The cantrip-teaching entry for a fighting style; undefined for an ordinary style. */
export function cantripFightingStyle(style: string | null | undefined): CantripFightingStyle | undefined {
  return style ? CANTRIP_FIGHTING_STYLES.find(c => c.style === style) : undefined;
}
