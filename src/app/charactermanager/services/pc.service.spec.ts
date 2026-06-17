import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PCService } from './pc.service';
import { PC } from '../models/pc';

/** Minimal valid PC fixture for serialization tests. */
function makePC(overrides: Partial<PC> = {}): PC {
  return {
    id: 1,
    name: 'Aelindra',
    clazz: 'Wizard',
    level: 1,
    playerName: 'Alice',
    race: 'Elf',
    background: 'Sage',
    party: 'The Veiled Compass',
    hp: { cur: 7, max: 7, temp: 0 },
    ac: 11,
    init: 1,
    speed: 30,
    prof: 2,
    stats: { STR: 8, DEX: 12, CON: 13, INT: 16, WIS: 14, CHA: 10 },
    saves: ['INT', 'WIS'],
    skills: { Arcana: 'prof', History: 'prof' },
    conditions: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
    spells: [],
    spellSlots: { 1: { max: 2, used: 0 } },
    weapons: [],
    gear: [],
    features: [{ name: 'Magic Initiate (Wizard)', source: 'Sage · Origin Feat', desc: 'You learn cantrips.' }],
    languages: ['Common', 'Elvish'],
    toolProfs: [],
    feat: 'Magic Initiate (Wizard)',
    ...overrides,
  };
}

