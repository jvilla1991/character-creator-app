import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { PCService } from './pc.service';
import { PC } from '../models/pc';
import { DEMO_MODE_KEY } from 'src/environments/environment';

const MYSTIC_ARTS = 'Warrior of the Mystic Arts';

function makeMonk(overrides: Partial<PC> = {}): PC {
  return {
    id: 42, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8, playerName: 'Sam', race: 'Human',
    hp: { cur: 50, max: 50, temp: 0 }, prof: 3,
    stats: { STR: 10, DEX: 16, CON: 14, INT: 8, WIS: 16, CHA: 10 },
    spells: [], features: [], skills: {},
    spellSlots: { 1: { max: 4, used: 1 }, 2: { max: 2, used: 1 } },
    classResources: { focusPoints: 5 },
    ...overrides,
  };
}

describe('PCService Mystic Focus', () => {
  let service: PCService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [PCService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
    });
    service = TestBed.inject(PCService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** The saved character as the server sends it: flat columns, JSON text for the slots. */
  const SAVED = {
    id: 42, name: 'Shen', clazz: 'Monk', subclass: MYSTIC_ARTS, level: 8,
    spellSlots: '{"1":{"max":4,"used":1},"2":{"max":2,"used":2}}',
    classResources: { focusPoints: 3 },
  };

  it('POSTs the action and the slot level to /{id}/mystic-focus and returns the saved character', (done) => {
    service.mysticFocus(42, 'SLOT_TO_FOCUS', 2).subscribe(saved => {
      expect(saved.spellSlots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 2, used: 2 } });
      expect(saved.classResources).toEqual({ focusPoints: 3 });
      done();
    });

    const req = httpMock.expectOne(service.pcUrl + '42/mystic-focus');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'SLOT_TO_FOCUS', slotLevel: 2 });
    req.flush(SAVED);
  });

  it('sends the other way the same, and the same body for the DM (the server tells who is asking)', () => {
    service.mysticFocus(42, 'FOCUS_TO_SLOT', 1, true).subscribe();

    const req = httpMock.expectOne(service.pcUrl + '42/mystic-focus');
    expect(req.request.body).toEqual({ action: 'FOCUS_TO_SLOT', slotLevel: 1 });
    req.flush(SAVED);
  });

  it('puts the saved character on the roster and on the open sheet', (done) => {
    const monk = makeMonk();
    service.setPCs([monk]);
    service.setActivePC(monk);
    let active: PC | null = null;
    service.activePC$.subscribe(v => (active = v));

    service.mysticFocus(42, 'SLOT_TO_FOCUS', 2).subscribe(() => {
      expect(service.getPCById(42)!.spellSlots![2]).toEqual({ max: 2, used: 2 });
      expect(service.getPCById(42)!.classResources).toEqual({ focusPoints: 3 });
      expect(active!.spellSlots![2]).toEqual({ max: 2, used: 2 });
      expect(active!.classResources).toEqual({ focusPoints: 3 });
      done();
    });
    httpMock.expectOne(service.pcUrl + '42/mystic-focus').flush(SAVED);
  });

  it('reaches a member the DM has open, who is not in the DM\'s own roster', (done) => {
    service.setActivePC(makeMonk());
    let active: PC | null = null;
    service.activePC$.subscribe(v => (active = v));

    service.mysticFocus(42, 'SLOT_TO_FOCUS', 2, true).subscribe(() => {
      expect(active!.classResources).toEqual({ focusPoints: 3 });
      done();
    });
    httpMock.expectOne(service.pcUrl + '42/mystic-focus').flush(SAVED);
  });

  it('hands a refusal to the caller and changes nothing', (done) => {
    const monk = makeMonk();
    service.setPCs([monk]);

    service.mysticFocus(42, 'FOCUS_TO_SLOT', 3).subscribe({
      next: () => fail('expected a refusal'),
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(400);
        expect(err.error.message).toBe('Recovering a level 3 spell slot needs Monk level 13');
        expect(service.getPCById(42)).toEqual(monk);
        done();
      },
    });
    httpMock.expectOne(service.pcUrl + '42/mystic-focus').flush(
      { message: 'Recovering a level 3 spell slot needs Monk level 13' }, { status: 400, statusText: 'Bad Request' });
  });
});

