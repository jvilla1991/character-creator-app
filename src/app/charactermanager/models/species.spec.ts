import { ALL_SKILLS } from '../services/dnd-resources.service';
import {
  buildSpeciesOptions, catalogSpeciesByKey, sizeLabel, speciesTraitFeatures, speciesTraitSource, toSpeciesDetail,
} from './species';
import { WOW_SPECIES } from './wow-species';

describe('species catalog (World of Warcraft)', () => {
  const byName = (name: string) => WOW_SPECIES.find(s => s.name === name)!;

  it('holds the seventeen species of the module, in book order', () => {
    expect(WOW_SPECIES.map(s => s.name)).toEqual([
      'Dracthyr', 'Draenei', 'Dwarf', 'Earthen', 'Elf', 'Forsaken', 'Gnome', 'Mechagnome', 'Goblin', 'Haranir',
      'Human', 'Orc', 'Pandaren', 'Tauren', 'Troll', 'Vulpera', 'Worgen',
    ]);
  });

  it('gives every species a unique key that carries the source', () => {
    const keys = WOW_SPECIES.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of WOW_SPECIES) {
      expect(s.key).toBe(`${s.name} (World of Warcraft)`);
      expect(s.source).toBe('World of Warcraft');
    }
  });

  it('every species has traits with a name and a description, and a 30-foot Speed', () => {
    for (const s of WOW_SPECIES) {
      expect(s.traits.length).withContext(s.name).toBeGreaterThan(0);
      expect(s.speed).withContext(s.name).toBe(30);
      for (const t of s.traits) {
        expect(t.name.trim()).withContext(s.name).not.toBe('');
        expect(t.desc.trim()).withContext(`${s.name} / ${t.name}`).not.toBe('');
      }
      expect(new Set(s.traits.map(t => t.name)).size).withContext(s.name).toBe(s.traits.length);
    }
  });

  it('a Darkvision trait and the darkvision range always agree', () => {
    for (const s of WOW_SPECIES) {
      const trait = s.traits.find(t => t.name === 'Darkvision');
      expect(!!trait).withContext(s.name).toBe(s.darkvision != null);
      if (trait) expect(trait.desc).withContext(s.name).toContain(`${s.darkvision} feet`);
    }
  });

  it('the species without Darkvision are Human, Mechagnome and Tauren', () => {
    expect(WOW_SPECIES.filter(s => s.darkvision == null).map(s => s.name)).toEqual(['Mechagnome', 'Human', 'Tauren']);
  });

  it('a lineage trait and its lineages always come together', () => {
    for (const s of WOW_SPECIES) {
      expect(!!s.lineageTrait).withContext(s.name).toBe(!!s.lineages?.length);
      if (s.lineageTrait) {
        expect(s.traits.some(t => t.name === s.lineageTrait)).withContext(s.name).toBeTrue();
      }
    }
  });

  it('has the right lineages on the four species that choose one', () => {
    const lineages = (name: string) => byName(name).lineages!.map(l => l.name);
    expect(lineages('Draenei')).toEqual(['Draenei', 'Krokul', 'Lightforged', 'Man\'ari']);
    expect(lineages('Elf')).toEqual(['Blood Elf', 'Night Elf', 'Nightborne', 'Void Elf', 'High Elf']);
    expect(lineages('Tauren')).toEqual(['Mulgore Tauren', 'Highmountain Tauren', 'Taunka']);
    expect(lineages('Troll')).toEqual(['Amani Troll', 'Darkspear Troll', 'Zandalari Troll']);
    expect(WOW_SPECIES.filter(s => s.lineages).length).toBe(4);
  });

  it('every spell lineage names its level 3 and level 5 spell in its description', () => {
    for (const s of WOW_SPECIES) {
      for (const l of s.lineages ?? []) {
        for (const spell of l.spells ?? []) {
          expect([3, 5]).withContext(`${s.name} / ${l.name}`).toContain(spell.level);
          expect(l.desc).withContext(`${s.name} / ${l.name}`).toContain(spell.name);
        }
      }
    }
  });

  it('the Taunka lineage carries the +1 Armor Class and Cold Resistance', () => {
    const taunka = byName('Tauren').lineages!.find(l => l.name === 'Taunka')!;
    expect(taunka.acBonus).toBe(1);
    expect(taunka.resistances).toEqual(['Cold']);
    expect(taunka.desc).toContain('+1 bonus to Armor Class');
  });

  it('only uses skill names the app knows', () => {
    for (const s of WOW_SPECIES) {
      const skillChoice = s.choices?.skill?.from;
      const skills = [
        ...(s.skills ?? []),
        ...(Array.isArray(skillChoice) ? skillChoice : []),
        ...(s.lineages ?? []).flatMap(l => l.skills ?? []),
      ];
      for (const skill of skills) expect(ALL_SKILLS).withContext(s.name).toContain(skill);
    }
  });

  it('records the choices each species asks for', () => {
    expect(byName('Elf').choices).toEqual({
      skill: { count: 1, from: ['Insight', 'Perception', 'Survival'] },
      ability: { use: 'spellcasting', from: ['INT', 'WIS', 'CHA'] },
    });
    expect(byName('Human').choices).toEqual({ skill: { count: 1, from: 'any' }, originFeat: true });
    expect(byName('Mechagnome').choices).toEqual({ tools: 2 });
    expect(byName('Tauren').choices?.ability).toEqual({ use: 'save DC', from: ['STR', 'CON', 'WIS'] });
    expect(byName('Dwarf').choices).toBeUndefined();
  });

  it('lets Forsaken and Human choose Small or Medium, and marks the Small species', () => {
    expect(WOW_SPECIES.filter(s => s.sizes.length === 2).map(s => s.name)).toEqual(['Forsaken', 'Human']);
    expect(WOW_SPECIES.filter(s => s.sizes.length === 1 && s.sizes[0] === 'Small').map(s => s.name))
      .toEqual(['Gnome', 'Mechagnome', 'Goblin', 'Vulpera']);
    expect(sizeLabel(byName('Human'))).toBe('Small or Medium');
    expect(sizeLabel(byName('Orc'))).toBe('Medium');
  });

  it('marks the three species that are not Humanoid', () => {
    expect(WOW_SPECIES.filter(s => s.creatureType !== 'Humanoid').map(s => `${s.name}: ${s.creatureType}`))
      .toEqual(['Dracthyr: Dragon', 'Forsaken: Undead', 'Mechagnome: Construct']);
  });
});

