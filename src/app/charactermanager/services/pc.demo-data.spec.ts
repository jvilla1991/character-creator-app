import { DEMO_PCS, demoFightingStyleOptions, demoSubclassOptions } from './pc.demo-data';
import { heroClassFor, subclassSpellsFor } from '../models/hero-class';

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
});
