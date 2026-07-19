import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DndResourcesService, SPELL_COUNTS, SPELLCASTING_CLASSES, FEAT_DESCRIPTIONS } from './dnd-resources.service';
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

  describe('getFeatNames', () => {
    it('returns names sorted alphabetically', () => {
      const names = service.getFeatNames();
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('contains Alert', () => {
      expect(service.getFeatNames()).toContain('Alert');
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

    /** Flushes both spell files getSpells() fetches (SRD + 2024 PHB supplement). */
    function flushSpellFiles(supplement: DndSpell[] = mockSupplement): void {
      httpMock.expectOne('/assets/data/spells/srd-5.2-spells.json').flush(mockSpells);
      httpMock.expectOne('/assets/data/spells/phb-2024-supplement.json').flush(supplement);
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
          .toEqual(['Fireball', 'Healing Word', 'Eldritch Blast', 'Witch Bolt']);
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
