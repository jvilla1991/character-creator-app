import { DndSpell } from '../models/dnd-api.types';
import { PcSpell } from '../models/pc';
import { spellKey } from '../models/spell-names';

/**
 * Converts a reference spell (SRD asset shape) into the lean PcSpell snapshot stored
 * on a character. Extracted verbatim from the level-up modal's confirm-time mapping
 * so both level-up and DM spell grants stamp identical fields — newly learned spells
 * are always marked prepared, matching how the level-up flow has always granted them.
 */
export function toPcSpell(s: DndSpell): PcSpell {
  return {
    lvl: s.level,
    name: s.name,
    school: s.school,
    time: s.actionType,
    prepared: true,
    concentration: s.concentration,
    ritual: s.ritual,
    range: s.range,
    components: s.components,
    duration: s.duration,
    description: s.description,
    material: s.material,
    higherLevelSlot: s.higherLevelSlot,
  };
}

/**
 * The snapshot of a spell a feature always keeps prepared: {@link toPcSpell}
 * plus the `alwaysPrepared` marker and what grants it. A cantrip needs no
 * marker (cantrips are never counted), so it only records the source.
 */
export function toGrantedSpell(s: DndSpell, grantedBy: string): PcSpell {
  const spell = toPcSpell(s);
  return s.level > 0 ? { ...spell, alwaysPrepared: true, grantedBy } : { ...spell, grantedBy };
}

/**
 * True for a placeholder spell text: the description starts with "TBD", the
 * marker the World of Warcraft spell stubs carried until their full text
 * landed (the same test the spell data's own specs use).
 */
export function isPlaceholderSpell(spell: { description?: string }): boolean {
  return (spell.description ?? '').startsWith('TBD');
}

/**
 * The spell to DISPLAY for a saved snapshot. A character keeps a copy of each
 * spell it learned, so one learned while its catalog entry was still a "TBD"
 * stub keeps that stub forever. When the saved copy is such a placeholder and
 * the catalog (lower-cased name → spell, looked up via {@link spellKey}) now
 * has the finished text, this returns a new object with the catalog's text
 * mapped through {@link toPcSpell}; anything else (homebrew, a spell missing
 * from the catalog, a still-unfinished catalog entry, or a real snapshot even
 * when it differs from the catalog) comes back as the same reference.
 *
 * Kept from the saved copy, as the character's own state rather than catalog
 * data: `prepared`, `name` (the character's wording, e.g. an alias), any extra
 * keys the save carries, and `lvl`: casting and slot spending are checked
 * against the SAVED level (applyCastToPc here, SessionService on the server),
 * so showing a different level would offer slots the cast then rejects.
 *
 * Display only: never write the result back to the character. Never mutates.
 */
export function refreshStaleSpell(saved: PcSpell, catalog: ReadonlyMap<string, DndSpell>): PcSpell {
  if (!isPlaceholderSpell(saved)) return saved;
  const entry = catalog.get(spellKey(saved.name));
  if (!entry || isPlaceholderSpell(entry)) return saved;
  return {
    ...saved,
    ...toPcSpell(entry),
    name: saved.name,
    lvl: saved.lvl,
    prepared: saved.prepared,
  };
}
