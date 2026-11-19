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
    coins: { cp: 0, sp: 0, gp: 15 },
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

  // ── roster load failure is remembered, so "empty" and "failed" differ ─────

  describe('refreshPCs', () => {
    it('remembers a failed load and forgets it on the next success', () => {
      spyOn(console, 'error');
      expect(service.loadFailed()).toBeFalse();

      service.refreshPCs();
      httpMock.expectOne(service.pcUrl + 'all').flush('down', { status: 503, statusText: 'Unavailable' });
      expect(service.loadFailed()).toBeTrue();

      service.refreshPCs();
      httpMock.expectOne(service.pcUrl + 'all').flush([]);
      expect(service.loadFailed()).toBeFalse();
    });
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
      expect(body['coins']).toBe(JSON.stringify({ cp: 0, sp: 0, gp: 15 }));
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
        coins: '{"cp":0,"sp":0,"gp":15}',
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
    it('sends class resource uses as JSON, an empty object included, and null only when never loaded', () => {
      service.updatePC(makePC({ id: 42, classResources: { secondWind: 1 } })).subscribe();
      const spent = httpMock.expectOne(service.pcUrl + '42');
      expect(spent.request.body.classResources).toBe('{"secondWind":1}');
      spent.flush({});

      service.updatePC(makePC({ id: 42, classResources: {} })).subscribe();
      const regained = httpMock.expectOne(service.pcUrl + '42');
      expect(regained.request.body.classResources).toBe('{}'); // "everything back" must reach the server
      regained.flush({});

      service.updatePC(makePC({ id: 42 })).subscribe();
      const unknown = httpMock.expectOne(service.pcUrl + '42');
      expect(unknown.request.body.classResources).toBeNull(); // the server then keeps what it has
      unknown.flush({});
    });

    it('reads class resource uses back from the JSON column', () => {
      expect(service.deserialize({ id: 1, classResources: '{"rage":2}' }).classResources).toEqual({ rage: 2 });
      expect(service.deserialize({ id: 1 }).classResources).toEqual({});
    });

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

    it('sends the adjustment lines as a JSON string', () => {
      const pc = makePC({ id: 42, statAdjustments: { ac: [{ value: 1, label: 'Taunka' }] } });
      service.updatePC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42');
      expect((req.request.body as Record<string, unknown>)['statAdjustments'])
        .toBe('{"ac":[{"value":1,"label":"Taunka"}]}');
      req.flush(pc);
    });

    it('sends null adjustment lines when the character carries none, so the server keeps its own', () => {
      const pc = makePC({ id: 42 });
      service.updatePC(pc).subscribe();

      const req = httpMock.expectOne(service.pcUrl + '42');
      expect((req.request.body as Record<string, unknown>)['statAdjustments']).toBeNull();
      req.flush(pc);
    });
  });

  describe('setPetFamily', () => {
    it('PUTs the family to /{id}/pet and returns the saved character', (done) => {
      service.setPetFamily(42, 'Wolf').subscribe(saved => {
        expect(saved.petFamily).toBe('Wolf');
        done();
      });
      const req = httpMock.expectOne(service.pcUrl + '42/pet');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ family: 'Wolf' });
      req.flush({ ...makePC({ id: 42 }), petFamily: 'Wolf' });
    });

    it('sends an explicit null to clear the pet', (done) => {
      service.setPetFamily(42, null).subscribe(saved => {
        expect(saved.petFamily).toBeNull();
        done();
      });
      const req = httpMock.expectOne(service.pcUrl + '42/pet');
      expect(req.request.body).toEqual({ family: null });
      req.flush({ ...makePC({ id: 42 }), petFamily: null });
    });
  });

  // ── spell slots: spend by hand, restore ─────────────────────────────────────

  describe('spell slots', () => {
    const AFTER = { 1: { max: 4, used: 2 }, 3: { max: 2, used: 0 } };

    it('POSTs the spell level to /{id}/spell-slots/spend and returns the slots the server answers with', (done) => {
      service.spendSpellSlot(42, 1).subscribe(slots => {
        expect(slots).toEqual(AFTER);
        done();
      });
      const req = httpMock.expectOne(service.pcUrl + '42/spell-slots/spend');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ level: 1 });
      req.flush({ pcId: 42, spellSlots: { '1': { max: 4, used: 2 }, '3': { max: 2, used: 0 } } });
    });

    it('POSTs the spell level to /{id}/spell-slots/restore', (done) => {
      service.restoreSpellSlot(42, 3).subscribe(slots => {
        expect(slots).toEqual(AFTER);
        done();
      });
      const req = httpMock.expectOne(service.pcUrl + '42/spell-slots/restore');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ level: 3 });
      req.flush({ pcId: 42, spellSlots: AFTER });
    });

    it('POSTs all: true to restore every slot', (done) => {
      service.restoreAllSpellSlots(42).subscribe(slots => {
        expect(slots).toEqual({ 1: { max: 4, used: 0 } });
        done();
      });
      const req = httpMock.expectOne(service.pcUrl + '42/spell-slots/restore');
      expect(req.request.body).toEqual({ all: true });
      req.flush({ pcId: 42, spellSlots: { 1: { max: 4, used: 0 } } });
    });

    it('reads the slots with the parsing the rest of the character uses: a JSON string works too', (done) => {
      service.spendSpellSlot(42, 1).subscribe(slots => {
        expect(slots).toEqual(AFTER);
        done();
      });
      httpMock.expectOne(service.pcUrl + '42/spell-slots/spend')
        .flush({ pcId: 42, spellSlots: JSON.stringify(AFTER) });
    });

    it('puts the answered slots on the character in the roster and on screen', () => {
      const pc = makePC({ id: 42, spellSlots: { 1: { max: 4, used: 1 }, 3: { max: 2, used: 0 } } });
      service.setPCs([pc]);
      service.setActivePC(pc);
      let active: PC | null = null;
      service.activePC$.subscribe(v => (active = v));

      service.spendSpellSlot(42, 1).subscribe();
      httpMock.expectOne(service.pcUrl + '42/spell-slots/spend').flush({ pcId: 42, spellSlots: AFTER });

      expect(active!.spellSlots).toEqual(AFTER);
      expect(service.getPCById(42)!.spellSlots).toEqual(AFTER);
      expect(active!.name).toBe('Aelindra'); // only the slots change
    });

    it('reaches a character that is on screen but not in the roster: the member a DM has open', () => {
      service.setPCs([]);
      service.setActivePC(makePC({ id: 42, spellSlots: { 1: { max: 4, used: 3 } } }));
      let active: PC | null = null;
      service.activePC$.subscribe(v => (active = v));

      service.restoreAllSpellSlots(42, true).subscribe();
      httpMock.expectOne(service.pcUrl + '42/spell-slots/restore').flush({ pcId: 42, spellSlots: { 1: { max: 4, used: 0 } } });

      expect(active!.spellSlots).toEqual({ 1: { max: 4, used: 0 } });
    });

    it('leaves the character alone when the server refuses', () => {
      const pc = makePC({ id: 42, spellSlots: { 1: { max: 4, used: 4 } } });
      service.setPCs([pc]);
      service.setActivePC(pc);
      let active: PC | null = null;
      service.activePC$.subscribe(v => (active = v));
      let status = 0;

      service.spendSpellSlot(42, 1).subscribe({ error: err => (status = err.status) });
      httpMock.expectOne(service.pcUrl + '42/spell-slots/spend')
        .flush({ message: 'No level 1 slot available' }, { status: 409, statusText: 'Conflict' });

      expect(status).toBe(409);
      expect(active!.spellSlots).toEqual({ 1: { max: 4, used: 4 } });
    });

    it('re-reads the slots through the owner path, or the DM path for a member', () => {
      const pc = makePC({ id: 42, spellSlots: { 1: { max: 4, used: 0 } } });
      service.setPCs([pc]);
      service.setActivePC(pc);
      let active: PC | null = null;
      service.activePC$.subscribe(v => (active = v));

      service.refreshSpellSlots(42);
      httpMock.expectOne(service.pcUrl + 'find/42').flush({ ...makePC({ id: 42 }), name: 'Renamed', spellSlots: '{"1":{"max":4,"used":3}}' });
      expect(active!.spellSlots).toEqual({ 1: { max: 4, used: 3 } });
      expect(active!.name).toBe('Aelindra'); // only the slots are taken

      service.refreshSpellSlots(42, true);
      httpMock.expectOne(service.pcUrl + '42/as-dm').flush({}, { status: 403, statusText: 'Forbidden' });
      expect(active!.spellSlots).toEqual({ 1: { max: 4, used: 3 } }); // a failed re-read keeps what is there
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

  // ── WoW Hunter pet family ────────────────────────────────────────────────────

  describe('petFamily round-trip', () => {
    it('sends the pet family on update for a WoW hunter Beast Master', () => {
      service.updatePC(makePC({
        clazz: 'Ranger', subclass: 'Beast Master', specialization: 'Beast Mastery', petFamily: 'Mechanized Animal',
      })).subscribe();
      const req = httpMock.expectOne(service.pcUrl + '1');
      const body = req.request.body as Record<string, unknown>;
      expect(body['petFamily']).toBe('Mechanized Animal');
      expect(body['specialization']).toBe('Beast Mastery');
      req.flush(makePC());
    });

    it('sends an explicit null pet family for everyone else', () => {
      service.updatePC(makePC()).subscribe();
      const req = httpMock.expectOne(service.pcUrl + '1');
      expect((req.request.body as Record<string, unknown>)['petFamily']).toBeNull();
      req.flush(makePC());
    });

    it('reads petFamily from the server, defaulting a missing one to null', (done) => {
      const HttpParams = require('@angular/common/http').HttpParams;
      service.PCById(new HttpParams().set('id', '16')).subscribe((hunter: PC) => {
        expect(hunter.petFamily).toBe('Wolf');
        service.PCById(new HttpParams().set('id', '7')).subscribe((other: PC) => {
          expect(other.petFamily).toBeNull();
          done();
        });
        httpMock.expectOne(service.pcUrl + 'find/7').flush({ id: 7, name: 'Plain', clazz: 'Fighter', level: 1 });
      });
      httpMock.expectOne(service.pcUrl + 'find/16').flush({
        id: 16, name: 'Rhonna', clazz: 'Ranger', level: 6,
        subclass: 'Beast Master', specialization: 'Beast Mastery', petFamily: 'Wolf',
      });
    });
  });

  // ── Species origin (World of Warcraft species) ───────────────────────────────

  describe('species origin round-trip', () => {
    it('sends the species source, lineage and size on create', () => {
      service.addPC(makePC({
        race: 'Tauren', speciesSource: 'World of Warcraft', lineage: 'Taunka', size: 'Medium',
      })).subscribe();
      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;
      expect(body['species']).toBe('Tauren');
      expect(body['speciesSource']).toBe('World of Warcraft');
      expect(body['lineage']).toBe('Taunka');
      expect(body['size']).toBe('Medium');
      req.flush(makePC());
    });

    it('sends explicit nulls for a base-game species', () => {
      service.updatePC(makePC()).subscribe();
      const req = httpMock.expectOne(service.pcUrl + '1');
      const body = req.request.body as Record<string, unknown>;
      expect(body['speciesSource']).toBeNull();
      expect(body['lineage']).toBeNull();
      expect(body['size']).toBeNull();
      req.flush(makePC());
    });

    it('reads them back from the server, defaulting missing ones to null', (done) => {
      const HttpParams = require('@angular/common/http').HttpParams;
      service.PCById(new HttpParams().set('id', '21')).subscribe((elf: PC) => {
        expect(elf.race).toBe('Elf');
        expect(elf.speciesSource).toBe('World of Warcraft');
        expect(elf.lineage).toBe('Night Elf');
        expect(elf.size).toBe('Medium');
        service.PCById(new HttpParams().set('id', '7')).subscribe((other: PC) => {
          expect(other.speciesSource).toBeNull();
          expect(other.lineage).toBeNull();
          expect(other.size).toBeNull();
          done();
        });
        httpMock.expectOne(service.pcUrl + 'find/7').flush({ id: 7, name: 'Plain', clazz: 'Fighter', level: 1 });
      });
      httpMock.expectOne(service.pcUrl + 'find/21').flush({
        id: 21, name: 'Shandris', clazz: 'Ranger', level: 3,
        species: 'Elf', speciesSource: 'World of Warcraft', lineage: 'Night Elf', size: 'Medium',
      });
    });
  });

  // ── Hero-class specialization (Death Knight rune, Demon Hunter spec) ──────────

  describe('specialization round-trip', () => {
    it('sends subclass and specialization on create (never the legacy rune key)', () => {
      service.addPC(makePC({ clazz: 'Paladin', subclass: 'Oath of the Ebon Blade', specialization: 'Unholy' })).subscribe();
      const req = httpMock.expectOne(service.pcUrl + 'add');
      const body = req.request.body as Record<string, unknown>;
      expect(body['clazz']).toBe('Paladin');
      expect(body['subclass']).toBe('Oath of the Ebon Blade');
      expect(body['specialization']).toBe('Unholy');
      expect('rune' in body).toBeFalse();
      req.flush(makePC());
    });

    it('sends an explicit null specialization for everyone else', () => {
      service.updatePC(makePC()).subscribe();
      const req = httpMock.expectOne(service.pcUrl + '1');
      expect((req.request.body as Record<string, unknown>)['specialization']).toBeNull();
      req.flush(makePC());
    });

    it('reads the new specialization field, defaulting a missing one to null', (done) => {
      const HttpParams = require('@angular/common/http').HttpParams;
      service.PCById(new HttpParams().set('id', '8')).subscribe((dh: PC) => {
        expect(dh.specialization).toBe('Havoc');
        expect(dh.subclass).toBe('Demon Hunter');
        service.PCById(new HttpParams().set('id', '7')).subscribe((other: PC) => {
          expect(other.specialization).toBeNull();
          done();
        });
        httpMock.expectOne(service.pcUrl + 'find/7').flush({ id: 7, name: 'Plain', clazz: 'Fighter', level: 1 });
      });
      httpMock.expectOne(service.pcUrl + 'find/8').flush({
        id: 8, name: 'Shalassa', clazz: 'Ranger', level: 7,
        subclass: 'Demon Hunter', specialization: 'Havoc',
      });
    });

    it('reads a legacy rune payload as the specialization and drops the old key', (done) => {
      const HttpParams = require('@angular/common/http').HttpParams;
      service.PCById(new HttpParams().set('id', '6')).subscribe((dk: PC) => {
        expect(dk.specialization).toBe('Blood');
        expect('rune' in (dk as unknown as Record<string, unknown>)).toBeFalse();
        done();
      });
      httpMock.expectOne(service.pcUrl + 'find/6').flush({
        id: 6, name: 'Isolde', clazz: 'Paladin', level: 3,
        subclass: 'Oath of the Ebon Blade', rune: 'Blood',
      });
    });

    it('prefers specialization over a stale rune when both are present', (done) => {
      const HttpParams = require('@angular/common/http').HttpParams;
      service.PCById(new HttpParams().set('id', '6')).subscribe((dk: PC) => {
        expect(dk.specialization).toBe('Frost');
        done();
      });
      httpMock.expectOne(service.pcUrl + 'find/6').flush({
        id: 6, name: 'Isolde', clazz: 'Paladin', level: 3,
        subclass: 'Oath of the Ebon Blade', rune: 'Blood', specialization: 'Frost',
      });
    });

    it('forwards the fighting style and Void Warrior cantrips on level-up', () => {
      const cantrips = [
        { lvl: 0, name: 'Chill Touch', school: 'Necromancy', time: '1 action', prepared: true },
        { lvl: 0, name: 'Mind Sliver', school: 'Enchantment', time: '1 action', prepared: true },
      ];
      service.levelUp(8, { fightingStyle: 'Void Warrior', newSpells: cantrips }).subscribe();
      const req = httpMock.expectOne(`${service.pcUrl}8/level-up`);
      expect(req.request.body).toEqual({ fightingStyle: 'Void Warrior', newSpells: cantrips });
      req.flush({ id: 8, name: 'Shalassa', clazz: 'Ranger', level: 2 });
    });

    it('sends a changed specialization on level-up', () => {
      service.levelUp(6, { specialization: 'Frost' }).subscribe();
      const req = httpMock.expectOne(`${service.pcUrl}6/level-up`);
      expect(req.request.body).toEqual({ specialization: 'Frost' });
      req.flush({ id: 6, name: 'Isolde', clazz: 'Paladin', level: 4, specialization: 'Frost' });
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

    it('parses the adjustment lines, and reads a missing or malformed column as none', (done) => {
      const flat = {
        name: 'Test', clazz: 'Fighter', level: 1,
        saves: '[]', skills: '{}', spells: '[]', spellSlots: '{}', conditions: '[]', coins: '{}',
        weapons: '[]', gear: '[]', features: '[]', languages: '[]', toolProfs: '[]',
      };
      const results: PC[] = [];
      const params = (id: string) => new (require('@angular/common/http').HttpParams)().set('id', id);
      const collect = (result: PC) => {
        results.push(result);
        if (results.length < 3) return;
        expect(results[0].statAdjustments).toEqual({ ac: [{ value: 1, label: 'Taunka' }] });
        expect(results[1].statAdjustments).toBeNull();
        expect(results[2].statAdjustments).toBeNull();
        done();
      };

      service.PCById(params('11')).subscribe(collect);
      httpMock.expectOne(service.pcUrl + 'find/11')
        .flush({ ...flat, id: 11, statAdjustments: '{"ac":[{"value":1,"label":"Taunka"}]}' });
      service.PCById(params('12')).subscribe(collect);
      httpMock.expectOne(service.pcUrl + 'find/12').flush({ ...flat, id: 12, statAdjustments: null });
      service.PCById(params('13')).subscribe(collect);
      httpMock.expectOne(service.pcUrl + 'find/13').flush({ ...flat, id: 13, statAdjustments: 'not json' });
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

    it('records an ability score improvement as a "Level N Increase" line, like the server', (done) => {
      const before = service.getPCById(1)!;
      service.levelUp(1, { abilityIncreases: { CHA: 1, CON: 1 } }).subscribe(updated => {
        const label = `Level ${updated.level} Increase`;
        expect(updated.stats?.CHA).toBe((before.stats?.CHA ?? 10) + 1);
        expect(updated.statAdjustments?.CHA?.at(-1)).toEqual({ value: 1, label });
        expect(updated.statAdjustments?.CON?.at(-1)).toEqual({ value: 1, label });
        expect(updated.statAdjustments?.STR).toBeUndefined();
        done();
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

    it('previews half-caster slots and prepared spells for a demo Paladin and Ranger', (done) => {
      // Demo PC 6 is a level 5 Paladin (Death Knight); 16 is a level 6 Ranger (Hunter).
      service.levelUpPreview(6).subscribe(paladin => {
        expect(paladin.newLevel).toBe(6);
        expect(paladin.newSpellSlots).toEqual({ 1: 4, 2: 2 });
        expect([paladin.currentSpellsKnown, paladin.newSpellsKnown]).toEqual([6, 6]);
        expect(paladin.newCantripsKnown).toBe(0);
        service.levelUpPreview(16).subscribe(ranger => {
          expect(ranger.newLevel).toBe(7);
          expect(ranger.newSpellSlots).toEqual({ 1: 4, 2: 3 });
          expect([ranger.currentSpellsKnown, ranger.newSpellsKnown]).toEqual([6, 7]);
          done();
        });
      });
    });
  });
});

// The demo mirrors of the spend and restore endpoints behave like the server:
// same rules, same refusals, same log lines. Demo PC 17 is a level-5 wizard in
// no campaign (4/3/2, one 1st-level slot spent); demo PC 1 is a bard in a campaign.
describe('PCService spell slots (demo mode)', () => {
  let service: PCService;
  const WIZARD = 17;
  const CAMPAIGN_BARD = 1;

  beforeEach(() => {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    TestBed.configureTestingModule({
      imports: [],
      providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PCService);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify(); // demo mode never calls the server
    localStorage.removeItem(DEMO_MODE_KEY);
  });

  const slotsOf = (id: number) => service.getPCById(id)!.spellSlots!;

  it('starts from the seeded characters this spec relies on', () => {
    expect(service.getPCById(WIZARD)!.campaignId).toBeNull();
    expect(slotsOf(WIZARD)).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } });
    expect(service.getPCById(CAMPAIGN_BARD)!.campaignId).toBe('veiled');
    expect(slotsOf(CAMPAIGN_BARD)[1]).toEqual({ max: 4, used: 2 });
  });

  it('spends a slot, returns the new slots and puts them on the character', (done) => {
    service.setActivePC(service.getPCById(WIZARD)!);
    let active: PC | null = null;
    service.activePC$.subscribe(v => (active = v));

    service.spendSpellSlot(WIZARD, 2).subscribe(slots => {
      expect(slots[2]).toEqual({ max: 3, used: 1 });
      expect(slotsOf(WIZARD)[2]).toEqual({ max: 3, used: 1 });
      expect(active!.spellSlots![2]).toEqual({ max: 3, used: 1 });
      expect(slotsOf(WIZARD)[1]).toEqual({ max: 4, used: 1 }); // other levels untouched
      done();
    });
  });

  it('refuses a spend with no free slot as a 409, and changes nothing', (done) => {
    service.spendSpellSlot(WIZARD, 3).subscribe(() => {
      service.spendSpellSlot(WIZARD, 3).subscribe(() => {
        service.spendSpellSlot(WIZARD, 3).subscribe({
          next: () => fail('a third 3rd-level slot does not exist'),
          error: err => {
            expect(err.status).toBe(409);
            expect(err.error.message).toBe('No level 3 slot available');
            expect(slotsOf(WIZARD)[3]).toEqual({ max: 2, used: 2 });
            done();
          },
        });
      });
    });
  });

  it('refuses a level the character has no slots for (409) and a level that is not 1-9 (400)', (done) => {
    service.spendSpellSlot(WIZARD, 4).subscribe({
      error: err => {
        expect(err.status).toBe(409);
        service.spendSpellSlot(WIZARD, 0).subscribe({
          error: bad => {
            expect(bad.status).toBe(400);
            expect(bad.error.message).toBe('level must be a spell level from 1 to 9');
            done();
          },
        });
      },
    });
  });

  it('lets a player in a campaign spend, but not restore: that is the DM\'s call (403)', (done) => {
    service.spendSpellSlot(CAMPAIGN_BARD, 3).subscribe(() => {
      expect(slotsOf(CAMPAIGN_BARD)[3]).toEqual({ max: 3, used: 1 });
      service.restoreSpellSlot(CAMPAIGN_BARD, 3).subscribe({
        next: () => fail('a campaign player may not restore'),
        error: err => {
          expect(err.status).toBe(403);
          expect(err.error.message).toBe('In a campaign, spell slots come back with a rest or from your Dungeon Master');
          service.restoreAllSpellSlots(CAMPAIGN_BARD).subscribe({
            next: () => fail('nor restore all'),
            error: all => {
              expect(all.status).toBe(403);
              expect(slotsOf(CAMPAIGN_BARD)[3]).toEqual({ max: 3, used: 1 });
              done();
            },
          });
        },
      });
    });
  });

  it('lets the DM restore one slot of a campaign character, and refuses when none is spent (409)', (done) => {
    service.restoreSpellSlot(CAMPAIGN_BARD, 1, true).subscribe(slots => {
      expect(slots[1]).toEqual({ max: 4, used: 1 });
      service.restoreSpellSlot(CAMPAIGN_BARD, 3, true).subscribe({
        next: () => fail('nothing is spent at 3rd level'),
        error: err => {
          expect(err.status).toBe(409);
          expect(err.error.message).toBe('No spent level 3 slot to restore');
          done();
        },
      });
    });
  });

  it('lets the DM restore everything at once', (done) => {
    service.restoreAllSpellSlots(CAMPAIGN_BARD, true).subscribe(slots => {
      expect(Object.values(slots).every(slot => slot.used === 0)).toBeTrue();
      expect(Object.values(slotsOf(CAMPAIGN_BARD)).map(slot => slot.max)).toEqual([4, 3, 3, 1]);
      done();
    });
  });

  it('lets the owner of a character in no campaign restore their own', (done) => {
    service.restoreSpellSlot(WIZARD, 1).subscribe(slots => {
      expect(slots[1]).toEqual({ max: 4, used: 0 });
      // Fully rested now: restoring all is not an error and changes nothing.
      service.getLog(WIZARD).subscribe(before => {
        service.restoreAllSpellSlots(WIZARD).subscribe(again => {
          expect(again).toEqual(slots);
          service.getLog(WIZARD).subscribe(after => {
            expect(after.length).toBe(before.length); // no log line for a restore that restored nothing
            done();
          });
        });
      });
    });
  });

  it('writes the server\'s SPELL_SLOT log lines', (done) => {
    service.spendSpellSlot(WIZARD, 1).subscribe(() => {
      service.restoreSpellSlot(WIZARD, 1).subscribe(() => {
        service.spendSpellSlot(CAMPAIGN_BARD, 2, true).subscribe(() => {
          service.restoreAllSpellSlots(CAMPAIGN_BARD, true).subscribe(() => {
            service.getLog(WIZARD).subscribe(wizardLog => {
              expect(wizardLog.slice(0, 2).map(e => `${e.actionType}: ${e.description}`)).toEqual([
                'SPELL_SLOT: Restored a level 1 spell slot (3 of 4 left)',
                'SPELL_SLOT: Spent a level 1 spell slot (2 of 4 left)',
              ]);
              service.getLog(CAMPAIGN_BARD).subscribe(bardLog => {
                expect(bardLog.slice(0, 2).map(e => `${e.actionType}: ${e.description}`)).toEqual([
                  'SPELL_SLOT: DM restored all spell slots',
                  'SPELL_SLOT: DM spent a level 2 spell slot (1 of 3 left)',
                ]);
                done();
              });
            });
          });
        });
      });
    });
  });

  it('refuses an unknown character as a 404', (done) => {
    service.spendSpellSlot(99999, 1).subscribe({
      error: err => {
        expect(err.status).toBe(404);
        done();
      },
    });
  });

  it('a level-up keeps the DM\'s bonus slot lines on top of the new class table', (done) => {
    const wizard = service.getPCById(WIZARD)!;
    service.updatePC({
      ...wizard,
      statAdjustments: { slot3: [{ value: 1, label: 'Pearl of Power' }], slot5: [{ value: 1, label: 'Boon' }] },
      spellSlots: { ...wizard.spellSlots, 3: { max: 3, used: 3 }, 5: { max: 1, used: 0 } },
    }).subscribe(() => {
      service.levelUpPreview(WIZARD).subscribe(preview => {
        expect(preview.newSpellSlots).toEqual({ 1: 4, 2: 3, 3: 4, 5: 1 }); // wizard 6: 4/3/3, +1 at 3rd, +1 at 5th
        service.levelUp(WIZARD).subscribe(updated => {
          expect(updated.spellSlots).toEqual({
            1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 4, used: 3 }, 5: { max: 1, used: 0 },
          });
          done();
        });
      });
    });
  });
});
