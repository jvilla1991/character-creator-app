import {
  ALLEGIANCES, WOW_ALLIANCE_LANGUAGES, WOW_HORDE_LANGUAGES, WOW_LANGUAGE_NAMES, WOW_RARE_LANGUAGES,
  allegianceBaseLanguage, allegianceLanguageHint, allegianceLanguageOptions, allegiancePickCount,
  suggestedAllegiance, wowStartingLanguages,
} from './wow-languages';
import { WOW_SPECIES } from './wow-species';

describe('World of Warcraft languages', () => {
  it('offers the three allegiances in order', () => {
    expect(ALLEGIANCES).toEqual(['Alliance', 'Horde', 'Unaffiliated']);
  });

  it('has nine Alliance, eleven Horde and fifteen rare languages, none repeated within a table', () => {
    expect(WOW_ALLIANCE_LANGUAGES.length).toBe(9);
    expect(WOW_HORDE_LANGUAGES.length).toBe(11);
    expect(WOW_RARE_LANGUAGES.length).toBe(15);
    for (const table of [WOW_ALLIANCE_LANGUAGES, WOW_HORDE_LANGUAGES, WOW_RARE_LANGUAGES]) {
      expect(new Set(table).size).toBe(table.length);
    }
  });

  it('keeps the faction tongues off their own tables, since they are given outright', () => {
    expect(WOW_ALLIANCE_LANGUAGES).not.toContain('Common');
    expect(WOW_HORDE_LANGUAGES).not.toContain('Orcish');
  });

  it('never offers a rare language on a faction table', () => {
    for (const rare of WOW_RARE_LANGUAGES) {
      expect(WOW_ALLIANCE_LANGUAGES).withContext(rare).not.toContain(rare);
      expect(WOW_HORDE_LANGUAGES).withContext(rare).not.toContain(rare);
    }
  });

  it('lists every language of the module once (33 in all)', () => {
    expect(WOW_LANGUAGE_NAMES.length).toBe(33);
    expect(new Set(WOW_LANGUAGE_NAMES).size).toBe(33);
    expect(WOW_LANGUAGE_NAMES.slice(0, 2)).toEqual(['Common', 'Orcish']);
  });

  it('gives the Alliance Common and the Horde Orcish; the unaffiliated get neither', () => {
    expect(allegianceBaseLanguage('Alliance')).toBe('Common');
    expect(allegianceBaseLanguage('Horde')).toBe('Orcish');
    expect(allegianceBaseLanguage('Unaffiliated')).toBe('');
    expect(allegianceBaseLanguage('')).toBe('');
  });

  it('lets the factions pick two and the unaffiliated three', () => {
    expect(allegiancePickCount('Alliance')).toBe(2);
    expect(allegiancePickCount('Horde')).toBe(2);
    expect(allegiancePickCount('Unaffiliated')).toBe(3);
    expect(allegiancePickCount('')).toBe(2);
  });

  it('offers each faction its own table, and the unaffiliated both tables plus Common and Orcish', () => {
    expect(allegianceLanguageOptions('Alliance')).toBe(WOW_ALLIANCE_LANGUAGES);
    expect(allegianceLanguageOptions('Horde')).toBe(WOW_HORDE_LANGUAGES);
    const open = allegianceLanguageOptions('Unaffiliated');
    expect(open.slice(0, 2)).toEqual(['Common', 'Orcish']);
    expect(open).toContain('Darnassian');
    expect(open).toContain('Zandali');
    expect(new Set(open).size).toBe(open.length);
    // 2 + 9 + 11, less the four languages both tables share.
    expect(open.length).toBe(18);
    expect(allegianceLanguageOptions('')).toEqual([]);
  });

  it('returns the same list each time, so a template binding stays stable', () => {
    expect(allegianceLanguageOptions('Unaffiliated')).toBe(allegianceLanguageOptions('Unaffiliated'));
    expect(allegianceLanguageOptions('')).toBe(allegianceLanguageOptions(''));
  });

  it('says in one line what each allegiance knows', () => {
    expect(allegianceLanguageHint('Alliance')).toContain('Common');
    expect(allegianceLanguageHint('Horde')).toContain('Orcish');
    expect(allegianceLanguageHint('Unaffiliated')).toContain('three languages');
    expect(allegianceLanguageHint('')).toContain('Choose an allegiance');
  });
});