// demoMode reads localStorage live, so the flag is set before the service is constructed.
describe('PCService Mystic Focus (demo mode)', () => {
  let service: PCService;
  const ID = 902;

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

  /** Put a character in the demo store and return it. */
  function seed(over: Partial<PC> = {}): PC {
    const pc = makeMonk({ id: ID, campaignId: null, ...over });
    const store = service as unknown as { pcs: PC[] };
    store.pcs = [...store.pcs.filter(p => p.id !== ID), pc];
    return pc;
  }
  const stored = () => service.getPCById(ID)!;
  const refusal = (call: Promise<unknown>): Promise<HttpErrorResponse> =>
    call.then(() => { throw new Error('expected a refusal'); }, (err: HttpErrorResponse) => err);

  it('turns a slot into Focus Points on the character, and logs it as the server words it', async () => {
    seed();

    const saved = await firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 2));

    expect(saved.spellSlots).toEqual({ 1: { max: 4, used: 1 }, 2: { max: 2, used: 2 } });
    expect(saved.classResources).toEqual({ focusPoints: 3 });
    expect(stored().classResources).toEqual({ focusPoints: 3 });
    const log = await firstValueFrom(service.getLog(ID));
    expect(log[0].actionType).toBe('SPELL_SLOT');
    expect(log[0].description).toBe(
      'Mystic Focus: turned a level 2 spell slot into 2 Focus Points (0 of 2 slots left, 5 of 8 Focus Points)');
  });

  it('turns Focus Points into a slot, for the owner of a campaign character too', async () => {
    seed({ campaignId: 'veiled' });

    const saved = await firstValueFrom(service.mysticFocus(ID, 'FOCUS_TO_SLOT', 1));

    expect(saved.spellSlots![1]).toEqual({ max: 4, used: 0 });
    expect(saved.classResources).toEqual({ focusPoints: 7 });
  });

  it('logs the DM\'s conversion as the DM\'s', async () => {
    seed({ campaignId: 'veiled' });

    await firstValueFrom(service.mysticFocus(ID, 'FOCUS_TO_SLOT', 2, true));

    expect((await firstValueFrom(service.getLog(ID)))[0].description).toBe(
      'DM used Mystic Focus: turned 3 Focus Points into a level 2 spell slot (2 of 2 slots left, 0 of 8 Focus Points)');
  });

  it('shows the change on the open sheet', async () => {
    service.setActivePC(seed());
    let active: PC | null = null;
    service.activePC$.subscribe(v => (active = v));

    await firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 1));

    expect(active!.spellSlots![1]).toEqual({ max: 4, used: 2 });
    expect(active!.classResources).toEqual({ focusPoints: 4 });
  });

  it('refuses as the server does, and changes nothing', async () => {
    const before = seed({ spellSlots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } }, classResources: {} });

    const nothingToRegain = await refusal(firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 1)));
    expect([nothingToRegain.status, nothingToRegain.error.message]).toEqual([409, 'No expended Focus Points to regain']);
    const nothingSpent = await refusal(firstValueFrom(service.mysticFocus(ID, 'FOCUS_TO_SLOT', 1)));
    expect([nothingSpent.status, nothingSpent.error.message]).toEqual([409, 'No spent level 1 slot to restore']);
    const tooYoung = await refusal(firstValueFrom(service.mysticFocus(ID, 'FOCUS_TO_SLOT', 3)));
    expect([tooYoung.status, tooYoung.error.message]).toEqual([400, 'Recovering a level 3 spell slot needs Monk level 13']);
    const badLevel = await refusal(firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 5)));
    expect([badLevel.status, badLevel.error.message]).toEqual([400, 'slotLevel must be a spell level from 1 to 4']);

    expect(stored()).toEqual(before);
    expect((await firstValueFrom(service.getLog(ID))).length).toBe(0);
  });

  it('refuses a character without the feature, and an unknown one', async () => {
    seed({ subclass: 'Warrior of the Open Hand', spellSlots: {} });
    const other = await refusal(firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 1)));
    expect([other.status, other.error.message])
      .toEqual([400, 'Mystic Focus needs a Warrior of the Mystic Arts of Monk level 6 or higher']);
    seed({ level: 5 });
    expect((await refusal(firstValueFrom(service.mysticFocus(ID, 'SLOT_TO_FOCUS', 1)))).status).toBe(400);
    expect((await refusal(firstValueFrom(service.mysticFocus(123456, 'SLOT_TO_FOCUS', 1)))).status).toBe(404);
  });
});
