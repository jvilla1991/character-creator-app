import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DndResourcesService, SPELL_COUNTS, SPELLCASTING_CLASSES, FEAT_DESCRIPTIONS, ALL_LANGUAGE_NAMES, LANGUAGE_OPTIONS, languageNames } from './dnd-resources.service';
import { DndSpell } from '../models/dnd-api.types';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('DndResourcesService', () => {
  let service: DndResourcesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [DndResourcesService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(DndResourcesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── Background groups ───────────────────────────────────────────────────────

  describe('getBackgroundGroups', () => {
    it('returns exactly 3 source groups', (done) => {
      service.getBackgroundGroups().subscribe(groups => {
        expect(groups.length).toBe(3);
        done();
      });
    });

    it("Player's Handbook group has 16 backgrounds", (done) => {
      service.getBackgroundGroups().subscribe(groups => {
        const phb = groups.find(g => g.source === "Player's Handbook");
        expect(phb).toBeDefined();
        expect(phb!.backgrounds.length).toBe(16);
        done();
      });
    });

    it('all backgrounds in every group have non-empty names', (done) => {
      service.getBackgroundGroups().subscribe(groups => {
        groups.forEach(g => {
          g.backgrounds.forEach(name => expect(name.trim().length).toBeGreaterThan(0));
        });
        done();
      });
    });
  });

  // ── Background detail ───────────────────────────────────────────────────────

  describe('getBackgroundDetail', () => {
    it('returns full data for a known PHB background', (done) => {
      service.getBackgroundDetail('Criminal').subscribe(bg => {
        expect(bg.name).toBe('Criminal');
        expect(bg.feat?.name).toBe('Alert');
        expect(bg.proficiencies.length).toBeGreaterThan(0);
        expect(bg.ability_scores.length).toBeGreaterThan(0);
        done();
      });
    });

    it('returns a minimal shell for an unknown background', (done) => {
      service.getBackgroundDetail('Pirate').subscribe(bg => {
        expect(bg.name).toBe('Pirate');
        expect(bg.ability_scores).toEqual([]);
        done();
      });
    });

    it('Acolyte grants Magic Initiate (Cleric) feat', (done) => {
      service.getBackgroundDetail('Acolyte').subscribe(bg => {
        expect(bg.feat?.name).toBe('Magic Initiate (Cleric)');
        done();
      });
    });
  });

  // ── Origin feat descriptions ────────────────────────────────────────────────

  describe('getFeatDescription', () => {
    it('returns description for Alert', () => {
      expect(service.getFeatDescription('Alert')).toContain('Initiative');
    });

    it('returns description for Lucky', () => {
      expect(service.getFeatDescription('Lucky')).toContain('Luck');
    });

    it('returns empty string for unknown feat', () => {
      expect(service.getFeatDescription('Super Punch')).toBe('');
    });
  });

  // ── Origin feat names ───────────────────────────────────────────────────────

  describe('Blessed Warrior and Druidic Warrior fighting styles', () => {
    it('describes two Cleric cantrips cast with Charisma as Paladin spells', () => {
      const desc = service.getFeatDescription('Blessed Warrior');
      expect(desc).toContain('two Cleric cantrips');
      expect(desc).toContain('Paladin spells');
      expect(desc).toContain('Charisma');
    });

    it('describes two Druid cantrips cast with Wisdom as Ranger spells', () => {
      const desc = service.getFeatDescription('Druidic Warrior');
      expect(desc).toContain('two Druid cantrips');
      expect(desc).toContain('Ranger spells');
      expect(desc).toContain('Wisdom');
    });
  });

  describe('Void Warrior fighting style', () => {
    it('has a description mentioning Warlock cantrips and Wisdom', () => {
      const desc = service.getFeatDescription('Void Warrior');
      expect(desc).toContain('Warlock cantrips');
      expect(desc).toContain('Wisdom');
    });
  });

  describe('languages', () => {
    it('tags the World of Warcraft languages with their source and defaults the rest to Base Game', () => {
      expect(LANGUAGE_OPTIONS.filter(l => l.source === 'World of Warcraft').map(l => l.name))
        .toEqual(['Eredun', 'Nathrezim']);
      expect(LANGUAGE_OPTIONS.find(l => l.name === 'Elvish')?.source).toBeUndefined();
    });

    it('filters language names by content source', () => {
      const all = languageNames({ 'Base Game': true, 'World of Warcraft': true });
      expect(all).toContain('Eredun');
      expect(all).toContain('Elvish');
      const baseOnly = languageNames({ 'Base Game': true, 'World of Warcraft': false });
      expect(baseOnly).not.toContain('Eredun');
      expect(baseOnly).not.toContain('Nathrezim');
      expect(baseOnly).toContain('Elvish');
      expect(languageNames({ 'Base Game': false, 'World of Warcraft': true })).toEqual(['Eredun', 'Nathrezim']);
      expect(ALL_LANGUAGE_NAMES).toEqual(all);
    });
  });

  describe('getFeatNames', () => {
    it('returns names sorted alphabetically', () => {
      const names = service.getFeatNames();
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('contains Alert', () => {
      expect(service.getFeatNames()).toContain('Alert');
    });

    it('covers all four 2024 PHB feat categories', () => {
      const names = service.getFeatNames();
      expect(names).toContain('Alert');            // Origin
      expect(names).toContain('Weapon Master');    // General
      expect(names).toContain('Archery');          // Fighting Style
      expect(names).toContain('Boon of Fate');     // Epic Boon
    });

    it('length matches the number of known feats', () => {
      expect(service.getFeatNames().length).toBe(Object.keys(FEAT_DESCRIPTIONS).length);
    });
  });

  // ── Class skill choices ─────────────────────────────────────────────────────

  describe('getClassSkillChoices', () => {
    it('Rogue chooses 4 skills', () => {
      expect(service.getClassSkillChoices('Rogue').choose).toBe(4);
    });

    it('Ranger chooses 3 skills', () => {
      expect(service.getClassSkillChoices('Ranger').choose).toBe(3);
    });

    it('Fighter chooses 2 skills from 8 options', () => {
      const config = service.getClassSkillChoices('Fighter');
      expect(config.choose).toBe(2);
      expect(config.from.length).toBe(8);
    });

    it('is case-insensitive', () => {
      const lower = service.getClassSkillChoices('wizard');
      const title = service.getClassSkillChoices('Wizard');
      expect(lower.choose).toBe(title.choose);
    });

    it('returns safe default for unknown class', () => {
      const config = service.getClassSkillChoices('Commoner');
      expect(config.choose).toBe(2);
      expect(config.from).toEqual([]);
    });
  });

  // ── Background gold ─────────────────────────────────────────────────────────

  describe('getBackgroundGold', () => {
    it('Merchant and Noble give 25 gp', () => {
      expect(service.getBackgroundGold('Merchant')).toBe(25);
      expect(service.getBackgroundGold('Noble')).toBe(25);
    });

    it('Hermit gives 5 gp', () => {
      expect(service.getBackgroundGold('Hermit')).toBe(5);
    });

    it('defaults to 15 gp for unknown background', () => {
      expect(service.getBackgroundGold('Pirate')).toBe(15);
    });
  });

  // ── Level-1 subclasses ──────────────────────────────────────────────────────

  describe('getSubclassesForClass', () => {
    it('Sorcerer has 4 subclasses', () => {
      expect(service.getSubclassesForClass('Sorcerer').length).toBe(4);
    });

    it('Warlock has 4 subclasses', () => {
      expect(service.getSubclassesForClass('Warlock').length).toBe(4);
    });

    it('is case-insensitive', () => {
      expect(service.getSubclassesForClass('sorcerer').length).toBe(4);
    });

    it('Fighter returns empty array (no level-1 subclass)', () => {
      expect(service.getSubclassesForClass('Fighter')).toEqual([]);
    });

    it('each subclass has a name and desc', () => {
      service.getSubclassesForClass('Warlock').forEach(sub => {
        expect(sub.name.length).toBeGreaterThan(0);
        expect(sub.desc.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Species trait descriptions ──────────────────────────────────────────────

  describe('getTraitDescription', () => {
    it('returns description for Darkvision', () => {
      expect(service.getTraitDescription('Darkvision')).toContain('dim light');
    });

    it('returns description for Lucky (Halfling trait)', () => {
      expect(service.getTraitDescription('Lucky')).toContain('reroll');
    });

    it('returns empty string for unknown trait', () => {
      expect(service.getTraitDescription('Wing Attack')).toBe('');
    });
  });

  // ── Spell filtering ─────────────────────────────────────────────────────────

  describe('getSpellsForClass', () => {
    const mockSpells: DndSpell[] = [
      { name: 'Fireball',       level: 3, school: 'evocation', actionType: '1 action',       classes: ['wizard', 'sorcerer'], concentration: false, ritual: false, range: '150 ft', components: ['v','s','m'], duration: 'Instantaneous', description: '', material: '' },
      { name: 'Healing Word',   level: 1, school: 'evocation', actionType: '1 bonus action', classes: ['bard', 'cleric'],     concentration: false, ritual: false, range: '60 ft',  components: ['v'],         duration: 'Instantaneous', description: '', material: '' },
      { name: 'Eldritch Blast', level: 0, school: 'evocation', actionType: '1 action',       classes: ['warlock'],           concentration: false, ritual: false, range: '120 ft', components: ['v','s'],     duration: 'Instantaneous', description: '', material: '' },
    ];

    const mockSupplement: DndSpell[] = [
      { name: 'Witch Bolt', level: 1, school: 'evocation', actionType: 'action', classes: ['sorcerer', 'warlock', 'wizard'], concentration: true, ritual: false, range: '60 feet', components: ['v','s','m'], duration: 'up to 1 minute', description: '', material: 'a twig struck by lightning' },
    ];

    const mockWow: DndSpell[] = [
      { name: 'Death Grip', level: 1, school: 'necromancy', actionType: 'action', classes: [], subclasses: ['Oath of the Ebon Blade'], source: 'World of Warcraft', concentration: false, ritual: false, range: 'TBD', components: ['v','s'], duration: 'TBD', description: 'TBD' },
    ];

    /** Flushes the three spell files getSpells() fetches (SRD + 2024 PHB supplement + WoW). */
    function flushSpellFiles(supplement: DndSpell[] = mockSupplement, wow: DndSpell[] = mockWow): void {
      httpMock.expectOne('/assets/data/spells/srd-5.2-spells.json').flush(mockSpells);
      httpMock.expectOne('/assets/data/spells/phb-2024-supplement.json').flush(supplement);
      httpMock.expectOne('/assets/data/spells/wow-spells.json').flush(wow);
    }

    it('returns only spells for the given class', (done) => {
      service.getSpellsForClass('wizard').subscribe(spells => {
        expect(spells.length).toBe(2);
        expect(spells[0].name).toBe('Fireball');
        done();
      });

      flushSpellFiles();
    });

    it('merges the PHB supplement after the SRD spells', (done) => {
      service.getSpells().subscribe(spells => {
        expect(spells.map(s => s.name))
          .toEqual(['Fireball', 'Healing Word', 'Eldritch Blast', 'Witch Bolt', 'Death Grip']);
        done();
      });

      flushSpellFiles();
    });

    it('never offers World of Warcraft stubs to a class list (classes: [])', (done) => {
      service.getSpellsForClass('paladin').subscribe(spells => {
        expect(spells.map(s => s.name)).not.toContain('Death Grip');
        done();
      });

      flushSpellFiles();
    });

    it('reports a spell source, defaulting to Base Game', (done) => {
      service.getSpells().subscribe(spells => {
        expect(spells.map(s => service.spellSource(s)))
          .toEqual(['Base Game', 'Base Game', 'Base Game', 'Base Game', 'World of Warcraft']);
        done();
      });

      flushSpellFiles();
    });

    it('is case-insensitive on class name', (done) => {
      service.getSpellsForClass('WARLOCK').subscribe(spells => {
        expect(spells.length).toBe(1);
        expect(spells[0].name).toBe('Eldritch Blast');
        done();
      });

      flushSpellFiles([]);
    });

    it('adds a variant\'s extra spells by name (case-insensitive), in data order, without duplicates', (done) => {
      service.getSpellsForClass('cleric', ['fireball', 'Healing Word', 'No Such Spell']).subscribe(spells => {
        expect(spells.map(s => s.name)).toEqual(['Fireball', 'Healing Word']);
        done();
      });

      flushSpellFiles();
    });

    it('leaves the class list unchanged with no extras', (done) => {
      service.getSpellsForClass('cleric', []).subscribe(spells => {
        expect(spells.map(s => s.name)).toEqual(['Healing Word']);
        done();
      });

      flushSpellFiles();
    });

    it('returns empty array for non-spellcasting class', (done) => {
      service.getSpellsForClass('fighter').subscribe(spells => {
        expect(spells).toEqual([]);
        done();
      });

      flushSpellFiles();
    });
  });

  // ── SPELL_COUNTS constants ──────────────────────────────────────────────────

  describe('SPELL_COUNTS', () => {
    it('Wizard gets 3 cantrips and 6 spells at level 1', () => {
      expect(SPELL_COUNTS['wizard']).toEqual({ cantrips: 3, spells: 6 });
    });

    it('Warlock gets 2 cantrips and 2 spells at level 1', () => {
      expect(SPELL_COUNTS['warlock']).toEqual({ cantrips: 2, spells: 2 });
    });

    it('Sorcerer gets 4 cantrips at level 1', () => {
      expect(SPELL_COUNTS['sorcerer'].cantrips).toBe(4);
    });
  });

  // ── SPELLCASTING_CLASSES constant ──────────────────────────────────────────

  describe('SPELLCASTING_CLASSES', () => {
    ['bard','cleric','druid','sorcerer','warlock','wizard'].forEach(cls => {
      it(`${cls} is a spellcasting class`, () => {
        expect(SPELLCASTING_CLASSES.has(cls)).toBeTrue();
      });
    });

    ['barbarian','fighter','monk','paladin','ranger','rogue'].forEach(cls => {
      it(`${cls} is not a spellcasting class`, () => {
        expect(SPELLCASTING_CLASSES.has(cls)).toBeFalse();
      });
    });
  });
});
