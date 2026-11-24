import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import {
  DndResourcesService, SPELL_COUNTS, SPELLCASTING_CLASSES, FEAT_DESCRIPTIONS, ALL_LANGUAGE_NAMES, LANGUAGE_OPTIONS,
  ORIGIN_FEAT_OPTIONS, TOOL_NAMES, languageNames, originFeatsFor,
} from './dnd-resources.service';
import { DndBackground, DndSpell } from '../models/dnd-api.types';
import { onlyContentSources } from '../models/content-source';
import { startingSlots } from '../utils/spell-slots';
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
    it('returns the four source groups, Arcana Unleashed last', (done) => {
      service.getBackgroundGroups().subscribe(groups => {
        expect(groups.map(g => g.source))
          .toEqual(["Player's Handbook", 'Heroes of Faerun', 'Forge of the Artificer', 'Arcana Unleashed']);
        done();
      });
    });

    it('Arcana Unleashed group has its ten backgrounds, in book order', (done) => {
      service.getBackgroundGroups().subscribe(groups => {
        expect(groups.find(g => g.source === 'Arcana Unleashed')!.backgrounds).toEqual([
          'Agent of the Ninth Quill', 'Bejeweled Conclave Spy', 'Cosmic Dawn Experiment',
          'Covenant of the Grave Recruit', 'Crucible Storm Chaser', 'Familiar Trainer', 'Horizon Weaver Initiate',
          'Phantasmic Circus Trouper', 'Seer Apprentice', 'Ward of the Sheltering Hands',
        ]);
        done();
      });
    });

    it('lists every background once across the groups', (done) => {
      service.getBackgroundList().subscribe(names => {
        expect(new Set(names).size).toBe(names.length);
        expect(names.length).toBe(47);
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

  // ── Arcana Unleashed backgrounds ────────────────────────────────────────────

  describe('Arcana Unleashed backgrounds', () => {
    // background | ability scores | origin feat | skills | tool
    const ROWS = `
      Agent of the Ninth Quill | DEX,INT,CHA | Arcane Infiltrator | Arcana,Sleight of Hand | Thieves' Tools
      Bejeweled Conclave Spy | DEX,WIS,CHA | Arcane Eloquence | Deception,Perception | Disguise Kit
      Cosmic Dawn Experiment | STR,DEX,CON | Transmuted Anatomy | Athletics,Survival | Artisan's Tools (one kind)
      Covenant of the Grave Recruit | STR,INT,WIS | Arcane Undertaker | History,Medicine | Herbalism Kit
      Crucible Storm Chaser | STR,CON,INT | Arcane Overload | Athletics,Nature | Glassblower's Tools
      Familiar Trainer | CON,INT,WIS | Familiar Friend | Animal Handling,Arcana | Gaming Set (one kind)
      Horizon Weaver Initiate | DEX,CON,WIS | Portal Jumper | Acrobatics,Survival | Weaver's Tools
      Phantasmic Circus Trouper | DEX,CON,CHA | Arcane Artist | Deception,Performance | Disguise Kit
      Seer Apprentice | INT,WIS,CHA | Arcane Omens | History,Insight | Navigator's Tools
      Ward of the Sheltering Hands | CON,WIS,CHA | Arcane Safeguard | Insight,Medicine | Cook's Utensils
    `.trim().split('\n').map(row => row.split('|').map(cell => cell.trim()));

    it('each grants its abilities, origin feat, two skills and tool, tagged with the book', () => {
      expect(ROWS.length).toBe(10);
      for (const [name, abilities, feat, skills, tool] of ROWS) {
        let detail: DndBackground | undefined;
        service.getBackgroundDetail(name).subscribe(bg => detail = bg);
        expect(detail?.source).withContext(name).toBe('Arcana Unleashed');
        expect(detail?.index).withContext(name).toBe(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        expect(detail?.ability_scores.map(a => a.name)).withContext(name).toEqual(abilities.split(','));
        expect(detail?.feat?.name).withContext(name).toBe(feat);
        expect(detail?.proficiencies.map(p => p.name)).withContext(name).toEqual([...skills.split(','), tool]);
      }
    });

    it('each origin feat is described and on offer as an Origin feat', () => {
      for (const [name, , feat] of ROWS) {
        expect(service.getFeatDescription(feat)).withContext(name).not.toBe('');
        expect(ORIGIN_FEAT_OPTIONS.find(f => f.name === feat)?.source).withContext(feat).toBe('Arcana Unleashed');
      }
    });

    it('start with the default background gold, like every background outside the Player\'s Handbook', () => {
      for (const [name] of ROWS) expect(service.getBackgroundGold(name)).withContext(name).toBe(15);
      expect(service.getBackgroundGold('Harper')).toBe(15);
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

    it('describes a Boon of Magic School Mastery whichever school it is stored with', () => {
      const desc = service.getFeatDescription('Boon of Magic School Mastery');
      expect(desc).toContain('Signature Arcanum');
      expect(service.getFeatDescription('Boon of Magic School Mastery (Evocation)')).toBe(desc);
      expect(service.getFeatDescription('Boon of Magic School Mastery (Chronurgy)')).toBe('');
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
      const all = languageNames(onlyContentSources('Base Game', 'World of Warcraft'));
      expect(all).toContain('Eredun');
      expect(all).toContain('Elvish');
      const baseOnly = languageNames(onlyContentSources('Base Game'));
      expect(baseOnly).not.toContain('Eredun');
      expect(baseOnly).not.toContain('Nathrezim');
      expect(baseOnly).toContain('Elvish');
      expect(languageNames(onlyContentSources('World of Warcraft'))).toEqual(['Eredun', 'Nathrezim']);
      // The DM's grant list starts with the pickable languages, then adds the rest of the WoW module's.
      expect(ALL_LANGUAGE_NAMES.slice(0, all.length)).toEqual(all);
    });

    it('lets a DM grant any World of Warcraft language, each listed once', () => {
      for (const name of ['Darnassian', 'Thalassian', 'Orcish', 'Zandali', 'Titan', 'Shath\'Yar', 'Thieves\' Cant']) {
        expect(ALL_LANGUAGE_NAMES).withContext(name).toContain(name);
      }
      expect(new Set(ALL_LANGUAGE_NAMES).size).toBe(ALL_LANGUAGE_NAMES.length);
      // Shared names are not doubled: Draconic is both a PHB and a WoW language.
      expect(ALL_LANGUAGE_NAMES.filter(n => n === 'Draconic').length).toBe(1);
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

    it('lists every known feat, Boon of Magic School Mastery once per school', () => {
      const names = service.getFeatNames();
      // The one description stands for eight names: seven more than the table has entries.
      expect(names.length).toBe(Object.keys(FEAT_DESCRIPTIONS).length + 7);
      expect(names).not.toContain('Boon of Magic School Mastery');
      expect(names.filter(n => n.startsWith('Boon of Magic School Mastery (')).length).toBe(8);
      expect(names).toContain('Boon of Magic School Mastery (Transmutation)');
      for (const name of names) expect(service.getFeatDescription(name)).withContext(name).not.toBe('');
    });

    it('covers the Arcana Unleashed categories too', () => {
      const names = service.getFeatNames();
      expect(names).toContain('Familiar Friend');               // Origin
      expect(names).toContain('Evocation Adept');               // General
      expect(names).toContain('Arcane Warrior');                // Fighting Style
      expect(names).toContain('Boon of the Iron Mind');         // Epic Boon
    });
  });

  // ── Origin feats and tools a character picks for itself ─────────────────────

  describe('ORIGIN_FEAT_OPTIONS / originFeatsFor', () => {
    it('every Origin feat on offer has a description', () => {
      for (const feat of ORIGIN_FEAT_OPTIONS) {
        expect(service.getFeatDescription(feat.name)).withContext(feat.name).not.toBe('');
      }
    });

    it('lists each feat once', () => {
      const names = ORIGIN_FEAT_OPTIONS.map(f => f.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('offers a Human the twelve PHB feats, the three World of Warcraft Human feats, then the ten of Arcana Unleashed', () => {
      const names = originFeatsFor('Human').map(f => f.name);
      expect(names.length).toBe(25);
      expect(names).toContain('Alert');
      expect(names.slice(12, 15)).toEqual(['Arathi Heritage', 'Child of the Sea', 'Will to Survive']);
      expect(names.slice(15)).toEqual([
        'Arcane Artist', 'Arcane Eloquence', 'Arcane Infiltrator', 'Arcane Omens', 'Arcane Overload',
        'Arcane Safeguard', 'Arcane Undertaker', 'Familiar Friend', 'Portal Jumper', 'Transmuted Anatomy',
      ]);
    });

    it('keeps the Human-only feats from any other species', () => {
      const names = originFeatsFor('Orc').map(f => f.name);
      expect(names.length).toBe(22);
      expect(names).not.toContain('Arathi Heritage');
      expect(names).toContain('Familiar Friend');
    });

    it('marks only Skilled as repeatable', () => {
      expect(ORIGIN_FEAT_OPTIONS.filter(f => f.repeatable).map(f => f.name)).toEqual(['Skilled']);
    });
  });

  describe('TOOL_NAMES', () => {
    it('lists each tool once and includes the kinds a background grants by name', () => {
      expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length);
      expect(TOOL_NAMES).toContain("Thieves' Tools");
      expect(TOOL_NAMES).toContain("Calligrapher's Supplies");
      expect(TOOL_NAMES).toContain('Lute');
      expect(TOOL_NAMES).toContain('Dice');
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

    const mockArcana: DndSpell[] = [
      { name: 'Catnap', level: 3, school: 'enchantment', actionType: 'action', classes: ['bard', 'sorcerer', 'wizard'], source: 'Arcana Unleashed', concentration: false, ritual: false, range: '30 feet', components: ['s','m'], duration: '10 minutes', description: '', material: 'a pinch of sand' },
    ];

    /** Flushes the four spell files getSpells() fetches (SRD + 2024 PHB supplement + WoW + Arcana Unleashed). */
    function flushSpellFiles(supplement: DndSpell[] = mockSupplement, wow: DndSpell[] = mockWow,
                             arcana: DndSpell[] = mockArcana): void {
      httpMock.expectOne('/assets/data/spells/srd-5.2-spells.json').flush(mockSpells);
      httpMock.expectOne('/assets/data/spells/phb-2024-supplement.json').flush(supplement);
      httpMock.expectOne('/assets/data/spells/wow-spells.json').flush(wow);
      httpMock.expectOne('/assets/data/spells/arcana-unleashed-spells.json').flush(arcana);
    }

    it('returns only spells for the given class', (done) => {
      service.getSpellsForClass('wizard').subscribe(spells => {
        expect(spells.map(s => s.name)).toEqual(['Fireball', 'Witch Bolt', 'Catnap']);
        done();
      });

      flushSpellFiles();
    });

    it('merges the PHB supplement, World of Warcraft and Arcana Unleashed files after the SRD spells', (done) => {
      service.getSpells().subscribe(spells => {
        expect(spells.map(s => s.name))
          .toEqual(['Fireball', 'Healing Word', 'Eldritch Blast', 'Witch Bolt', 'Death Grip', 'Catnap']);
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
          .toEqual(['Base Game', 'Base Game', 'Base Game', 'Base Game', 'World of Warcraft', 'Arcana Unleashed']);
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

    it('Paladin and Ranger prepare 2 spells and learn no cantrips at level 1', () => {
      expect(SPELL_COUNTS['paladin']).toEqual({ cantrips: 0, spells: 2 });
      expect(SPELL_COUNTS['ranger']).toEqual({ cantrips: 0, spells: 2 });
    });

    it('has counts for every spellcasting class, and for no other', () => {
      expect(Object.keys(SPELL_COUNTS).sort()).toEqual([...SPELLCASTING_CLASSES].sort());
    });

    it('every class that picks spells also starts with level 1 slots, and no other class does', () => {
      const withSlots = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue',
        'sorcerer', 'warlock', 'wizard'].filter(cls => Object.keys(startingSlots(cls, 1)).length > 0);
      expect(withSlots).toEqual([...SPELLCASTING_CLASSES].sort());
      expect(startingSlots('paladin', 1)).toEqual({ 1: { max: 2, used: 0 } });
      expect(startingSlots('ranger', 1)).toEqual({ 1: { max: 2, used: 0 } });
    });
  });

  // ── SPELLCASTING_CLASSES constant ──────────────────────────────────────────

  describe('SPELLCASTING_CLASSES', () => {
    ['bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard'].forEach(cls => {
      it(`${cls} is a spellcasting class`, () => {
        expect(SPELLCASTING_CLASSES.has(cls)).toBeTrue();
      });
    });

    ['barbarian','fighter','monk','rogue'].forEach(cls => {
      it(`${cls} is not a spellcasting class`, () => {
        expect(SPELLCASTING_CLASSES.has(cls)).toBeFalse();
      });
    });
  });
});