describe('PCService', () => {
  let service: PCService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PCService],
    });
    service = TestBed.inject(PCService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── should be created ───────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── addPC serialization ─────────────────────────────────────────────────────

  describe('addPC', () => {
    it('sends a POST to /add', () => {
      const pc = makePC();
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      expect(req.request.method).toBe('POST');
      req.flush(pc);
    });

    it('serializes nested stats to flat ability columns', () => {
      const pc = makePC();
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;
      expect(body['abilityStr']).toBe(8);
      expect(body['abilityDex']).toBe(12);
      expect(body['abilityCon']).toBe(13);
      expect(body['abilityInt']).toBe(16);
      expect(body['abilityWis']).toBe(14);
      expect(body['abilityCha']).toBe(10);
      req.flush(pc);
    });

    it('serializes nested hp to flat HP columns', () => {
      const pc = makePC();
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;
      expect(body['hpMax']).toBe(7);
      expect(body['hpCurrent']).toBe(7);
      expect(body['hpTemp']).toBe(0);
      req.flush(pc);
    });

    it('maps race → species in the payload', () => {
      const pc = makePC({ race: 'Elf' });
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      expect((req.request.body as Record<string, unknown>)['species']).toBe('Elf');
      req.flush(pc);
    });

    it('maps init → initiative and prof → profBonus', () => {
      const pc = makePC();
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;
      expect(body['initiative']).toBe(1);
      expect(body['profBonus']).toBe(2);
      req.flush(pc);
    });

    it('JSON-stringifies arrays and objects for TEXT columns', () => {
      const pc = makePC();
      service.addPC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;

      expect(body['saves']).toBe(JSON.stringify(['INT', 'WIS']));
      expect(body['skills']).toBe(JSON.stringify({ Arcana: 'prof', History: 'prof' }));
      expect(body['coins']).toBe(JSON.stringify({ cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 }));
      expect(body['languages']).toBe(JSON.stringify(['Common', 'Elvish']));
      req.flush(pc);
    });

    it('returns deserialized PC from the response', (done) => {
      const rawResponse = {
        id: 1,
        name: 'Aelindra',
        clazz: 'Wizard',
        level: 1,
        abilityStr: 8, abilityDex: 12, abilityCon: 13,
        abilityInt: 16, abilityWis: 14, abilityCha: 10,
        hpMax: 7, hpCurrent: 7, hpTemp: 0,
        species: 'Elf',
        saves: '["INT","WIS"]',
        skills: '{"Arcana":"prof"}',
        spells: '[]',
        spellSlots: '{}',
        conditions: '[]',
        coins: '{"cp":0,"sp":0,"ep":0,"gp":15,"pp":0}',
        weapons: '[]', gear: '[]', features: '[]',
        languages: '["Common","Elvish"]', toolProfs: '[]',
      };

      const pc = makePC();
      service.addPC(pc).subscribe(result => {
        expect(result.stats?.STR).toBe(8);
        expect(result.stats?.INT).toBe(16);
        expect(result.hp?.max).toBe(7);
        expect(result.race).toBe('Elf');
        expect(result.saves).toEqual(['INT', 'WIS']);
        expect(result.languages).toEqual(['Common', 'Elvish']);
        done();
      });

      httpMock.expectOne(service.pcUrl + 'add').flush(rawResponse);
    });
  });

  // ── updatePC serialization ──────────────────────────────────────────────────

  describe('updatePC', () => {
    it('sends a PUT to /{id}', () => {
      const pc = makePC({ id: 42 });
      service.updatePC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42');
      expect(req.request.method).toBe('PUT');
      req.flush(pc);
    });

    it('includes all serialized fields in PUT body', () => {
      const pc = makePC({ id: 42 });
      service.updatePC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42');
      const body = req.request.body as Record<string, unknown>;
      expect(body['abilityStr']).toBe(8);
      expect(body['hpMax']).toBe(7);
      expect(body['species']).toBe('Elf');
      req.flush(pc);
    });
  });

  // ── level-up (server-authoritative) ─────────────────────────────────────────

  describe('levelUpPreview', () => {
    it('GETs the preview endpoint and returns the server deltas', (done) => {
      service.levelUpPreview(42).subscribe(preview => {
        expect(preview.newLevel).toBe(5);
        expect(preview.hpGained).toBe(7);
        expect(preview.newProfBonus).toBe(3);
        expect(preview.newSpellSlots[3]).toBe(2);
        done();
      });

      const req = httpMock.expectOne(service.pcUrl + '42/level-up/preview');
      expect(req.request.method).toBe('GET');
      req.flush({
        currentLevel: 4, newLevel: 5, hitDie: 8, conModifier: 2,
        hpGained: 7, newHpMax: 39, currentProfBonus: 2, newProfBonus: 3,
        currentSpellSlots: { 1: 4, 2: 3 }, newSpellSlots: { 1: 4, 2: 3, 3: 2 },
        subclassDue: false, subclassOptions: [],
      });
    });
  });

  describe('levelUp', () => {
    it('sends the chosen subclass in the POST body when provided', () => {
      service.levelUp(42, 'Life Domain').subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ subclass: 'Life Domain' });
      req.flush({ id: 42, name: 'Aelindra', clazz: 'Cleric', level: 3, subclass: 'Life Domain' });
    });

    it('POSTs to the level-up endpoint and deserializes the updated PC', (done) => {
      service.levelUp(42).subscribe(updated => {
        expect(updated.level).toBe(5);
        expect(updated.hp?.max).toBe(39);
        expect(updated.prof).toBe(3);
        done();
      });

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.method).toBe('POST');
      req.flush({
        id: 42, name: 'Aelindra', clazz: 'Wizard', level: 5,
        hpMax: 39, hpCurrent: 39, hpTemp: 0, profBonus: 3,
        abilityStr: 8, abilityDex: 12, abilityCon: 14,
        abilityInt: 16, abilityWis: 14, abilityCha: 10,
        spells: '[]', spellSlots: '{}', saves: '[]', skills: '{}',
        conditions: '[]', coins: '{}', weapons: '[]', gear: '[]',
        features: '[]', languages: '[]', toolProfs: '[]',
      });
    });

    it('pushes the updated PC into the active stream when it is the active PC', (done) => {
      service.setActivePC(makePC({ id: 42, level: 4 }));

      service.levelUp(42).subscribe(() => {
        service.activePC$.subscribe(active => {
          expect(active?.level).toBe(5);
          done();
        });
      });

      httpMock.expectOne(service.pcUrl + '42/level-up').flush({
        id: 42, name: 'Aelindra', clazz: 'Wizard', level: 5,
        hpMax: 39, hpCurrent: 39, hpTemp: 0, profBonus: 3,
        spells: '[]', spellSlots: '{}', saves: '[]', skills: '{}',
        conditions: '[]', coins: '{}', weapons: '[]', gear: '[]',
        features: '[]', languages: '[]', toolProfs: '[]',
      });
    });
  });

  // ── deletePC ────────────────────────────────────────────────────────────────

  describe('deletePC', () => {
    it('sends a DELETE to /delete/{id}', () => {
      service.deletePC(7).subscribe();

      const req = httpMock.expectOne(service.pcUrl + 'delete/7');
      expect(req.request.method).toBe('DELETE');
      req.flush([]);
    });
  });

  // ── deserializePC — JSON field parsing ─────────────────────────────────────

  describe('deserializePC (via PCById)', () => {
    it('parses JSON string fields into their correct types', (done) => {
      service.PCById(new (require('@angular/common/http').HttpParams)().set('id', '1')).subscribe((result: PC) => {
        expect(Array.isArray(result.saves)).toBeTrue();
        expect(typeof result.skills).toBe('object');
        expect(Array.isArray(result.spells)).toBeTrue();
        done();
      });

      httpMock.expectOne(service.pcUrl + 'find/1').flush({
        id: 1, name: 'Test', clazz: 'Fighter', level: 1,
        saves: '["STR","CON"]',
        skills: '{"Athletics":"prof"}',
        spells: '[]', spellSlots: '{}',
        conditions: '[]', coins: '{}',
        weapons: '[]', gear: '[]', features: '[]',
        languages: '[]', toolProfs: '[]',
        abilityStr: 16, abilityDex: 10, abilityCon: 14,
        abilityInt: 8, abilityWis: 12, abilityCha: 9,
        hpMax: 11, hpCurrent: 11, hpTemp: 0,
      });
    });

    it('survives malformed JSON in TEXT fields by using default values', (done) => {
      service.PCById(new (require('@angular/common/http').HttpParams)().set('id', '2')).subscribe((result: PC) => {
        expect(Array.isArray(result.saves)).toBeTrue();
        expect(result.saves).toEqual([]);
        done();
      });

      httpMock.expectOne(service.pcUrl + 'find/2').flush({
        id: 2, name: 'Broken', clazz: 'Rogue', level: 1,
        saves: 'not-valid-json',
        skills: '{}', spells: '[]', spellSlots: '{}',
        conditions: '[]', coins: '{}',
        weapons: '[]', gear: '[]', features: '[]',
        languages: '[]', toolProfs: '[]',
      });
    });
  });

  // ── pcsByParty$ grouping ────────────────────────────────────────────────────

  describe('pcsByParty$', () => {
    it('groups PCs by party name', (done) => {
      const pcs: PC[] = [
        makePC({ id: 1, party: 'Alpha' }),
        makePC({ id: 2, party: 'Alpha' }),
        makePC({ id: 3, party: 'Beta'  }),
      ];
      service.setPCs(pcs);

      service.pcsByParty$.subscribe(groups => {
        expect(groups.get('Alpha')?.length).toBe(2);
        expect(groups.get('Beta')?.length).toBe(1);
        done();
      });
    });

    it('assigns PCs without a party to Unassigned', (done) => {
      const pcs: PC[] = [makePC({ id: 1, party: undefined })];
      service.setPCs(pcs);

      service.pcsByParty$.subscribe(groups => {
        expect(groups.get('Unassigned')?.length).toBe(1);
        done();
      });
    });
  });
});
