import { DEMO_PCS, demoFeatOptions, demoFightingStyleOptions, demoSlotsFor, demoSubclassOptions } from './pc.demo-data';
import { heroClassFor, heroClassSpells, subclassSpellsFor } from '../models/hero-class';
import { classDisplayName } from '../utils/class-display';
import { breakdownOf } from '../utils/stat-breakdown';

describe('pc.demo-data (ability breakdown)', () => {
  it('seeds a character whose Strength opens as a base score, a background line and a level increase', () => {
    const isolde = DEMO_PCS.find(p => p.name === 'Isolde Grimhallow')!;
    const strength = breakdownOf(isolde, 'STR');
    expect(strength.auto).toEqual([{ label: 'Base score', value: 14 }]);
    expect(strength.adjustments).toEqual([
      { value: 2, label: 'Soldier' }, { value: 1, label: 'Level 4 Increase' },
    ]);
    expect(strength.total).toBe(17);
    // The lines only explain the scores; the scores themselves are as they were.
    expect(isolde.stats).toEqual({ STR: 17, DEX: 10, CON: 15, INT: 8, WIS: 12, CHA: 14 });
    expect(breakdownOf(isolde, 'CON').auto[0].value).toBe(13);
  });
});

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

  it('seeds a level-7 Protection orc warrior Battle Master whose sheet shows the Battle Master card', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Fighter' && p.specialization === 'Protection')!;
    expect(pc).toBeDefined();
    expect(pc.race).toBe('Orc');
    expect(pc.level).toBe(7);
    expect(pc.subclass).toBe('Battle Master');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Fighter (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Warrior (Fighter)');
    const cards = hero!.featureCards!({ level: pc.level!, subclass: pc.subclass, stats: pc.stats, prof: pc.prof });
    expect(cards.map(c => c.name)).toEqual(['Battle Master']);
    const stat = (label: string) => cards[0].stats!.find(s => s.label === label)?.value;
    expect([stat('Superiority Dice'), stat('Die'), stat('Maneuver DC')]).toEqual(['5', 'd8', '14']);
    expect(pc.spells).toEqual([]);
    // The fighter's only WoW guidance is text: no WoW-only subclass joins the demo list.
    expect(demoSubclassOptions('Fighter', 'Protection')).toEqual(['Battle Master', 'Champion', 'Eldritch Knight', 'Psi Warrior']);
    // A fighter's Fighting Style is a level-1 choice — never due on level-up.
    expect(demoFightingStyleOptions('Fighter', undefined, 2)).toEqual([]);
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('offers the Discipline and Shadow domains only to WoW clerics', () => {
    for (const spec of ['Discipline', 'Holy', 'Shadow']) {
      expect(demoSubclassOptions('Cleric', spec)).withContext(spec).toEqual(jasmine.arrayContaining(['Discipline Domain', 'Shadow Domain', 'Life Domain']));
    }
    expect(demoSubclassOptions('Cleric', 'Shadow')).toEqual([...demoSubclassOptions('Cleric', 'Shadow')].sort((a, b) => a.localeCompare(b)));
    expect(demoSubclassOptions('Cleric', null)).not.toContain('Discipline Domain');
    expect(demoSubclassOptions('Cleric', null)).not.toContain('Shadow Domain');
    expect(demoSubclassOptions('Cleric', 'Frost')).not.toContain('Shadow Domain');
    expect(demoSubclassOptions('Paladin', 'Holy')).not.toContain('Discipline Domain');
  });

  it('seeds a level-6 Shadow night elf priest on the Shadow Domain whose sheet shows the domain card and spells', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Cleric' && p.specialization === 'Shadow')!;
    expect(pc).toBeDefined();
    expect(pc.race).toBe('Elf');
    expect(pc.bio).toContain('night elf');
    expect(pc.level).toBe(6);
    expect(pc.subclass).toBe('Shadow Domain');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Cleric (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Priest (Cleric)');
    const cards = hero!.featureCards!({ level: pc.level!, subclass: pc.subclass, stats: pc.stats, prof: pc.prof });
    expect(cards.map(c => c.name)).toEqual(['Shadow Domain']);
    expect(cards[0].rows.map(r => r.name)).toEqual(['Shadowform', 'Devouring Plague', 'Dispersion']);
    expect(cards[0].stats).toEqual([{ label: 'Devouring Plague', value: '3 / Long Rest' }]);
    expect(subclassSpellsFor(hero, pc.subclass, pc.level!).map(s => s.name)).toEqual([
      'Crown of Madness', 'Dissonant Whispers', 'Mind Spike', 'Shadow Word: Pain', 'Summon Undead', 'Vampiric Touch',
    ]);
    // The four recommended Shadow cantrips, plus Blur from the priest's added spell list.
    expect((pc.spells ?? []).filter(s => s.lvl === 0).map(s => s.name))
      .toEqual(['Mending', 'Resistance', 'Thaumaturgy', 'Toll the Dead']);
    expect((pc.spells ?? []).map(s => s.name)).toContain('Blur');
    expect(Object.keys(pc.spellSlots ?? {})).toEqual(['1', '2', '3']);
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('seeds a level-5 Devastation evoker on Draconic Sorcery whose sheet shows the Evoker Spells', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Sorcerer' && p.specialization === 'Devastation')!;
    expect(pc).toBeDefined();
    expect(pc.race).toBe('Dragonborn');
    expect(pc.bio).toContain('dracthyr');
    expect(pc.level).toBe(5);
    expect(pc.subclass).toBe('Draconic Sorcery');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Sorcerer (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Evoker (Sorcerer)');
    expect(heroClassSpells(hero!, pc.level!, pc.specialization).map(s => s.name)).toEqual([
      'Chromatic Orb', "Dragon's Breath", 'Azure Strike', 'Scorching Ray', 'Fly', 'Fireball',
    ]);
    // The four recommended Devastation cantrips (plus one more at Sorcerer 4).
    expect((pc.spells ?? []).filter(s => s.lvl === 0).map(s => s.name))
      .toEqual(jasmine.arrayContaining(['Elementalism', 'Light', 'Ray of Frost', 'Sorcerous Burst']));
    expect(Object.keys(pc.spellSlots ?? {})).toEqual(['1', '2', '3']);
    // A sorcerer's subclass is chosen at level 1, so the demo never offers one on level-up.
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('seeds a level-6 Beast Mastery hunter Beast Master with a Wolf pet', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Ranger' && p.specialization === 'Beast Mastery')!;
    expect(pc).toBeDefined();
    expect(pc.level).toBe(6);
    expect(pc.subclass).toBe('Beast Master');
    expect(pc.petFamily).toBe('Wolf');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Ranger (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Hunter (Ranger)');
    expect((pc.features ?? []).map(f => f.name)).toContain('Pet Specialization');
    expect((pc.features ?? []).map(f => f.name)).not.toContain('Roving');
    // Every other demo character has no pet.
    expect(DEMO_PCS.filter(p => p.petFamily).map(p => p.id)).toEqual([pc.id]);
    // The Demon Hunter demo is still read as the Demon Hunter, not the WoW Hunter.
    const dh = DEMO_PCS.find(p => p.subclass === 'Demon Hunter')!;
    expect(heroClassFor(dh)?.label).toBe('Demon Hunter (Ranger)');
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('seeds a level-5 Frost mage on the Evoker school who knows Ray of Frost, Frost Nova and Ice Knife', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Wizard' && p.specialization === 'Frost')!;
    expect(pc).toBeDefined();
    expect(pc.level).toBe(5);
    expect(pc.subclass).toBe('Evoker');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Wizard (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Mage (Wizard)');
    const names = (pc.spells ?? []).map(s => s.name);
    expect(names).toEqual(jasmine.arrayContaining(['Ray of Frost', 'Frost Nova', 'Ice Knife']));
    expect((pc.spells ?? []).filter(s => s.lvl === 0).map(s => s.name))
      .toEqual(jasmine.arrayContaining(['Light', 'Mage Hand', 'Ray of Frost']));
    expect(Object.keys(pc.spellSlots ?? {})).toEqual(['1', '2', '3']);
    expect(pc.bio).toContain('Kirin Tor');
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('offers the World of Warcraft mage feats among the General feats at an ASI level', () => {
    for (const clazz of ['Wizard', 'Fighter', 'Barbarian']) {
      expect(demoFeatOptions(clazz, 4)).withContext(clazz)
        .toEqual(jasmine.arrayContaining(['Clearcasting', 'Fingers of Frost', 'Hot Streak', 'War Caster']));
    }
    const options = demoFeatOptions('Wizard', 8);
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)));
    expect(new Set(options).size).toBe(options.length);
  });

  it('offers the Warrior of Mystic Brews only to WoW monks', () => {
    expect(demoSubclassOptions('Monk', 'Brewmaster')).toContain('Warrior of Mystic Brews');
    expect(demoSubclassOptions('Monk', 'Windwalker')).toContain('Warrior of Mystic Brews');
    expect(demoSubclassOptions('Monk', null)).not.toContain('Warrior of Mystic Brews');
    expect(demoSubclassOptions('Fighter', 'Brewmaster')).not.toContain('Warrior of Mystic Brews');
  });

  it('seeds a level-6 Brewmaster monk on the Warrior of Mystic Brews with WIS 16', () => {
    const pc = DEMO_PCS.find(p => p.clazz === 'Monk' && p.specialization === 'Brewmaster')!;
    expect(pc).toBeDefined();
    expect(pc.level).toBe(6);
    expect(pc.subclass).toBe('Warrior of Mystic Brews');
    expect(pc.stats?.WIS).toBe(16);
    expect(pc.bio).toContain('pandaren');
    const hero = heroClassFor(pc);
    expect(hero?.key).toBe('Monk (World of Warcraft)');
    expect(classDisplayName(pc.clazz, pc.subclass, pc.specialization)).toBe('Monk');
    const cards = hero!.featureCards!({ level: pc.level!, subclass: pc.subclass, stats: pc.stats, prof: pc.prof });
    expect(cards.map(c => c.name)).toEqual(['Warrior of Mystic Brews', 'Mystic Brew']);
    expect((pc.features ?? []).map(f => f.name)).toEqual(jasmine.arrayContaining(['Drunken Technique', 'Mystic Brew']));
    expect(new Set(DEMO_PCS.map(p => p.id)).size).toBe(DEMO_PCS.length);
  });

  it('offers the World of Warcraft monk feats only with DEX 13+ and WIS 13+', () => {
    const monkFeats = ['Elusive Brawler', 'Enveloping Mist', 'Fists of Fury', 'Stagger and Sway'];
    expect(demoFeatOptions('Monk', 8, { DEX: 13, WIS: 13 })).toEqual(jasmine.arrayContaining(monkFeats));
    expect(demoFeatOptions('Fighter', 4, { DEX: 16, WIS: 14 })).toEqual(jasmine.arrayContaining(monkFeats));
    for (const stats of [{ DEX: 12, WIS: 16 }, { DEX: 16, WIS: 12 }, {}, undefined]) {
      const options = demoFeatOptions('Monk', 4, stats);
      for (const feat of monkFeats) expect(options).withContext(JSON.stringify(stats)).not.toContain(feat);
    }
    const options = demoFeatOptions('Monk', 4, { DEX: 16, WIS: 16 });
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)));
  });
});

describe('pc.demo-data (spell slots)', () => {
  it('levels a demo Paladin or Ranger up on the half-caster table, like the server', () => {
    expect(demoSlotsFor('Paladin', 1)).toEqual({ 1: 2 });
    expect(demoSlotsFor('Ranger', 5)).toEqual({ 1: 4, 2: 2 });
    expect(demoSlotsFor('Paladin', 9)).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(demoSlotsFor('Ranger', 20)).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 });
    expect(demoSlotsFor('Wizard', 5)).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(demoSlotsFor('Warlock', 5)).toEqual({ 3: 2 });
    expect(demoSlotsFor('Fighter', 5)).toEqual({});
  });

  it('seeds every demo caster with the slot maximums its class table gives at its level', () => {
    const casters = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard', 'warlock', 'paladin', 'ranger'];
    const seeded = DEMO_PCS.filter(pc => casters.includes(pc.clazz.toLowerCase()));
    expect(seeded.length).toBeGreaterThan(0);
    for (const pc of seeded) {
      const max = Object.fromEntries(Object.entries(pc.spellSlots ?? {}).map(([lvl, slot]) => [lvl, slot.max]));
      expect(max).withContext(`${pc.name} (${pc.clazz} ${pc.level})`)
        .toEqual(demoSlotsFor(pc.clazz, pc.level ?? 1) as Record<string, number>);
    }
  });
});