describe('suggestedAllegiance', () => {
  it('puts the Alliance species with the Alliance', () => {
    for (const species of ['Dwarf', 'Gnome', 'Mechagnome', 'Human', 'Worgen']) {
      expect(suggestedAllegiance(species, '')).withContext(species).toBe('Alliance');
    }
  });

  it('puts the Horde species with the Horde', () => {
    for (const species of ['Forsaken', 'Orc', 'Vulpera']) {
      expect(suggestedAllegiance(species, '')).withContext(species).toBe('Horde');
    }
    expect(suggestedAllegiance('Tauren', 'Taunka')).toBe('Horde');
  });

  it('follows the lineage for elves, draenei and trolls', () => {
    expect(suggestedAllegiance('Elf', 'Night Elf')).toBe('Alliance');
    expect(suggestedAllegiance('Elf', 'Void Elf')).toBe('Alliance');
    expect(suggestedAllegiance('Elf', 'Blood Elf')).toBe('Horde');
    expect(suggestedAllegiance('Elf', 'Nightborne')).toBe('Horde');
    expect(suggestedAllegiance('Elf', 'High Elf')).toBe('');
    expect(suggestedAllegiance('Elf', '')).toBe('');
    expect(suggestedAllegiance('Draenei', 'Lightforged')).toBe('Alliance');
    expect(suggestedAllegiance('Draenei', 'Draenei')).toBe('Alliance');
    expect(suggestedAllegiance('Draenei', 'Krokul')).toBe('');
    expect(suggestedAllegiance('Draenei', 'Man\'ari')).toBe('');
    expect(suggestedAllegiance('Troll', 'Darkspear Troll')).toBe('Horde');
    expect(suggestedAllegiance('Troll', 'Zandalari Troll')).toBe('Horde');
    expect(suggestedAllegiance('Troll', 'Amani Troll')).toBe('');
  });

  it('leaves the open species to the player', () => {
    for (const species of ['Dracthyr', 'Earthen', 'Goblin', 'Haranir', 'Pandaren']) {
      expect(suggestedAllegiance(species, '')).withContext(species).toBe('');
    }
  });

  it('only ever names lineages that exist in the species catalog', () => {
    const lineages = new Set(WOW_SPECIES.flatMap(s => (s.lineages ?? []).map(l => l.name)));
    for (const name of ['Draenei', 'Lightforged', 'Night Elf', 'Void Elf', 'Blood Elf', 'Nightborne',
      'Darkspear Troll', 'Zandalari Troll']) {
      expect(lineages.has(name)).withContext(name).toBeTrue();
    }
  });
});

describe('wowStartingLanguages', () => {
  it('starts an Alliance character with Common and its two picks', () => {
    expect(wowStartingLanguages('Alliance', ['Darnassian', 'Dwarven', ''])).toEqual(['Common', 'Darnassian', 'Dwarven']);
  });

  it('starts a Horde character with Orcish and its two picks', () => {
    expect(wowStartingLanguages('Horde', ['Zandali', 'Goblin'])).toEqual(['Orcish', 'Zandali', 'Goblin']);
  });

  it('gives the unaffiliated exactly what they picked, up to three', () => {
    expect(wowStartingLanguages('Unaffiliated', ['Common', 'Zandali', 'Darnassian']))
      .toEqual(['Common', 'Zandali', 'Darnassian']);
    expect(wowStartingLanguages('Unaffiliated', ['', '', ''])).toEqual([]);
  });

  it('drops a pick that is off the table, a repeat, and a third pick a faction has no room for', () => {
    expect(wowStartingLanguages('Alliance', ['Zandali', 'Darnassian'])).toEqual(['Common', 'Darnassian']);
    expect(wowStartingLanguages('Alliance', ['Darnassian', 'Darnassian'])).toEqual(['Common', 'Darnassian']);
    expect(wowStartingLanguages('Alliance', ['Darnassian', 'Dwarven', 'Gnomish'])).toEqual(['Common', 'Darnassian', 'Dwarven']);
  });

  it('gives nothing until an allegiance is chosen', () => {
    expect(wowStartingLanguages('', ['Darnassian'])).toEqual([]);
  });
});
