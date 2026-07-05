import { DndSpell } from '../models/dnd-api.types';
import { PcSpell } from '../models/pc';

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
