import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PCService } from './pc.service';
import { PC } from '../models/pc';
import { DEMO_MODE_KEY } from 'src/environments/environment';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

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
    imports: [],
    providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
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

  describe('levelUpPreviewAsDm', () => {
    it('GETs the DM-authorized preview endpoint', (done) => {
      service.levelUpPreviewAsDm(42).subscribe(preview => {
        expect(preview.newLevel).toBe(5);
        done();
      });

      const req = httpMock.expectOne(service.pcUrl + '42/level-up/preview/as-dm');
      expect(req.request.method).toBe('GET');
      req.flush({
        currentLevel: 4, newLevel: 5, hitDie: 8, conModifier: 2,
        hpGained: 7, newHpMax: 39, currentProfBonus: 2, newProfBonus: 3,
        currentSpellSlots: {}, newSpellSlots: {},
        subclassDue: false, subclassOptions: [],
      });
    });
  });

  describe('levelUpAsDm', () => {
    it('POSTs the choices to the DM-authorized level-up endpoint and mirrors the PC', (done) => {
      service.levelUpAsDm(42, { subclass: 'Life Domain' }).subscribe(updated => {
        expect(updated.level).toBe(5);
        done();
      });

      const req = httpMock.expectOne(service.pcUrl + '42/level-up/as-dm');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ subclass: 'Life Domain' });
      req.flush({
        id: 42, name: 'Aelindra', clazz: 'Cleric', level: 5,
        hpMax: 39, hpCurrent: 39, hpTemp: 0, profBonus: 3,
        spells: '[]', spellSlots: '{}', saves: '[]', skills: '{}',
        conditions: '[]', coins: '{}', weapons: '[]', gear: '[]',
        features: '[]', languages: '[]', toolProfs: '[]',
      });
    });

    it('pushes the updated PC into the active stream when it is the active PC', (done) => {
      service.setActivePC(makePC({ id: 42, level: 4 }));

      service.levelUpAsDm(42).subscribe(() => {
        service.activePC$.subscribe(active => {
          expect(active?.level).toBe(5);
          done();
        });
      });

      httpMock.expectOne(service.pcUrl + '42/level-up/as-dm').flush({
        id: 42, name: 'Aelindra', clazz: 'Wizard', level: 5,
        hpMax: 39, hpCurrent: 39, hpTemp: 0, profBonus: 3,
        spells: '[]', spellSlots: '{}', saves: '[]', skills: '{}',
        conditions: '[]', coins: '{}', weapons: '[]', gear: '[]',
        features: '[]', languages: '[]', toolProfs: '[]',
      });
    });
  });

  describe('levelUp', () => {
    it('sends the chosen subclass in the POST body when provided', () => {
      service.levelUp(42, { subclass: 'Life Domain' }).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ subclass: 'Life Domain' });
      req.flush({ id: 42, name: 'Aelindra', clazz: 'Cleric', level: 3, subclass: 'Life Domain' });
    });

    it('sends the ASI allocation in the POST body when provided', () => {
      service.levelUp(42, { abilityIncreases: { STR: 1, DEX: 1 } }).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.body).toEqual({ abilityIncreases: { STR: 1, DEX: 1 } });
      req.flush({ id: 42, name: 'Throk', clazz: 'Fighter', level: 4 });
    });

    it('sends the chosen feat in the POST body when provided', () => {
      service.levelUp(42, { feat: 'Sentinel' }).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.body).toEqual({ feat: 'Sentinel' });
      req.flush({ id: 42, name: 'Throk', clazz: 'Fighter', level: 4 });
    });

    it('sends newly-learned spells in the POST body when provided', () => {
      const newSpells = [{ lvl: 1, name: 'Hold Person', school: 'Ench', time: '1 action', prepared: true }];
      service.levelUp(42, { newSpells }).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42/level-up');
      expect(req.request.body).toEqual({ newSpells });
      req.flush({ id: 42, name: 'Aelindra', clazz: 'Bard', level: 5 });
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

  // ── refreshPC (cross-client freshness) ─────────────────────────────────────

  describe('refreshPC', () => {
    it('GETs the PC and pushes the fresh copy into the active stream', (done) => {
      service.setActivePC(makePC({ id: 42 }));
      service.refreshPC(42);

      const req = httpMock.expectOne(service.pcUrl + 'find/42');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 42, name: 'Aelindra', clazz: 'Wizard', level: 4,
        pendingLevelGrant: true,
        spells: '[]', spellSlots: '{}', saves: '[]', skills: '{}',
        conditions: '[]', coins: '{}', weapons: '[]', gear: '[]',
        features: '[]', languages: '[]', toolProfs: '[]',
      });

      service.activePC$.subscribe(active => {
        expect(active?.pendingLevelGrant).toBeTrue();
        done();
      });
    });

    it('keeps the local copy when the fetch fails (e.g. DM cross-link)', (done) => {
      service.setActivePC(makePC({ id: 42, pendingLevelGrant: false }));
      service.refreshPC(42);

      httpMock.expectOne(service.pcUrl + 'find/42')
        .flush('nope', { status: 403, statusText: 'Forbidden' });

      service.activePC$.subscribe(active => {
        expect(active?.id).toBe(42);
        expect(active?.pendingLevelGrant).toBeFalse();
        done();
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

});

// ── Demo mode: activity log ────────────────────────────────────────────────
// demoMode reads localStorage live (see environment.ts), so these run in a
// separate TestBed with the flag set before the service is constructed —
// PCService seeds `this.pcs` from DEMO_PCS only when demoMode is already true.

describe('PCService (demo mode)', () => {
  let service: PCService;

  beforeEach(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    TestBed.configureTestingModule({
    imports: [],
    providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(PCService);
  });

  afterEach(() => localStorage.removeItem(DEMO_MODE_KEY));

  describe('getLog', () => {
    it('returns the seeded demo log for a known PC', (done) => {
      service.getLog(1).subscribe(entries => {
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0].pcId).toBe(1);
        done();
      });
    });

    it('returns an empty list for a PC with no seeded log', (done) => {
      service.getLog(999).subscribe(entries => {
        expect(entries).toEqual([]);
        done();
      });
    });
  });

  describe('demo level-up', () => {
    it('prepends a LEVEL_UP entry to the log', (done) => {
      service.getLog(1).subscribe(before => {
        const beforeCount = before.length;
        service.levelUp(1).subscribe(updated => {
          service.getLog(1).subscribe(after => {
            expect(after.length).toBe(Math.min(beforeCount + 1, 10));
            expect(after[0].actionType).toBe('LEVEL_UP');
            expect(after[0].description).toBe('Leveled up to ' + updated.level);
            done();
          });
        });
      });
    });

    it('caps the demo log at 10 entries', (done) => {
      // Level up repeatedly past the cap and confirm the log never exceeds 10.
      const levelUpsNeeded = 12;
      let completed = 0;
      const doNext = () => {
        if (completed === levelUpsNeeded) {
          service.getLog(1).subscribe(entries => {
            expect(entries.length).toBeLessThanOrEqual(10);
            done();
          });
          return;
        }
        service.levelUp(1).subscribe(() => {
          completed++;
          doNext();
        });
      };
      doNext();
    });
  });
});
