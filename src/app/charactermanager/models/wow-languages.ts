/**
 * Languages of the World of Warcraft module (chapter 2, Character Origins).
 *
 * A character of a World of Warcraft species chooses languages from these
 * tables instead of the Player's Handbook ones:
 * - Alliance: Common, plus two languages from the Alliance table.
 * - Horde: Orcish, plus two languages from the Horde table.
 * - Unaffiliated: any three from either table (Common or Orcish is the usual
 *   first pick, so both are on offer).
 *
 * Rare languages are secret or come from other planes; a character only learns
 * one through a feature, so the wizard never offers them. They are listed here
 * so a DM can grant one from the sheet.
 */

export type Allegiance = 'Alliance' | 'Horde' | 'Unaffiliated';

/** Every allegiance, in the order the wizard offers them. */
export const ALLEGIANCES: readonly Allegiance[] = ['Alliance', 'Horde', 'Unaffiliated'];

/** The Alliance table: what an Alliance character picks two from, beyond Common. */
export const WOW_ALLIANCE_LANGUAGES: readonly string[] = [
  'Common Sign Language', 'Darnassian', 'Draconic', 'Draenei', 'Dwarven', 'Gnomish', 'Hara\'ni', 'Pandaren',
  'Thalassian',
];

/** The Horde table: what a Horde character picks two from, beyond Orcish. */
export const WOW_HORDE_LANGUAGES: readonly string[] = [
  'Orcish Sign Language', 'Draconic', 'Goblin', 'Forsaken', 'Hara\'ni', 'Pandaren', 'Shalassian', 'Taur-ahe',
  'Thalassian', 'Vulpera', 'Zandali',
];

/** Secret or otherworldly tongues, learned only through a feature. */
export const WOW_RARE_LANGUAGES: readonly string[] = [
  'Cyphers of the First Ones', 'Druidic', 'Eredun', 'Furbolg', 'Kalimag', 'Nathrezim', 'Nazja', 'Nerglish',
  'Nerubian', 'Ogre', 'Qiraji', 'Shath\'Yar', 'Thieves\' Cant', 'Titan', 'Vrykul',
];

/** Every World of Warcraft language once: the two faction tongues, both tables, then the rare ones. */
export const WOW_LANGUAGE_NAMES: readonly string[] = [...new Set([
  'Common', 'Orcish', ...WOW_ALLIANCE_LANGUAGES, ...WOW_HORDE_LANGUAGES, ...WOW_RARE_LANGUAGES,
])];

/** The language an allegiance gives outright: Common, Orcish, or none for the unaffiliated. */
export function allegianceBaseLanguage(allegiance: Allegiance | ''): string {
  return allegiance === 'Alliance' ? 'Common' : allegiance === 'Horde' ? 'Orcish' : '';
}

/** How many languages the player picks: two beside the faction tongue, or three with none. */
export function allegiancePickCount(allegiance: Allegiance | ''): number {
  return allegiance === 'Unaffiliated' ? 3 : 2;
}

/** The languages on offer for an allegiance, in table order; none until one is chosen. */
export function allegianceLanguageOptions(allegiance: Allegiance | ''): readonly string[] {
  switch (allegiance) {
    case 'Alliance': return WOW_ALLIANCE_LANGUAGES;
    case 'Horde': return WOW_HORDE_LANGUAGES;
    case 'Unaffiliated': return UNAFFILIATED_LANGUAGES;
    default: return NO_LANGUAGES;
  }
}

const NO_LANGUAGES: readonly string[] = [];
const UNAFFILIATED_LANGUAGES: readonly string[] = [...new Set([
  'Common', 'Orcish', ...WOW_ALLIANCE_LANGUAGES, ...WOW_HORDE_LANGUAGES,
])];

/** One line under the language pickers saying what the allegiance gives. */
export function allegianceLanguageHint(allegiance: Allegiance | ''): string {
  switch (allegiance) {
    case 'Alliance': return 'You know Common, plus two languages of the Alliance.';
    case 'Horde': return 'You know Orcish, plus two languages of the Horde.';
    case 'Unaffiliated':
      return 'You know three languages from either faction. Common or Orcish is the usual first choice.';
    default: return 'Choose an allegiance to see its languages.';
  }
}

/**
 * The side a species (and lineage) usually stands with — a starting point the
 * player can change. '' where the book leaves it open: dracthyr, earthen,
 * goblins, haranir and pandaren choose for themselves, as do high elves, the
 * Krokul and Man'ari, and Amani trolls.
 */
export function suggestedAllegiance(species: string, lineage: string): Allegiance | '' {
  switch (species) {
    case 'Dwarf': case 'Gnome': case 'Mechagnome': case 'Human': case 'Worgen':
      return 'Alliance';
    case 'Forsaken': case 'Orc': case 'Tauren': case 'Vulpera':
      return 'Horde';
    case 'Draenei':
      return lineage === 'Draenei' || lineage === 'Lightforged' ? 'Alliance' : '';
    case 'Elf':
      if (lineage === 'Night Elf' || lineage === 'Void Elf') return 'Alliance';
      return lineage === 'Blood Elf' || lineage === 'Nightborne' ? 'Horde' : '';
    case 'Troll':
      return lineage === 'Darkspear Troll' || lineage === 'Zandalari Troll' ? 'Horde' : '';
    default:
      return '';
  }
}

/**
 * The languages a World of Warcraft character starts with: the allegiance's
 * own tongue, then the picks that are on its table — as many as it allows,
 * each once.
 */
export function wowStartingLanguages(allegiance: Allegiance | '', picks: readonly string[]): string[] {
  const options = allegianceLanguageOptions(allegiance);
  const valid = [...new Set(picks.filter(p => !!p && options.includes(p)))].slice(0, allegiancePickCount(allegiance));
  const base = allegianceBaseLanguage(allegiance);
  return [...(base ? [base] : []), ...valid];
}
