import { ALL_SKILLS } from '../services/dnd-resources.service';
import {
  SpeciesSelections, buildSpeciesOptions, catalogSpeciesByKey, chosenLineage, emptySpeciesSelections,
  grantedSpeciesSkills, needsAbilityChoice, sizeLabel, speciesChoicesComplete, speciesLabel,
  speciesProficienciesComplete, speciesSkills, speciesTools, speciesTraitFeatures, speciesTraitSource,
  toSpeciesDetail,
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
      ability: { use: 'spellcasting', from: ['INT', 'WIS', 'CHA'], trait: 'Azeroth Elven Lineage' },
    });
    expect(byName('Human').choices).toEqual({ skill: { count: 1, from: 'any' }, originFeat: true });
    expect(byName('Mechagnome').choices).toEqual({ tools: 2 });
    expect(byName('Tauren').choices?.ability)
      .toEqual({ use: 'save DC', from: ['STR', 'CON', 'WIS'], trait: 'Tauren Lineage' });
    expect(byName('Dwarf').choices).toBeUndefined();
  });

  it('an ability choice always names one of the species\' own traits', () => {
    for (const s of WOW_SPECIES) {
      const trait = s.choices?.ability?.trait;
      if (trait) expect(s.traits.some(t => t.name === trait)).withContext(s.name).toBeTrue();
    }
  });

  it('only the Taunka lineage opts out of the ability choice', () => {
    const optOuts = WOW_SPECIES.flatMap(s => (s.lineages ?? []).filter(l => l.noAbilityChoice).map(l => l.name));
    expect(optOuts).toEqual(['Taunka']);
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

describe('species selections', () => {
  const species = (name: string) => catalogSpeciesByKey(`${name} (World of Warcraft)`)!;
  const pick = (name: string, patch: Partial<SpeciesSelections> = {}): SpeciesSelections =>
    ({ ...emptySpeciesSelections(species(name)), ...patch });

  it('starts empty, with the size filled in when there is only one', () => {
    expect(emptySpeciesSelections(species('Orc')))
      .toEqual({ lineage: '', size: 'Medium', ability: '', skills: [], tools: [], originFeat: '' });
    expect(emptySpeciesSelections(species('Goblin')).size).toBe('Small');
    expect(emptySpeciesSelections(species('Human')).size).toBe('');
    expect(emptySpeciesSelections(species('Mechagnome')).tools).toEqual(['', '']);
    expect(emptySpeciesSelections().size).toBe('');
  });

  it('a species with nothing to choose is complete at once', () => {
    for (const name of ['Dracthyr', 'Dwarf', 'Earthen', 'Goblin', 'Orc', 'Pandaren', 'Vulpera', 'Worgen', 'Mechagnome']) {
      expect(speciesChoicesComplete(species(name), pick(name))).withContext(name).toBeTrue();
    }
  });

  it('an Elf needs a lineage and a spellcasting ability', () => {
    expect(speciesChoicesComplete(species('Elf'), pick('Elf'))).toBeFalse();
    expect(speciesChoicesComplete(species('Elf'), pick('Elf', { lineage: 'Night Elf' }))).toBeFalse();
    expect(speciesChoicesComplete(species('Elf'), pick('Elf', { ability: 'WIS' }))).toBeFalse();
    expect(speciesChoicesComplete(species('Elf'), pick('Elf', { lineage: 'Night Elf', ability: 'WIS' }))).toBeTrue();
  });

  it('rejects a lineage or an ability the species does not offer', () => {
    expect(speciesChoicesComplete(species('Elf'), pick('Elf', { lineage: 'Taunka', ability: 'WIS' }))).toBeFalse();
    expect(speciesChoicesComplete(species('Elf'), pick('Elf', { lineage: 'Night Elf', ability: 'STR' }))).toBeFalse();
  });

  it('a Tauren needs a lineage and a save ability, except the Taunka, who has no saving throw', () => {
    const tauren = species('Tauren');
    expect(speciesChoicesComplete(tauren, pick('Tauren', { lineage: 'Mulgore Tauren' }))).toBeFalse();
    expect(speciesChoicesComplete(tauren, pick('Tauren', { lineage: 'Mulgore Tauren', ability: 'CON' }))).toBeTrue();
    expect(needsAbilityChoice(tauren, pick('Tauren', { lineage: 'Taunka' }))).toBeFalse();
    expect(speciesChoicesComplete(tauren, pick('Tauren', { lineage: 'Taunka' }))).toBeTrue();
  });

  it('a Troll needs only a lineage; a Gnome and a Haranir only an ability', () => {
    expect(speciesChoicesComplete(species('Troll'), pick('Troll'))).toBeFalse();
    expect(speciesChoicesComplete(species('Troll'), pick('Troll', { lineage: 'Amani Troll' }))).toBeTrue();
    expect(speciesChoicesComplete(species('Gnome'), pick('Gnome'))).toBeFalse();
    expect(speciesChoicesComplete(species('Gnome'), pick('Gnome', { ability: 'INT' }))).toBeTrue();
    expect(speciesChoicesComplete(species('Haranir'), pick('Haranir', { ability: 'CHA' }))).toBeTrue();
  });

  it('a Forsaken needs a size; a Human a size and an Origin feat', () => {
    expect(speciesChoicesComplete(species('Forsaken'), pick('Forsaken'))).toBeFalse();
    expect(speciesChoicesComplete(species('Forsaken'), pick('Forsaken', { size: 'Small' }))).toBeTrue();
    expect(speciesChoicesComplete(species('Human'), pick('Human', { size: 'Medium' }))).toBeFalse();
    expect(speciesChoicesComplete(species('Human'), pick('Human', { size: 'Medium', originFeat: 'Alert' }))).toBeTrue();
  });

  it('knows the skills a species and its lineage grant outright', () => {
    expect(grantedSpeciesSkills(species('Haranir'), pick('Haranir'))).toEqual(['Nature', 'Survival']);
    expect(grantedSpeciesSkills(species('Elf'), pick('Elf'))).toEqual([]);
    expect(grantedSpeciesSkills(species('Elf'), pick('Elf', { lineage: 'Night Elf' }))).toEqual(['Stealth']);
    expect(speciesSkills(species('Elf'), pick('Elf', { lineage: 'Night Elf', skills: ['Perception'] })))
      .toEqual(['Stealth', 'Perception']);
    expect(chosenLineage(species('Elf'), pick('Elf', { lineage: 'Nightborne' }))?.darkvision).toBe(120);
  });

  it('the proficiency picks are complete only when every skill and tool slot is filled, with no repeats', () => {
    const elf = species('Elf');
    expect(speciesProficienciesComplete(elf, pick('Elf'))).toBeFalse();
    expect(speciesProficienciesComplete(elf, pick('Elf', { skills: ['Insight'] }))).toBeTrue();
    const mecha = species('Mechagnome');
    expect(speciesProficienciesComplete(mecha, pick('Mechagnome'))).toBeFalse();
    expect(speciesProficienciesComplete(mecha, pick('Mechagnome', { tools: ['Lute', ''] }))).toBeFalse();
    expect(speciesProficienciesComplete(mecha, pick('Mechagnome', { tools: ['Lute', 'Lute'] }))).toBeFalse();
    expect(speciesProficienciesComplete(mecha, pick('Mechagnome', { tools: ['Lute', 'Dice'] }))).toBeTrue();
    expect(speciesTools(pick('Mechagnome', { tools: ['', 'Dice'] }))).toEqual(['Dice']);
    expect(speciesProficienciesComplete(species('Orc'), pick('Orc'))).toBeTrue();
  });
});

describe('speciesLabel', () => {
  it('shows the lineage alone when it already names the species', () => {
    expect(speciesLabel('Elf', 'Night Elf')).toBe('Night Elf');
    expect(speciesLabel('Troll', 'Amani Troll')).toBe('Amani Troll');
    expect(speciesLabel('Tauren', 'Mulgore Tauren')).toBe('Mulgore Tauren');
  });

  it('puts the lineage in brackets when it does not', () => {
    expect(speciesLabel('Tauren', 'Taunka')).toBe('Tauren (Taunka)');
    expect(speciesLabel('Elf', 'Nightborne')).toBe('Elf (Nightborne)');
    expect(speciesLabel('Draenei', 'Lightforged')).toBe('Draenei (Lightforged)');
  });

  it('shows the bare species when there is no lineage or it says nothing new', () => {
    expect(speciesLabel('Dwarf', null)).toBe('Dwarf');
    expect(speciesLabel('Dwarf', undefined)).toBe('Dwarf');
    expect(speciesLabel('Draenei', 'Draenei')).toBe('Draenei');
    expect(speciesLabel(undefined, null)).toBe('');
  });
});

describe('speciesTraitFeatures with choices made', () => {
  const species = (name: string) => catalogSpeciesByKey(`${name} (World of Warcraft)`)!;
  const pick = (name: string, patch: Partial<SpeciesSelections>): SpeciesSelections =>
    ({ ...emptySpeciesSelections(species(name)), ...patch });

  it('turns the lineage trait into the chosen lineage\'s own card', () => {
    const cards = speciesTraitFeatures(species('Tauren'), pick('Tauren', { lineage: 'Taunka' }));
    expect(cards.map(c => c.name)).toEqual(['Horns', 'Goring Rush', 'Hammering Horns', 'Tauren Lineage: Taunka']);
    const taunka = cards[3];
    expect(taunka.desc).toBe('You gain a +1 bonus to Armor Class and Resistance to Cold damage.');
    expect(taunka.desc).not.toContain('Mulgore');
    expect(taunka.category).toBe('other');
  });

  it('writes the save DC onto a Tauren lineage that has a saving throw', () => {
    const cards = speciesTraitFeatures(species('Tauren'), pick('Tauren', { lineage: 'Mulgore Tauren', ability: 'CON' }));
    const lineage = cards.find(c => c.name === 'Tauren Lineage: Mulgore Tauren')!;
    expect(lineage.desc).toContain('war stomp');
    expect(lineage.desc).toContain('Save DC: 8 + Proficiency Bonus + Constitution modifier.');
  });

  it('never writes an ability onto the Taunka card, even if one is left over', () => {
    const cards = speciesTraitFeatures(species('Tauren'), pick('Tauren', { lineage: 'Taunka', ability: 'STR' }));
    expect(cards[3].desc).not.toContain('Save DC');
  });

  it('adds the spell rule and the spellcasting ability to a spell lineage', () => {
    const cards = speciesTraitFeatures(species('Elf'), pick('Elf', { lineage: 'Void Elf', ability: 'INT' }));
    const lineage = cards.find(c => c.name === 'Azeroth Elven Lineage: Void Elf')!;
    expect(lineage.desc).toContain('Mind Sliver');
    expect(lineage.desc).toContain('Level 3: Entropic Embrace.');
    expect(lineage.desc).toContain('always prepared');
    expect(lineage.desc).toContain('Spellcasting ability: Intelligence.');
    expect(lineage.desc).not.toContain('Night Elf');
    // The rule appears once: the generic "you choose which" wording belongs to the unchosen card.
    expect(lineage.desc).not.toContain('you choose which');
  });

  it('writes the spellcasting ability onto the right trait for a species without lineages', () => {
    const gnome = speciesTraitFeatures(species('Gnome'), pick('Gnome', { ability: 'CHA' }));
    expect(gnome.find(c => c.name === 'Gnomish Lineage')!.desc).toMatch(/Spellcasting ability: Charisma\.$/);
    expect(gnome.find(c => c.name === 'Gnomish Cunning')!.desc).not.toContain('Spellcasting ability');
    const haranir = speciesTraitFeatures(species('Haranir'), pick('Haranir', { ability: 'WIS' }));
    expect(haranir.find(c => c.name === 'Haranir Magic')!.desc).toMatch(/Spellcasting ability: Wisdom\.$/);
  });

  it('a Troll lineage card carries no spell rule and no ability', () => {
    const cards = speciesTraitFeatures(species('Troll'), pick('Troll', { lineage: 'Zandalari Troll' }));
    const lineage = cards.find(c => c.name === 'Troll Lineage: Zandalari Troll')!;
    expect(lineage.desc).toBe('If you roll a 1 on the d20 for a D20 Test, you gain Heroic Inspiration at the end of the current turn.');
  });
});
