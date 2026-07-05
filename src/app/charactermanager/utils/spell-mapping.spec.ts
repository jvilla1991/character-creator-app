import { toPcSpell } from './spell-mapping';
import { DndSpell } from '../models/dnd-api.types';

function dndSpell(overrides: Partial<DndSpell> = {}): DndSpell {
  return {
    name: 'Hold Person',
    level: 2,
    school: 'enchantment',
    classes: ['bard', 'cleric'],
    actionType: '1 action',
    concentration: true,
    ritual: false,
    range: '60 feet',
    components: ['v', 's', 'm'],
    duration: 'Concentration, up to 1 minute',
    description: 'Choose a humanoid...',
    material: 'a small, straight piece of iron',
    higherLevelSlot: 'you can target one additional humanoid...',
    ...overrides,
  };
}

describe('spell-mapping', () => {

  describe('toPcSpell', () => {
    it('maps every field, field-for-field', () => {
      const s = dndSpell();

      expect(toPcSpell(s)).toEqual({
        lvl: 2,
        name: 'Hold Person',
        school: 'enchantment',
        time: '1 action',
        prepared: true,
        concentration: true,
        ritual: false,
        range: '60 feet',
        components: ['v', 's', 'm'],
        duration: 'Concentration, up to 1 minute',
        description: 'Choose a humanoid...',
        material: 'a small, straight piece of iron',
        higherLevelSlot: 'you can target one additional humanoid...',
      });
    });

    it('always marks the spell prepared, regardless of source data', () => {
      const s = dndSpell();
      expect(toPcSpell(s).prepared).toBeTrue();
    });

    it('maps a cantrip (level 0) with its actionType as time', () => {
      const s = dndSpell({ name: 'Light', level: 0, actionType: '1 action', concentration: false, ritual: false });
      const pc = toPcSpell(s);
      expect(pc.lvl).toBe(0);
      expect(pc.time).toBe('1 action');
    });

    it('carries through undefined optional fields as-is', () => {
      const s = dndSpell({ material: undefined, higherLevelSlot: undefined });
      const pc = toPcSpell(s);
      expect(pc.material).toBeUndefined();
      expect(pc.higherLevelSlot).toBeUndefined();
    });
  });

});