describe('buildSpeciesOptions', () => {
  it('lists the base-game names first, then the catalog species', () => {
    const options = buildSpeciesOptions(['Elf', 'Halfling']);
    expect(options.slice(0, 2)).toEqual([
      { key: 'Elf', name: 'Elf', source: 'Base Game' },
      { key: 'Halfling', name: 'Halfling', source: 'Base Game' },
    ]);
    expect(options.length).toBe(2 + WOW_SPECIES.length);
    expect(options[2].catalog).toBe(WOW_SPECIES[0]);
  });

  it('keeps every key unique even where a name exists in both sources', () => {
    const options = buildSpeciesOptions(['Dwarf', 'Elf', 'Gnome', 'Human', 'Orc']);
    expect(new Set(options.map(o => o.key)).size).toBe(options.length);
    const elves = options.filter(o => o.name === 'Elf');
    expect(elves.map(o => o.source)).toEqual(['Base Game', 'World of Warcraft']);
  });
});

describe('catalogSpeciesByKey', () => {
  it('finds a catalog species by its row key', () => {
    expect(catalogSpeciesByKey('Tauren (World of Warcraft)')?.name).toBe('Tauren');
  });

  it('returns undefined for a base-game name, an empty key or null', () => {
    expect(catalogSpeciesByKey('Elf')).toBeUndefined();
    expect(catalogSpeciesByKey('')).toBeUndefined();
    expect(catalogSpeciesByKey(null)).toBeUndefined();
  });
});

describe('toSpeciesDetail', () => {
  it('shapes a catalog species like the rules API detail', () => {
    const detail = toSpeciesDetail(catalogSpeciesByKey('Draenei (World of Warcraft)')!);
    expect(detail.index).toBe('draenei');
    expect(detail.name).toBe('Draenei');
    expect(detail.size).toBe('Medium');
    expect(detail.speed).toBe(30);
    expect(detail.traits.map(t => t.name)).toEqual(['Darkvision', 'Eredar Lineage', 'Heroic Presence']);
    expect(detail.subspecies.map(l => l.name)).toEqual(['Draenei', 'Krokul', 'Lightforged', 'Man\'ari']);
    expect(detail.subspecies[3].index).toBe('man-ari');
  });

  it('has no subspecies for a species without lineages', () => {
    expect(toSpeciesDetail(catalogSpeciesByKey('Orc (World of Warcraft)')!).subspecies).toEqual([]);
  });
});

describe('speciesTraitFeatures', () => {
  it('makes one Other Features card per trait, sourced to the tagged species', () => {
    const orc = catalogSpeciesByKey('Orc (World of Warcraft)')!;
    const cards = speciesTraitFeatures(orc);
    expect(cards.map(c => c.name)).toEqual(['Adrenaline Rush', 'Darkvision', 'Relentless Endurance']);
    expect(cards.every(c => c.category === 'other')).toBeTrue();
    expect(cards.every(c => c.source === 'Orc (World of Warcraft) · Species Trait')).toBeTrue();
    expect(speciesTraitSource(orc)).toBe('Orc (World of Warcraft) · Species Trait');
    expect(cards[1].desc).toBe('You have Darkvision with a range of 120 feet.');
  });

  it('spells out every lineage on the lineage trait card, and leaves the other cards alone', () => {
    const troll = catalogSpeciesByKey('Troll (World of Warcraft)')!;
    const cards = speciesTraitFeatures(troll);
    const lineage = cards.find(c => c.name === 'Troll Lineage')!;
    expect(lineage.desc).toContain('Amani Troll:');
    expect(lineage.desc).toContain('Darkspear Troll:');
    expect(lineage.desc).toContain('Zandalari Troll:');
    expect(cards.find(c => c.name === 'Troll Healing')!.desc).not.toContain('Amani');
  });
});
