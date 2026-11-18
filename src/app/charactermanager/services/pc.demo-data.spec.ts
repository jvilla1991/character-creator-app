import { DEMO_PCS, demoFightingStyleOptions, demoSubclassOptions } from './pc.demo-data';
import { heroClassFor, subclassSpellsFor } from '../models/hero-class';
import { classDisplayName } from '../utils/class-display';

describe('pc.demo-data (WoW mirrors)', () => {
  it('offers Blessed Warrior to every paladin and Druidic Warrior to every ranger at level 2', () => {
    expect(demoFightingStyleOptions('Paladin', undefined, 2)).toContain('Blessed Warrior');
    expect(demoFightingStyleOptions('Paladin', undefined, 2)).not.toContain('Druidic Warrior');
    expect(demoFightingStyleOptions('Ranger', undefined, 2)).toContain('Druidic Warrior');
    expect(demoFightingStyleOptions('Ranger', undefined, 2)).not.toContain('Void Warrior');
    expect(demoFightingStyleOptions('Ranger', 'Demon Hunter', 2)).toEqual(
      jasmine.arrayContaining(['Druidic Warrior', 'Void Warrior']));
    expect(demoFightingStyleOptions('Paladin', undefined, 3)).toEqual([]);
  });

  it('offers Oath of the Holy only to WoW paladins', () => {
    expect(demoSubclassOptions('Paladin', 'Holy')).toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', 'Retribution')).toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', null)).not.toContain('Oath of the Holy');
    expect(demoSubclassOptions('Paladin', 'Blood')).not.toContain('Oath of the Holy');
    expect(demoSubclassOptions('Druid', 'Balance')).not.toContain('Oath of the Holy');
  });

  it('offers the Swashbuckler only to WoW rogues', () => {
    expect(demoSubclassOptions('Rogue', 'Outlaw')).toEqual(['Arcane Trickster', 'Assassin', 'Soulknife', 'Swashbuckler', 'Thief']);
    expect(demoSubclassOptions('Rogue', 'Assassination')).toContain('Swashbuckler');
    expect(demoSubclassOptions('Rogue', null)).not.toContain('Swashbuckler');
    expect(demoSubclassOptions('Rogue', 'Holy')).not.toContain('Swashbuckler');
    expect(demoSubclassOptions('Paladin', 'Holy')).not.toContain('Swashbuckler');
    expect(demoSubclassOptions('Fighter', 'Outlaw')).not.toContain('Swashbuckler');
  });

  it('offers the two WoW paths only to WoW barbarians', () => {
    expect(demoSubclassOptions('Barbarian', 'Elemental')).toEqual([
      'Path of the Berserker', 'Path of the Elements', 'Path of the Spiritual Guardian',
      'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot',
    ]);
    expect(demoSubclassOptions('Barbarian', 'Restoration')).toContain('Path of the Spiritual Guardian');
    expect(demoSubclassOptions('Barbarian', null)).toEqual([
      'Path of the Berserker', 'Path of the Wild Heart', 'Path of the World Tree', 'Path of the Zealot',
    ]);
    expect(demoSubclassOptions('Barbarian', 'Outlaw')).not.toContain('Path of the Elements');
    expect(demoSubclassOptions('Druid', 'Restoration')).not.toContain('Path of the Elements');
    expect(demoSubclassOptions('Druid', 'Restoration')).toContain('Circle of the Land');
  });

  it('seeds a level-10 Elemental orc shaman with the Path of the Elements', () => {
    const pc = DEMO_PCS.find(p => p.subclass === 'Path of the Elements')!;
    expect(pc.clazz).toBe('Barbarian');
    expect(pc.race).toBe('Orc');
    expect(pc.specialization).toBe('Elemental');
    expect(pc.level).toBe(10);
    expect(heroClassFor(pc)?.key).toBe('Barbarian (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Shaman (Barbarian)');
    expect((pc.features ?? []).map(f => f.name)).toEqual(jasmine.arrayContaining(['Totems', 'Raging Elements']));
    expect((pc.features ?? []).map(f => f.name)).not.toContain('Primal Knowledge');
    const cards = heroClassFor(pc)!.featureCards!({ level: pc.level!, subclass: pc.subclass, stats: pc.stats, prof: pc.prof });
    expect(cards.map(c => c.name)).toEqual(['Totems', 'Raging Elements']);
  });

  it('seeds a level-9 Outlaw WoW rogue with the Swashbuckler', () => {
    const pc = DEMO_PCS.find(p => p.subclass === 'Swashbuckler')!;
    expect(pc.clazz).toBe('Rogue');
    expect(pc.specialization).toBe('Outlaw');
    expect(pc.level).toBe(9);
    expect(heroClassFor(pc)?.key).toBe('Rogue (World of Warcraft)');
    expect((pc.features ?? []).map(f => f.name)).toEqual(jasmine.arrayContaining(['Fancy Footwork', 'Panache']));
  });

  it('seeds a level-7 Holy WoW paladin with the Oath of the Holy and some suggested spells', () => {
    const pc = DEMO_PCS.find(p => p.subclass === 'Oath of the Holy')!;
    expect(pc.clazz).toBe('Paladin');
    expect(pc.specialization).toBe('Holy');
    expect(pc.level).toBe(7);
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Paladin (World of Warcraft)');
    expect(subclassSpellsFor(hero, pc.subclass, pc.level!).map(s => s.name))
      .toEqual(['Cure Wounds', 'Healing Word', 'Lesser Restoration', 'Prayer of Healing']);
    const suggested = hero!.suggestedSpells!['Holy'].flatMap(r => r.spells);
    expect((pc.spells ?? []).filter(s => suggested.includes(s.name)).length).toBeGreaterThanOrEqual(2);
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('seeds a level-5 Demonology WoW warlock with the Fiend Patron and the recommended starting picks', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Warlock' && p.specialization === 'Demonology')!;
    expect(pc).toBeDefined();
    expect(pc.level).toBe(5);
    expect(pc.subclass).toBe('Fiend Patron');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Warlock (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Warlock');
    expect((pc.spells ?? []).map(s => s.name)).toEqual(['Eldritch Blast', 'Toll the Dead', 'Hex', 'Arms of Hadar']);
    expect(Object.keys(pc.spellSlots ?? {})).toEqual(['3']);
    // Warlocks get no WoW-only patron: the demo offers the plain warlock list (none server-side).
    expect(demoSubclassOptions('Warlock', 'Demonology')).toEqual([]);
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });
});
