/**
 * Spell-name aliases for by-name lookups in the shared spell data.
 *
 * The World of Warcraft module (and the hero-class tables built from it) uses a
 * few spell names that differ from the SRD 5.2 data, which drops proper names
 * from some spells — the module's "Evard's Black Tentacles" is the SRD's
 * "Black Tentacles", and its "Otiluke's Freezing Sphere" is the SRD's
 * "Freezing Sphere" (the WoW Mage adds Bigby's Hand → "Arcane Hand",
 * Mordenkainen's Sword → "Arcane Sword" and Otiluke's Resilient Sphere →
 * "Resilient Sphere"). The 2024 subclass spell lists the server grants from use
 * three more proper names (Leomund's Tiny Hut, Rary's Telepathic Bond, Tasha's
 * Hideous Laughter). Every by-name lookup goes through {@link spellKey}, so a
 * table can keep the module's wording and still find the spell's text.
 *
 * Keys and values are lower-cased: alias → the name the spell data uses.
 */
export const SPELL_NAME_ALIASES: Readonly<Record<string, string>> = {
  "bigby's hand": 'arcane hand',
  "evard's black tentacles": 'black tentacles',
  "leomund's tiny hut": 'tiny hut',
  "mordenkainen's sword": 'arcane sword',
  "otiluke's freezing sphere": 'freezing sphere',
  "otiluke's resilient sphere": 'resilient sphere',
  "rary's telepathic bond": 'telepathic bond',
  "tasha's hideous laughter": 'hideous laughter',
};

/** The lookup key for a spell name: lower-cased, with any alias resolved to the spell data's own name. */
export function spellKey(name: string): string {
  const lower = name.toLowerCase();
  return SPELL_NAME_ALIASES[lower] ?? lower;
}
