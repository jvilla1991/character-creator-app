/**
 * Spell-name aliases for by-name lookups in the shared spell data.
 *
 * The World of Warcraft module (and the hero-class tables built from it) uses a
 * few spell names that differ from the SRD 5.2 data, which drops proper names
 * from some spells — the module's "Evard's Black Tentacles" is the SRD's
 * "Black Tentacles", and its "Otiluke's Freezing Sphere" is the SRD's
 * "Freezing Sphere". Every by-name lookup goes through {@link spellKey}, so a
 * table can keep the module's wording and still find the spell's text.
 *
 * Keys and values are lower-cased: alias → the name the spell data uses.
 */
export const SPELL_NAME_ALIASES: Readonly<Record<string, string>> = {
  "evard's black tentacles": 'black tentacles',
  "otiluke's freezing sphere": 'freezing sphere',
};

/** The lookup key for a spell name: lower-cased, with any alias resolved to the spell data's own name. */
export function spellKey(name: string): string {
  const lower = name.toLowerCase();
  return SPELL_NAME_ALIASES[lower] ?? lower;
}
